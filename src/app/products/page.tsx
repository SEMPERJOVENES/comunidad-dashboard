'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange, ShopifyProduct } from '@/lib/types';
import { Search, Package, Loader2, Minus, Plus, Check, X } from 'lucide-react';

export default function InventarioPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchProducts(false);
  }, []);

  async function fetchProducts(fresh = false) {
    setLoading(true);
    try {
      const url = fresh ? '/api/shopify/products?fresh=1' : '/api/shopify/products';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjustInventory(product: ShopifyProduct) {
    if (adjustment === 0) { setEditingId(null); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      const variantId = product.variants?.[0]?.id;
      if (!variantId) throw new Error('Variante no encontrada');
      const res = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_inventory',
          productId: product.id,
          variantId,
          adjustment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ajustar inventario');
      setSaveMsg({ type: 'success', text: `Stock de "${product.title}" actualizado (${adjustment > 0 ? '+' : ''}${adjustment})` });
      // Re-fetch sin caché para obtener datos frescos
      await fetchProducts(true);
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Error al ajustar inventario en Shopify' });
    } finally {
      setSaving(false);
      setEditingId(null);
      setAdjustment(0);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStock = products.reduce((s, p) => s + (p.variants?.reduce((v, va) => v + (va.inventory_quantity || 0), 0) || 0), 0);
  const lowStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv > 0 && inv <= 5;
  }).length;
  const outOfStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv <= 0;
  }).length;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-500">{products.length} productos de Shopify · Edita stock y se sincroniza</p>
          </div>
        </div>

        {/* Feedback message */}
        {saveMsg && (
          <div className={`rounded-lg p-3 text-sm font-medium ${
            saveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveMsg.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Stock Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalStock}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Stock Bajo (≤5)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{lowStock}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Agotados</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{outOfStock}</p>
          </Card>
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
              <span className="ml-2 text-gray-500 text-sm">Cargando inventario...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Producto</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Tipo</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Stock</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const totalInventory = product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
                    const price = product.variants?.[0]?.price || '0';
                    const isEditing = editingId === product.id;
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
                        <td className="px-4 sm:px-6 py-3">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setAdjustment(a => a - 1)} className="p-1 rounded hover:bg-gray-200">
                                <Minus size={14} />
                              </button>
                              <span className="text-sm font-bold w-16 text-center">
                                {totalInventory + adjustment}
                                {adjustment !== 0 && (
                                  <span className={`text-xs ml-1 ${adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({adjustment > 0 ? '+' : ''}{adjustment})
                                  </span>
                                )}
                              </span>
                              <button onClick={() => setAdjustment(a => a + 1)} className="p-1 rounded hover:bg-gray-200">
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() => handleAdjustInventory(product)}
                                disabled={saving}
                                className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 ml-1"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setAdjustment(0); }}
                                className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(product.id); setAdjustment(0); }}
                              className={`block mx-auto text-sm font-semibold px-3 py-1 rounded-lg hover:ring-2 hover:ring-violet-300 transition-all ${
                                totalInventory <= 0 ? 'text-red-600 bg-red-50' :
                                totalInventory <= 5 ? 'text-amber-600 bg-amber-50' :
                                'text-gray-700 bg-gray-50'
                              }`}
                            >
                              {totalInventory}
                            </button>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">{formatCurrency(parseFloat(price))}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
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
