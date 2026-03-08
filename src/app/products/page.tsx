'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange, ShopifyProduct } from '@/lib/types';
import { Search, Package, Loader2 } from 'lucide-react';

export default function ProductsPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const res = await fetch('/api/shopify/products');
        if (!res.ok) throw new Error('Error al cargar productos');
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500">{products.length} productos de Shopify</p>
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando productos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Producto</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Tipo</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Inventario</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Precio</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const totalInventory = product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
                    const price = product.variants?.[0]?.price || '0';
                    return (
                      <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            {product.images?.[0]?.src ? (
                              <img src={product.images[0].src} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{product.title}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{product.product_type || '-'}</td>
                        <td className="px-4 sm:px-6 py-3">
                          <Badge variant={product.status === 'active' ? 'success' : 'default'}>
                            {product.status === 'active' ? 'Activo' : product.status === 'draft' ? 'Borrador' : product.status}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-700">{totalInventory}</td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">{formatCurrency(parseFloat(price))}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{product.vendor || '-'}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        Sin productos
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
