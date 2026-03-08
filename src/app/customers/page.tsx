'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, ShopifyCustomer } from '@/lib/types';
import { Search, Users, Loader2 } from 'lucide-react';

export default function CustomersPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<ShopifyCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/shopify/customers?${params}`);
        if (!res.ok) throw new Error('Error al cargar clientes');
        const data = await res.json();
        setCustomers(data.customers || []);
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, [selectedRange]);

  const filtered = customers.filter(
    (c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500">{customers.length} clientes de Shopify</p>
          </div>
        </div>

        <Card>
          <div className="mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando clientes...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Email</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Órdenes</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Total gastado</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Desde</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-violet-600">
                              {(customer.first_name || '?')[0]}{(customer.last_name || '?')[0]}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {customer.first_name} {customer.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{customer.email}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-700">{customer.orders_count}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">
                        {formatCurrency(parseFloat(customer.total_spent || '0'))}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDate(customer.created_at)}</td>
                      <td className="px-4 sm:px-6 py-3">
                        {customer.tags && customer.tags.split(',').filter(Boolean).map((tag) => (
                          <Badge key={tag.trim()} variant="purple">{tag.trim()}</Badge>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        Sin clientes para este período
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
