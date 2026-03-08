'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getStatusColor, getFulfillmentColor } from '@/lib/utils';
import { ShopifyOrder } from '@/lib/types';

interface RecentOrdersProps {
  orders: ShopifyOrder[];
}

function getPaymentBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    paid: 'success',
    pending: 'warning',
    refunded: 'danger',
    partially_refunded: 'warning',
    authorized: 'info',
    voided: 'default',
  };
  return map[status] || 'default';
}

function getFulfillmentBadgeVariant(status: string | null): 'success' | 'warning' | 'danger' | 'default' {
  if (!status) return 'default';
  const map: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    fulfilled: 'success',
    partial: 'warning',
    unfulfilled: 'danger',
  };
  return map[status] || 'default';
}

export default function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <Card padding={false}>
      <div className="p-4 sm:p-6 pb-0">
        <CardHeader>
          <CardTitle>Órdenes Recientes</CardTitle>
          <span className="text-xs text-gray-400">{orders.length} últimas</span>
        </CardHeader>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Orden</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Cliente</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fecha</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Pago</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Envío</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 sm:px-6 py-3">
                  <span className="text-sm font-medium text-violet-600">{order.name}</span>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <span className="text-sm text-gray-700">
                    {order.customer
                      ? `${order.customer.first_name} ${order.customer.last_name}`
                      : order.email || 'Sin cliente'}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <Badge variant={getPaymentBadgeVariant(order.financial_status)}>
                    {order.financial_status}
                  </Badge>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <Badge variant={getFulfillmentBadgeVariant(order.fulfillment_status)}>
                    {order.fulfillment_status || 'sin envío'}
                  </Badge>
                </td>
                <td className="px-4 sm:px-6 py-3 text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(parseFloat(order.total_price))}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                  Sin órdenes recientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
