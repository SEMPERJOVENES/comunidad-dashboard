'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, ShopifyOrder } from '@/lib/types';
import { Search, Filter, Download, Loader2 } from 'lucide-react';

export default function OrdersPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[8]);
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/shopify/orders?${params}`);
        if (!res.ok) throw new Error('Error al cargar órdenes');
        const data = await res.json();
        setOrders(data.orders || []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [selectedRange]);

  const filteredOrders = orders.filter(
    (order) =>
      order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer &&
        `${order.customer.first_name} ${order.customer.last_name}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()))
  );

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Órdenes</h1>
            <p className="text-sm text-gray-500">{orders.length} órdenes de Shopify</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
            <Download size={16} />
            Exportar
          </button>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por orden, cliente o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter size={16} />
              Filtros
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando órdenes...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Orden</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fecha</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Pago</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Envío</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Tags</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 sm:px-6 py-3">
                        <span className="text-sm font-medium text-violet-600">{order.name}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div>
                          <span className="text-sm text-gray-900">
                            {order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Sin cliente'}
                          </span>
                          <p className="text-xs text-gray-400">{order.email}</p>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <Badge variant={order.financial_status === 'paid' ? 'success' : order.financial_status === 'refunded' ? 'danger' : 'warning'}>
                          {order.financial_status}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <Badge variant={order.fulfillment_status === 'fulfilled' ? 'success' : 'default'}>
                          {order.fulfillment_status || 'pendiente'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(order.tags || '').split(',').filter(Boolean).map((tag) => (
                            <Badge key={tag.trim()} variant="purple" className="text-[10px]">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right">
                        <span className="text-sm font-semibold">{formatCurrency(parseFloat(order.total_price))}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                        Sin órdenes para este período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
