import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as any,
});

export async function getBalance() {
  const balance = await stripe.balance.retrieve();
  return {
    available: balance.available.reduce((sum, b) => sum + b.amount, 0) / 100,
    pending: balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100,
    currency: balance.available[0]?.currency || 'eur',
  };
}

export async function getPayouts(params: { limit?: number; created?: { gte?: number; lte?: number } } = {}) {
  const payouts = await stripe.payouts.list({
    limit: params.limit || 25,
    ...(params.created && { created: params.created }),
  });
  return payouts.data.map((p) => ({
    id: p.id,
    amount: p.amount / 100,
    currency: p.currency,
    status: p.status,
    arrival_date: new Date(p.arrival_date * 1000).toISOString(),
    created: new Date(p.created * 1000).toISOString(),
    description: p.description,
  }));
}

export async function getCharges(params: { limit?: number; created?: { gte?: number; lte?: number } } = {}) {
  const charges = await stripe.charges.list({
    limit: params.limit || 100,
    expand: ['data.customer'],
    ...(params.created && { created: params.created }),
  });
  return charges.data.map((c) => {
    const customer = c.customer as Stripe.Customer | null;
    return {
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      created: new Date(c.created * 1000).toISOString(),
      description: c.description,
      paid: c.paid,
      refunded: c.refunded,
      disputed: c.disputed,
      customerName: customer && typeof customer === 'object' ? (customer.name || customer.email || null) : null,
      customerEmail: customer && typeof customer === 'object' ? (customer.email || null) : null,
    };
  });
}

export async function getBalanceTransactions(params: { limit?: number; created?: { gte?: number; lte?: number }; type?: string } = {}) {
  const txs = await stripe.balanceTransactions.list({
    limit: params.limit || 100,
    ...(params.created && { created: params.created }),
    ...(params.type && { type: params.type }),
  });
  return txs.data.map((t) => ({
    id: t.id,
    amount: t.amount / 100,
    fee: t.fee / 100,
    net: t.net / 100,
    currency: t.currency,
    type: t.type,
    status: t.status,
    created: new Date(t.created * 1000).toISOString(),
    description: t.description,
  }));
}

export async function getSubscriptions(params: { status?: string; limit?: number } = {}) {
  const subs = await stripe.subscriptions.list({
    limit: params.limit || 100,
    status: (params.status as any) || 'active',
    expand: ['data.customer', 'data.items.data.price.product'],
  });
  return subs.data.map((s) => {
    const customer = s.customer as Stripe.Customer;
    const item = s.items.data[0];
    const priceAmount = item?.price?.unit_amount || 0;
    const interval = item?.price?.recurring?.interval || 'month';
    const product = item?.price?.product;
    const productName = typeof product === 'object' && product !== null
      ? (product as any).name || ''
      : item?.price?.nickname || '';
    return {
      id: s.id,
      status: s.status,
      customerName: customer.name || customer.email || 'Anónimo',
      customerEmail: customer.email || null,
      customerId: customer.id,
      amount: priceAmount / 100,
      currency: item?.price?.currency || 'eur',
      interval,
      productName,
      created: new Date(s.created * 1000).toISOString(),
      currentPeriodEnd: new Date((s as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: (s as any).cancel_at_period_end,
    };
  });
}

export async function getInvoices(params: {
  created?: { gte?: number; lte?: number };
  status?: string;
  limit?: number;
  customer?: string;
  subscription?: string;
} = {}) {
  const invoices = await stripe.invoices.list({
    limit: params.limit || 100,
    ...(params.created && { created: params.created }),
    ...(params.status && { status: params.status as any }),
    ...(params.customer && { customer: params.customer }),
    ...(params.subscription && { subscription: params.subscription }),
    expand: ['data.customer'],
  });
  return invoices.data.map((inv) => {
    const customer = inv.customer as Stripe.Customer;
    return {
      id: inv.id,
      status: inv.status,
      amount: (inv.amount_paid || 0) / 100,
      currency: inv.currency,
      customerName: customer?.name || customer?.email || 'Anónimo',
      customerEmail: customer?.email || null,
      customerId: customer?.id || null,
      subscriptionId: (inv as any).subscription ? (typeof (inv as any).subscription === 'string' ? (inv as any).subscription : (inv as any).subscription?.id || null) : null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      created: new Date(inv.created * 1000).toISOString(),
    };
  });
}

export async function getPaymentVolume(params: { created?: { gte?: number; lte?: number } } = {}) {
  const charges = await stripe.charges.list({
    limit: 100,
    ...(params.created && { created: params.created }),
  });

  let volume = 0;
  let count = 0;
  let refunded = 0;
  let disputed = 0;

  for (const c of charges.data) {
    if (c.paid) {
      volume += c.amount;
      count++;
    }
    if (c.refunded) refunded++;
    if (c.disputed) disputed++;
  }

  return {
    volume: volume / 100,
    count,
    refunded,
    disputed,
    currency: 'eur',
  };
}
