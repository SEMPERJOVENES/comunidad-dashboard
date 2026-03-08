const SHOPIFY_STORE = process.env.SHOPIFY_STORE!;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = '2024-10';

interface ShopifyFetchOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

async function shopifyFetch<T>({ endpoint, method = 'GET', body, params }: ShopifyFetchOptions): Promise<T> {
  const url = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/${endpoint}.json`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
  };

  const options: RequestInit = {
    method,
    headers,
    next: { revalidate: 300 }, // Cache 5 min
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// Orders
export async function getOrders(params: {
  status?: string;
  created_at_min?: string;
  created_at_max?: string;
  limit?: number;
  fields?: string;
} = {}) {
  const queryParams: Record<string, string> = {
    status: params.status || 'any',
    limit: String(params.limit || 250),
  };

  if (params.created_at_min) queryParams.created_at_min = params.created_at_min;
  if (params.created_at_max) queryParams.created_at_max = params.created_at_max;
  if (params.fields) queryParams.fields = params.fields;

  const data = await shopifyFetch<{ orders: any[] }>({
    endpoint: 'orders',
    params: queryParams,
  });

  return data.orders;
}

// Products
export async function getProducts(params: { limit?: number } = {}) {
  const data = await shopifyFetch<{ products: any[] }>({
    endpoint: 'products',
    params: { limit: String(params.limit || 250) },
  });
  return data.products;
}

// Customers
export async function getCustomers(params: {
  created_at_min?: string;
  created_at_max?: string;
  limit?: number;
} = {}) {
  const queryParams: Record<string, string> = {
    limit: String(params.limit || 250),
  };
  if (params.created_at_min) queryParams.created_at_min = params.created_at_min;
  if (params.created_at_max) queryParams.created_at_max = params.created_at_max;

  const data = await shopifyFetch<{ customers: any[] }>({
    endpoint: 'customers',
    params: queryParams,
  });
  return data.customers;
}

// Orders count
export async function getOrdersCount(params: {
  status?: string;
  created_at_min?: string;
  created_at_max?: string;
} = {}) {
  const queryParams: Record<string, string> = {
    status: params.status || 'any',
  };
  if (params.created_at_min) queryParams.created_at_min = params.created_at_min;
  if (params.created_at_max) queryParams.created_at_max = params.created_at_max;

  const data = await shopifyFetch<{ count: number }>({
    endpoint: 'orders/count',
    params: queryParams,
  });
  return data.count;
}

// Shop info
export async function getShopInfo() {
  const data = await shopifyFetch<{ shop: any }>({ endpoint: 'shop' });
  return data.shop;
}

// GraphQL for analytics
export async function shopifyGraphQL(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  return response.json();
}
