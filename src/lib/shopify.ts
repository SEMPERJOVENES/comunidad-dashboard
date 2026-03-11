function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const SHOPIFY_STORE = getEnvVar('SHOPIFY_STORE');
const SHOPIFY_ACCESS_TOKEN = getEnvVar('SHOPIFY_ACCESS_TOKEN');
const API_VERSION = '2025-04';

interface ShopifyFetchOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  noCache?: boolean;
}

async function shopifyFetch<T>({ endpoint, method = 'GET', body, params, noCache }: ShopifyFetchOptions): Promise<T> {
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

  const options: RequestInit & { next?: { revalidate: number } } = {
    method,
    headers,
  };

  // Solo cachear GET requests, nunca POST/PUT/DELETE
  if (method === 'GET' && !noCache) {
    options.next = { revalidate: 300 }; // Cache 5 min
  } else {
    options.cache = 'no-store';
  }

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

// Orders (single page — use getAllOrders for pagination)
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

// Orders con paginación completa — trae TODAS las órdenes
export async function getAllOrders(params: {
  status?: string;
  created_at_min?: string;
  created_at_max?: string;
  fields?: string;
} = {}) {
  const allOrders: any[] = [];
  const queryParams: Record<string, string> = {
    status: params.status || 'any',
    limit: '250',
  };

  if (params.created_at_min) queryParams.created_at_min = params.created_at_min;
  if (params.created_at_max) queryParams.created_at_max = params.created_at_max;
  if (params.fields) queryParams.fields = params.fields;

  let nextUrl: string | null = (() => {
    const u = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/orders.json`);
    Object.entries(queryParams).forEach(([key, value]) => {
      u.searchParams.append(key, value);
    });
    return u.toString();
  })();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    allOrders.push(...(data.orders || []));

    // Paginación cursor-based de Shopify: leer Link header
    const linkHeader = res.headers.get('Link') || res.headers.get('link');
    if (!linkHeader) break;

    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return allOrders;
}

// Products
export async function getProducts(params: { limit?: number; noCache?: boolean } = {}) {
  const data = await shopifyFetch<{ products: any[] }>({
    endpoint: 'products',
    params: { limit: String(params.limit || 250) },
    noCache: params.noCache,
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

// Inventory levels
export async function getInventoryLevels(inventoryItemIds: number[]) {
  const ids = inventoryItemIds.join(',');
  const data = await shopifyFetch<{ inventory_levels: any[] }>({
    endpoint: 'inventory_levels',
    params: { inventory_item_ids: ids, limit: '250' },
  });
  return data.inventory_levels;
}

// Set inventory (absolute value) - replaces deprecated inventory_levels/adjust
export async function setInventory(inventoryItemId: number, locationId: number, available: number) {
  const data = await shopifyFetch<{ inventory_level: any }>({
    endpoint: 'inventory_levels/set',
    method: 'POST',
    body: {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available,
    },
  });
  return data.inventory_level;
}

// Legacy wrapper - calcula el valor absoluto internamente
export async function adjustInventory(inventoryItemId: number, locationId: number, adjustment: number) {
  // Primero obtener el nivel actual
  const levels = await getInventoryLevels([inventoryItemId]);
  const current = levels.find((l: any) => l.location_id === locationId);
  const currentQty = current?.available || 0;
  const newQty = Math.max(0, currentQty + adjustment);
  return setInventory(inventoryItemId, locationId, newQty);
}

// Get locations
export async function getLocations() {
  const data = await shopifyFetch<{ locations: any[] }>({ endpoint: 'locations' });
  return data.locations;
}

// Get product variants for inventory
export async function getProductVariants(productId: number) {
  const data = await shopifyFetch<{ variants: any[] }>({
    endpoint: `products/${productId}/variants`,
  });
  return data.variants;
}

// Get inventory items (for cost data) - accepts up to 100 IDs at a time
export async function getInventoryItems(ids: number[]) {
  const allItems: any[] = [];
  // Batch in groups of 100 (Shopify limit)
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const data = await shopifyFetch<{ inventory_items: any[] }>({
      endpoint: 'inventory_items',
      params: { ids: batch.join(','), limit: '100' },
    });
    allItems.push(...data.inventory_items);
  }
  return allItems;
}

// Calculate stock value and cost from products
export async function getStockValuation() {
  const products = await getProducts({ limit: 250 });

  let stockValue = 0;  // retail price × qty
  let stockCost = 0;   // cost × qty
  let totalUnits = 0;

  // Collect all inventory_item_ids
  const inventoryItemIds: number[] = [];
  const variantMap: Record<number, { price: number; qty: number }> = {};

  for (const p of products) {
    for (const v of (p.variants || [])) {
      const qty = v.inventory_quantity || 0;
      const price = parseFloat(v.price || '0');
      if (v.inventory_item_id) {
        inventoryItemIds.push(v.inventory_item_id);
        variantMap[v.inventory_item_id] = { price, qty };
      }
      stockValue += price * qty;
      totalUnits += qty;
    }
  }

  // Fetch cost data from inventory_items
  try {
    const items = await getInventoryItems(inventoryItemIds);
    for (const item of items) {
      const variant = variantMap[item.id];
      if (variant && item.cost) {
        stockCost += parseFloat(item.cost) * variant.qty;
      }
    }
  } catch {
    // Si falla (scope faltante), stockCost queda en 0
  }

  return { stockValue, stockCost, totalUnits, productCount: products.length };
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
