'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange, ShopifyProduct } from '@/lib/types';
import {
  Search, Package, Loader2, Minus, Plus, Check, X,
  DollarSign, TrendingUp, Archive, Warehouse,
  ChevronDown, ChevronUp,
} from 'lucide-react';

interface CostData {
  cost_price: number;
  category: string;
  notes: string | null;
  id: number;
}

type CostMap = Record<string, CostData>;
type CategoryFilter = 'all' | 'inventario' | 'inmovilizado';

export default function InventarioPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [costMap, setCostMap] = useState<CostMap>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [targetStock, setTargetStock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Costes inline editing
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editCostValue, setEditCostValue] = useState('');
  const [editCostCategory, setEditCostCategory] = useState<'inventario' | 'inmovilizado'>('inventario');
  const [savingCost, setSavingCost] = useState(false);
  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showMetrics, setShowMetrics] = useState(true);

  const fetchProducts = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      const [prodRes, costRes] = await Promise.all([
        fetch(fresh ? '/api/shopify/products?fresh=1' : '/api/shopify/products'),
        fetch('/api/product-costs'),
      ]);
      if (!prodRes.ok) throw new Error('Error cargando productos');
      const prodData = await prodRes.json();
      setProducts(prodData.products || []);

      if (costRes.ok) {
        const costData = await costRes.json();
        setCostMap(costData.costMap || {});
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(false);
  }, [fetchProducts]);

  async function handleAdjustInventory(product: ShopifyProduct) {
    const totalInventory = product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
    const adjustment = targetStock - totalInventory;
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
      setSaveMsg({ type: 'success', text: `Stock de "${product.title}" → ${targetStock} (${adjustment > 0 ? '+' : ''}${adjustment})` });
      await fetchProducts(true);
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Error al ajustar inventario en Shopify' });
    } finally {
      setSaving(false);
      setEditingId(null);
      setTargetStock(0);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  async function handleSaveCost(product: ShopifyProduct) {
    setSavingCost(true);
    setSaveMsg(null);
    try {
      const variantId = product.variants?.[0]?.id;
      const res = await fetch('/api/product-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          shopify_product_id: product.id,
          shopify_variant_id: variantId || null,
          cost_price: parseFloat(editCostValue) || 0,
          category: editCostCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar coste');

      // Actualizar costMap localmente
      const key = variantId ? `${product.id}_${variantId}` : `${product.id}`;
      setCostMap(prev => ({
        ...prev,
        [key]: {
          cost_price: parseFloat(editCostValue) || 0,
          category: editCostCategory,
          notes: null,
          id: data.cost?.id || 0,
        },
      }));

      setSaveMsg({ type: 'success', text: `Coste de "${product.title}" guardado: ${formatCurrency(parseFloat(editCostValue) || 0)}` });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Error al guardar coste' });
    } finally {
      setSavingCost(false);
      setEditingCostId(null);
      setEditCostValue('');
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  function getCostForProduct(product: ShopifyProduct): CostData | null {
    const variantId = product.variants?.[0]?.id;
    const key = variantId ? `${product.id}_${variantId}` : `${product.id}`;
    return costMap[key] || costMap[`${product.id}`] || null;
  }

  function getCategoryForProduct(product: ShopifyProduct): string {
    const cost = getCostForProduct(product);
    return cost?.category || 'inventario';
  }

  // Filtrado
  const filtered = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    return getCategoryForProduct(p) === categoryFilter;
  });

  // === MÉTRICAS ===
  const totalStock = products.reduce((s, p) => s + (p.variants?.reduce((v, va) => v + (va.inventory_quantity || 0), 0) || 0), 0);
  const lowStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv > 0 && inv <= 5;
  }).length;
  const outOfStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv <= 0;
  }).length;

  // Valor de stock (precio retail × cantidad)
  let totalStockValue = 0;
  let totalStockCost = 0;
  let totalInmovilizadoValue = 0;
  let totalInmovilizadoCost = 0;
  let productsWithCost = 0;

  for (const p of products) {
    const cost = getCostForProduct(p);
    const qty = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    const price = parseFloat(p.variants?.[0]?.price || '0');
    const costPrice = cost?.cost_price || 0;
    const cat = cost?.category || 'inventario';

    if (cat === 'inmovilizado') {
      totalInmovilizadoValue += price * qty;
      totalInmovilizadoCost += costPrice * qty;
    } else {
      totalStockValue += price * qty;
      totalStockCost += costPrice * qty;
    }
    if (costPrice > 0) productsWithCost++;
  }

  const totalMargin = totalStockValue - totalStockCost;
  const marginPercent = totalStockValue > 0 ? (totalMargin / totalStockValue) * 100 : 0;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <Package size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
              <p className="text-sm text-gray-500">
                {products.length} productos · {productsWithCost} con coste manual
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-medium"
          >
            {showMetrics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showMetrics ? 'Ocultar métricas' : 'Ver métricas'}
          </button>
        </div>

        {/* Feedback message */}
        {saveMsg && (
          <div className={`rounded-lg p-3 text-sm font-medium ${
            saveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveMsg.text}
          </div>
        )}

        {/* Métricas expandibles */}
        {showMetrics && (
          <div className="space-y-4">
            {/* Fila 1: Stock básico */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <p className="text-xs text-gray-500 font-medium">Stock Total</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalStock.toLocaleString('es-ES')}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Stock Bajo (≤5)</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{lowStock}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Agotados</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{outOfStock}</p>
              </Card>
            </div>

            {/* Fila 2: Valoración financiera */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-blue-500" />
                  <p className="text-xs text-gray-500 font-medium">Valor Stock (PVP)</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalStockValue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Precio venta × unidades</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Archive size={14} className="text-orange-500" />
                  <p className="text-xs text-gray-500 font-medium">Coste Stock</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalStockCost)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Coste manual × unidades</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-green-500" />
                  <p className="text-xs text-gray-500 font-medium">Margen Bruto</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalMargin)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{marginPercent.toFixed(1)}% margen</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse size={14} className="text-purple-500" />
                  <p className="text-xs text-gray-500 font-medium">Inmovilizado</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-purple-700">{formatCurrency(totalInmovilizadoValue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Coste: {formatCurrency(totalInmovilizadoCost)}</p>
              </Card>
            </div>
          </div>
        )}

        {/* Tabla de productos */}
        <Card>
          {/* Barra de búsqueda y filtros */}
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
            <div className="flex gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['all', 'inventario', 'inmovilizado'] as CategoryFilter[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      categoryFilter === cat
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {cat === 'all' ? 'Todo' : cat === 'inventario' ? '📦 Inventario' : '🏗️ Inmovilizado'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando inventario...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Producto</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-3 hidden sm:table-cell">Tipo</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Stock</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">PVP</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">
                      <span className="flex items-center justify-end gap-1">
                        Coste
                        <span className="text-[10px] text-gray-400 font-normal">(manual)</span>
                      </span>
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">Margen</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-3 hidden md:table-cell">Cat.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const totalInventory = product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
                    const price = parseFloat(product.variants?.[0]?.price || '0');
                    const cost = getCostForProduct(product);
                    const costPrice = cost?.cost_price || 0;
                    const margin = costPrice > 0 ? price - costPrice : 0;
                    const marginPct = costPrice > 0 && price > 0 ? ((margin / price) * 100) : 0;
                    const cat = cost?.category || 'inventario';
                    const isEditing = editingId === product.id;
                    const isEditingCost = editingCostId === product.id;

                    return (
                      <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        {/* Producto */}
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            {product.images?.[0]?.src ? (
                              <img src={product.images[0].src} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate block max-w-[180px] sm:max-w-[250px]">
                                {product.title}
                              </span>
                              <span className="text-xs text-gray-400 sm:hidden">{product.product_type || ''}</span>
                            </div>
                          </div>
                        </td>

                        {/* Tipo (oculto en móvil) */}
                        <td className="px-3 py-3 text-sm text-gray-500 hidden sm:table-cell">{product.product_type || '-'}</td>

                        {/* Stock */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setTargetStock(t => Math.max(0, t - 1))} className="p-1 rounded hover:bg-gray-200">
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={targetStock}
                                onChange={(e) => setTargetStock(Math.max(0, parseInt(e.target.value) || 0))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAdjustInventory(product);
                                  if (e.key === 'Escape') { setEditingId(null); setTargetStock(0); }
                                }}
                                className="w-16 text-center text-sm font-bold border border-gray-300 rounded-md py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                autoFocus
                              />
                              <button onClick={() => setTargetStock(t => t + 1)} className="p-1 rounded hover:bg-gray-200">
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
                                onClick={() => { setEditingId(null); setTargetStock(0); }}
                                className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                              >
                                <X size={14} />
                              </button>
                              {targetStock !== totalInventory && (
                                <span className={`text-[10px] font-medium ${targetStock > totalInventory ? 'text-green-600' : 'text-red-600'}`}>
                                  {targetStock > totalInventory ? '+' : ''}{targetStock - totalInventory}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(product.id); setTargetStock(totalInventory); }}
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

                        {/* PVP */}
                        <td className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                          {formatCurrency(price)}
                        </td>

                        {/* Coste manual */}
                        <td className="px-3 py-3 text-right">
                          {isEditingCost ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editCostValue}
                                onChange={(e) => setEditCostValue(e.target.value)}
                                className="w-20 text-right text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCost(product);
                                  if (e.key === 'Escape') { setEditingCostId(null); setEditCostValue(''); }
                                }}
                              />
                              <button
                                onClick={() => handleSaveCost(product)}
                                disabled={savingCost}
                                className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                {savingCost ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button
                                onClick={() => { setEditingCostId(null); setEditCostValue(''); }}
                                className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCostId(product.id);
                                setEditCostValue(costPrice > 0 ? costPrice.toString() : '');
                                setEditCostCategory(cat as 'inventario' | 'inmovilizado');
                              }}
                              className={`text-sm font-medium px-2 py-1 rounded hover:ring-2 hover:ring-violet-300 transition-all ${
                                costPrice > 0 ? 'text-gray-700' : 'text-gray-300 italic'
                              }`}
                            >
                              {costPrice > 0 ? formatCurrency(costPrice) : '—'}
                            </button>
                          )}
                        </td>

                        {/* Margen */}
                        <td className="px-3 py-3 text-right">
                          {costPrice > 0 ? (
                            <div>
                              <span className={`text-sm font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(margin)}
                              </span>
                              <span className="block text-[10px] text-gray-400">{marginPct.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>

                        {/* Categoría (oculta en móvil pequeño) */}
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          {isEditingCost ? (
                            <select
                              value={editCostCategory}
                              onChange={(e) => setEditCostCategory(e.target.value as 'inventario' | 'inmovilizado')}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5"
                            >
                              <option value="inventario">📦 Inv.</option>
                              <option value="inmovilizado">🏗️ Inm.</option>
                            </select>
                          ) : (
                            <Badge variant={cat === 'inmovilizado' ? 'warning' : 'default'}>
                              {cat === 'inmovilizado' ? '🏗️' : '📦'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                        Sin productos{categoryFilter !== 'all' ? ` en categoría "${categoryFilter}"` : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumen pie de tabla */}
          {!loading && filtered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>{filtered.length} productos mostrados</span>
              <span>·</span>
              <span>Valor liquidación: <strong className="text-gray-700">{formatCurrency(totalStockValue)}</strong></span>
              <span>·</span>
              <span>Inversión stock: <strong className="text-gray-700">{formatCurrency(totalStockCost)}</strong></span>
              {totalInmovilizadoValue > 0 && (
                <>
                  <span>·</span>
                  <span>Inmovilizado: <strong className="text-purple-700">{formatCurrency(totalInmovilizadoValue)}</strong></span>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
