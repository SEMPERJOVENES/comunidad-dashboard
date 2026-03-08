'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { demoTopProducts } from '@/lib/demo-data';
import { Search, Package } from 'lucide-react';

const demoFullProducts = demoTopProducts.map((p, i) => ({
  ...p,
  status: i < 8 ? 'active' : 'draft',
  inventory: Math.floor(Math.random() * 200) + 10,
  type: ['Camiseta', 'Sudadera', 'Pantalón', 'Gorra', 'Hoodie', 'Calcetines', 'Bolsa', 'Camiseta', 'Chaqueta', 'Bermuda'][i],
  vendor: 'Semper Brand',
}));

export default function ProductsPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = demoFullProducts.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500">Catálogo de productos de Shopify</p>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Producto</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Tipo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Inventario</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Vendidos</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package size={16} className="text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{product.title}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{product.type}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <Badge variant={product.status === 'active' ? 'success' : 'default'}>
                        {product.status === 'active' ? 'Activo' : 'Borrador'}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-700">{product.inventory}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-700">{product.unitsSold}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
