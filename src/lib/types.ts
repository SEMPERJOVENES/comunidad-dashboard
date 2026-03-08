// Shopify Types
export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  order_number: number;
  tags: string;
  note: string | null;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  refunds: ShopifyRefund[];
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  product_id: number;
  variant_id: number;
  sku: string;
  vendor: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  created_at: string;
  tags: string;
  default_address?: {
    city: string;
    province: string;
    country: string;
    country_code: string;
  };
}

export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  status: string;
  tags: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  inventory_quantity: number;
  sku: string;
}

export interface ShopifyRefund {
  id: number;
  created_at: string;
  note: string;
  refund_line_items: {
    quantity: number;
    subtotal: string;
  }[];
}

// Dashboard Types
export interface KPIData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  refundRate: number;
  newCustomers: number;
  returningCustomers: number;
  revenueChange: number;
  ordersChange: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: number;
  title: string;
  revenue: number;
  unitsSold: number;
  image?: string;
}

export interface ProjectTag {
  id: string;
  name: string;
  color: string;
  rules: TagRule[];
}

export interface TagRule {
  type: 'product' | 'collection' | 'tag' | 'custom';
  field: string;
  operator: 'contains' | 'equals' | 'starts_with';
  value: string;
}

export interface TaggedTransaction {
  orderId: number;
  orderName: string;
  date: string;
  amount: number;
  projectTag: string;
  autoTagged: boolean;
  reviewed: boolean;
  reviewedBy?: string;
  notes?: string;
}

export interface ProjectSummary {
  projectName: string;
  color: string;
  totalRevenue: number;
  totalOrders: number;
  percentage: number;
}

export type DateRange = {
  label: string;
  startDate: Date;
  endDate: Date;
};
