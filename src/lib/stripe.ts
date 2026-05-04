import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Falta la variable de entorno STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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

/**
 * Para un payout, obtiene el desglose por categoría:
 * - subsAmount: total de cargos de suscripción (Diezmo) en ese payout
 * - oneTimeAmount: total de cargos puntuales (Brand) en ese payout
 * - charges: lista de cargos que componen el payout
 */
export async function getPayoutBreakdown(payoutId: string) {
  // Listar balance_transactions del payout (con paginación)
  const allTxs: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;
  while (hasMore) {
    const txs = await stripe.balanceTransactions.list({
      payout: payoutId,
      limit: 100,
      expand: ['data.source'],
      ...(startingAfter && { starting_after: startingAfter }),
    });
    allTxs.push(...txs.data);
    hasMore = txs.has_more;
    if (txs.data.length > 0) startingAfter = txs.data[txs.data.length - 1].id;
  }

  // Para charges, mirar si tiene invoice (subscription)
  let subsAmount = 0, oneTimeAmount = 0, feesAmount = 0;
  const breakdown: Array<{
    type: 'subscription' | 'one_time' | 'fee' | 'refund' | 'other';
    amount: number; net: number; fee: number;
    description: string | null;
    chargeId?: string; created: string;
    customerName?: string | null; customerEmail?: string | null;
  }> = [];

  for (const tx of allTxs) {
    const amount = tx.amount / 100;
    const fee = tx.fee / 100;
    const net = tx.net / 100;
    const created = new Date(tx.created * 1000).toISOString();

    if (tx.type === 'charge' || tx.type === 'payment') {
      // Cargar charge para ver si es subscription
      const source = tx.source as any;
      let isSubscription = false;
      let customerName: string | null = null, customerEmail: string | null = null;
      if (source && typeof source === 'object' && 'object' in source && source.object === 'charge') {
        isSubscription = !!source.invoice;
        // expand customer si está disponible
        if (source.customer && typeof source.customer === 'object') {
          customerName = source.customer.name || source.customer.email || null;
          customerEmail = source.customer.email || null;
        } else if (typeof source.customer === 'string') {
          // No expandido, hacer fetch puntual
          try {
            const cust = await stripe.customers.retrieve(source.customer);
            if ('name' in cust) {
              customerName = cust.name || cust.email || null;
              customerEmail = cust.email || null;
            }
          } catch {}
        }
      }

      if (isSubscription) {
        subsAmount += net;
        breakdown.push({ type: 'subscription', amount, net, fee, description: tx.description, chargeId: typeof tx.source === 'string' ? tx.source : (tx.source as any)?.id, created, customerName, customerEmail });
      } else {
        oneTimeAmount += net;
        breakdown.push({ type: 'one_time', amount, net, fee, description: tx.description, chargeId: typeof tx.source === 'string' ? tx.source : (tx.source as any)?.id, created, customerName, customerEmail });
      }
      feesAmount += fee;
    } else if (tx.type === 'refund') {
      breakdown.push({ type: 'refund', amount, net, fee, description: tx.description, created });
    } else if (tx.type === 'stripe_fee' || tx.type === 'application_fee') {
      breakdown.push({ type: 'fee', amount, net, fee, description: tx.description, created });
    } else {
      breakdown.push({ type: 'other', amount, net, fee, description: tx.description, created });
    }
  }

  const total = subsAmount + oneTimeAmount;
  let composition: 'pure_subscription' | 'pure_one_time' | 'mixed' | 'empty' = 'empty';
  if (subsAmount > 0 && oneTimeAmount > 0) composition = 'mixed';
  else if (subsAmount > 0) composition = 'pure_subscription';
  else if (oneTimeAmount > 0) composition = 'pure_one_time';

  return {
    payoutId,
    subsAmount, oneTimeAmount, feesAmount, total,
    composition,
    pctSubs: total > 0 ? (subsAmount / total) * 100 : 0,
    pctOneTime: total > 0 ? (oneTimeAmount / total) * 100 : 0,
    breakdown,
  };
}

/**
 * Versión LIGERA de getPayoutBreakdown — solo separa subs vs one-time
 * sin expandir customer. Mucho más rápido para análisis agregados.
 */
export async function getPayoutBreakdownLite(payoutId: string) {
  const allTxs: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;
  while (hasMore) {
    const txs = await stripe.balanceTransactions.list({
      payout: payoutId,
      limit: 100,
      expand: ['data.source'],
      ...(startingAfter && { starting_after: startingAfter }),
    });
    allTxs.push(...txs.data);
    hasMore = txs.has_more;
    if (txs.data.length > 0) startingAfter = txs.data[txs.data.length - 1].id;
  }

  let subsAmount = 0, oneTimeAmount = 0;
  for (const tx of allTxs) {
    if (tx.type === 'charge' || tx.type === 'payment') {
      const source = tx.source as any;
      const isSubscription = source && source.object === 'charge' && !!source.invoice;
      if (isSubscription) subsAmount += tx.net / 100;
      else oneTimeAmount += tx.net / 100;
    }
  }
  return { payoutId, subsAmount, oneTimeAmount };
}

export async function getCharges(params: { limit?: number; created?: { gte?: number; lte?: number } } = {}) {
  const charges = await stripe.charges.list({
    limit: params.limit || 100,
    expand: ['data.customer'],
    ...(params.created && { created: params.created }),
  });
  return charges.data.map(mapCharge);
}

// Fetch ALL charges with auto-pagination (sin límite de 100)
export async function getAllCharges(params: { created?: { gte?: number; lte?: number } } = {}) {
  const all: ReturnType<typeof mapCharge>[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const charges = await stripe.charges.list({
      limit: 100,
      expand: ['data.customer'],
      ...(params.created && { created: params.created }),
      ...(startingAfter && { starting_after: startingAfter }),
    });
    all.push(...charges.data.map(mapCharge));
    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }
  return all;
}

function mapCharge(c: Stripe.Charge) {
  const customer = c.customer as Stripe.Customer | null;
  // Detectar si es de suscripción (tiene invoice asociado)
  const invoice = (c as any).invoice;
  const isSubscription = !!invoice;
  return {
    id: c.id,
    amount: c.amount / 100,
    amountRefunded: (c.amount_refunded || 0) / 100,
    currency: c.currency,
    status: c.status,
    created: new Date(c.created * 1000).toISOString(),
    description: c.description,
    paid: c.paid,
    refunded: c.refunded,
    disputed: c.disputed,
    customerName: customer && typeof customer === 'object' ? (customer.name || customer.email || null) : null,
    customerEmail: customer && typeof customer === 'object' ? (customer.email || null) : null,
    isSubscription,
    invoiceId: invoice ? (typeof invoice === 'string' ? invoice : invoice?.id || null) : null,
    type: isSubscription ? 'subscription' : 'one_time',
    category: isSubscription ? 'Diezmo' : 'Brand',
  };
}

export async function getBalanceTransactions(params: { limit?: number; created?: { gte?: number; lte?: number }; type?: string } = {}) {
  const txs = await stripe.balanceTransactions.list({
    limit: params.limit || 100,
    ...(params.created && { created: params.created }),
    ...(params.type && { type: params.type }),
  });
  return txs.data.map(mapBalanceTx);
}

// Fetch ALL balance transactions with auto-pagination
export async function getAllBalanceTransactions(params: { created?: { gte?: number; lte?: number }; type?: string } = {}) {
  const all: ReturnType<typeof mapBalanceTx>[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const txs = await stripe.balanceTransactions.list({
      limit: 100,
      ...(params.created && { created: params.created }),
      ...(params.type && { type: params.type }),
      ...(startingAfter && { starting_after: startingAfter }),
    });
    all.push(...txs.data.map(mapBalanceTx));
    hasMore = txs.has_more;
    if (txs.data.length > 0) {
      startingAfter = txs.data[txs.data.length - 1].id;
    }
  }
  return all;
}

function mapBalanceTx(t: Stripe.BalanceTransaction) {
  return {
    id: t.id,
    amount: t.amount / 100,
    fee: t.fee / 100,
    net: t.net / 100,
    currency: t.currency,
    type: t.type,
    status: t.status,
    created: new Date(t.created * 1000).toISOString(),
    description: t.description,
  };
}

export async function getSubscriptions(params: { status?: string; limit?: number } = {}) {
  const subs = await stripe.subscriptions.list({
    limit: params.limit || 100,
    status: (params.status as any) || 'active',
    expand: ['data.customer', 'data.items.data.price'],
  });
  return subs.data.map((s) => {
    const customer = s.customer as Stripe.Customer;
    // Sumar TODOS los items × quantity (no solo el primero)
    let totalCents = 0;
    for (const item of s.items.data) {
      const unit = item?.price?.unit_amount || 0;
      const qty = item.quantity || 1;
      totalCents += unit * qty;
    }
    const item = s.items.data[0];
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
      amount: totalCents / 100,
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

// Fetch ALL payment volume with auto-pagination (sin límite de 100)
export async function getAllPaymentVolume(params: { created?: { gte?: number; lte?: number } } = {}) {
  let volume = 0;
  let count = 0;
  let refunded = 0;
  let disputed = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const charges = await stripe.charges.list({
      limit: 100,
      ...(params.created && { created: params.created }),
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const c of charges.data) {
      if (c.paid) {
        volume += c.amount;
        count++;
      }
      if (c.refunded) refunded++;
      if (c.disputed) disputed++;
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }

  return {
    volume: volume / 100,
    count,
    refunded,
    disputed,
    currency: 'eur',
  };
}
