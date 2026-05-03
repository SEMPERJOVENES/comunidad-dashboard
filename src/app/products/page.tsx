'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange, ShopifyProduct, ShopifyVariant } from '@/lib/types';
import {
  Search, Package, Loader2, Minus, Plus, Check, X,
  DollarSign, TrendingUp, Archive, Warehouse,
  ChevronDown, ChevronUp, ChevronRight, Layers, Sparkles,
} from 'lucide-react';

interface CostData {
  cost_price: number;
  category: string;
  notes: string | null;
  id: number;
}

type CostMap = Record<string, CostData>;
type CategoryFilter = 'all' | 'inventario' | 'inmovilizado';

// Costes predefinidos BAC '26 (lote Rockwear marzo 2026 + costes históricos)
const BAC26_COSTS: Array<{ matchTitle: RegExp; cost: number; note?: string }> = [
  { matchTitle: /Pingüino/i, cost: 10.67, note: 'Lote BAC 26 (Rockwear)' },
  { matchTitle: /GOD\s*Luck/i, cost: 17.82, note: 'Lote Ruleta BAC 26' },
  { matchTitle: /LongSleeve/i, cost: 25.00 },
  { matchTitle: /I THRIST|I\s*THIRST/i, cost: 16.00 },
  { matchTitle: /FAITH MOVE MOUNTAINS/i, cost: 4.50 },
  { matchTitle: /UN MINUTO/i, cost: 4.50 },
  { matchTitle: /VIA LUCIS/i, cost: 5.50 },
  { matchTitle: /Sudadera.*FAITH/i, cost: 18.00 },
  { matchTitle: /Sudadera.*Llenar/i, cost: 15.50 },
  { matchTitle: /Botella.*THIRST/i, cost: 9.97 },
  { matchTitle: /Pegatinas/i, cost: 0.26 },
  { matchTitle: /Rosario/i, cost: 1.15 },
  { matchTitle: /Denario/i, cost: 0.75 },
  { matchTitle: /Láminas|Lamina/i, cost: 0.28 },
  { matchTitle: /Libreta.*Ven y Verás/i, cost: 3.81 },
  { matchTitle: /Gorra/i, cost: 8.50 },
];

const TALLAS_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function InventarioPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [costMap, setCostMap] = useState<CostMap>({});
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Edit stock
  const [editingStockKey, setEditingStockKey] = useState<string | null>(null);
  const [targetStock, setTargetStock] = useState(0);
  const [savingStock, setSavingStock] = useState(false);

  // Edit cost
  const [editingCostKey, setEditingCostKey] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');
  const [editCostCategory, setEditCostCategory] = useState<'inventario' | 'inmovilizado'>('inventario');
  const [savingCost, setSavingCost] = useState(false);

  // Modal "Crear tallas"
  const [creatingSizesFor, setCreatingSizesFor] = useState<ShopifyProduct | null>(null);
  const [sizeData, setSizeData] = useState<Record<string, { enabled: boolean; qty: number }>>({});
  const [creatingSizes, setCreatingSizes] = useState(false);

  // Bulk apply costs
  const [applyingBulkCosts, setApplyingBulkCosts] = useState(false);

  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showMetrics, setShowMetrics] = useState(true);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  useEffect(() => { fetchProducts(false); }, [fetchProducts]);

  function toggleExpand(productId: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  // ============ STOCK EDIT (por variant) ============
  async function handleSaveVariantStock(product: ShopifyProduct, variant: ShopifyVariant) {
    setSavingStock(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_inventory',
          inventoryItemId: variant.inventory_item_id,
          targetStock,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSaveMsg({ type: 'success', text: `${product.title} ${variant.title !== 'Default Title' ? `[${variant.title}]` : ''} → ${targetStock} unidades` });
      await fetchProducts(true);
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setSavingStock(false);
      setEditingStockKey(null);
      setTargetStock(0);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  // ============ COST EDIT (por variant) ============
  async function handleSaveVariantCost(product: ShopifyProduct, variant: ShopifyVariant | null) {
    setSavingCost(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/product-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          shopify_product_id: product.id,
          shopify_variant_id: variant?.id || null,
          cost_price: parseFloat(editCostValue) || 0,
          category: editCostCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const key = variant?.id ? `${product.id}_${variant.id}` : `${product.id}`;
      setCostMap(prev => ({
        ...prev,
        [key]: {
          cost_price: parseFloat(editCostValue) || 0,
          category: editCostCategory,
          notes: null,
          id: data.cost?.id || 0,
        },
      }));
      setSaveMsg({ type: 'success', text: `Coste ${product.title} ${variant?.title && variant.title !== 'Default Title' ? `[${variant.title}]` : ''} → ${formatCurrency(parseFloat(editCostValue) || 0)}` });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setSavingCost(false);
      setEditingCostKey(null);
      setEditCostValue('');
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  // ============ BULK COSTS BAC 26 ============
  async function handleApplyBulkCosts() {
    if (!confirm('¿Aplicar costes BAC 26 a todos los productos coincidentes? Sobrescribirá costes actuales.')) return;
    setApplyingBulkCosts(true);
    setSaveMsg(null);
    try {
      const items: Array<{ shopify_product_id: number; shopify_variant_id?: number; cost_price: number; notes?: string }> = [];
      for (const p of products) {
        const match = BAC26_COSTS.find(c => c.matchTitle.test(p.title));
        if (!match) continue;
        // Aplicar a cada variant
        for (const v of (p.variants || [])) {
          items.push({
            shopify_product_id: p.id,
            shopify_variant_id: v.id,
            cost_price: match.cost,
            notes: match.note,
          });
        }
      }
      if (!items.length) {
        setSaveMsg({ type: 'error', text: 'Ningún producto coincide con BAC 26' });
        return;
      }
      const res = await fetch('/api/product-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_upsert', items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSaveMsg({ type: 'success', text: `${data.count || items.length} costes aplicados (BAC 26)` });
      await fetchProducts(false);
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setApplyingBulkCosts(false);
      setTimeout(() => setSaveMsg(null), 6000);
    }
  }

  // ============ CREAR TALLAS ============
  function openSizeCreator(product: ShopifyProduct) {
    const initial: Record<string, { enabled: boolean; qty: number }> = {};
    for (const t of TALLAS_DEFAULT) initial[t] = { enabled: false, qty: 0 };
    setSizeData(initial);
    setCreatingSizesFor(product);
  }

  async function handleCreateSizes() {
    if (!creatingSizesFor) return;
    const sizes = Object.entries(sizeData)
      .filter(([, v]) => v.enabled)
      .map(([title, v]) => ({ title, qty: v.qty }));
    if (!sizes.length) {
      setSaveMsg({ type: 'error', text: 'Selecciona al menos una talla' });
      return;
    }
    if (!confirm(`Crear ${sizes.length} variants en "${creatingSizesFor.title}". El variant actual "Default Title" se reemplazará. ¿Continuar?`)) return;
    setCreatingSizes(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_size_variants',
          productId: creatingSizesFor.id,
          sizes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSaveMsg({ type: 'success', text: `${sizes.length} tallas creadas en "${creatingSizesFor.title}"` });
      setCreatingSizesFor(null);
      await fetchProducts(true);
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message });
    } finally {
      setCreatingSizes(false);
      setTimeout(() => setSaveMsg(null), 6000);
    }
  }

  function getCost(productId: number, variantId?: number): CostData | null {
    if (variantId) {
      const k = `${productId}_${variantId}`;
      if (costMap[k]) return costMap[k];
    }
    return costMap[`${productId}`] || null;
  }

  // ============ FILTROS ============
  const filtered = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    const cost = getCost(p.id);
    return (cost?.category || 'inventario') === categoryFilter;
  });

  // ============ MÉTRICAS ============
  const totalStock = products.reduce((s, p) => s + (p.variants?.reduce((v, va) => v + (va.inventory_quantity || 0), 0) || 0), 0);
  const lowStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv > 0 && inv <= 5;
  }).length;
  const outOfStock = products.filter(p => {
    const inv = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
    return inv <= 0;
  }).length;

  let totalStockValue = 0, totalStockCost = 0;
  let totalInmovilizadoValue = 0, totalInmovilizadoCost = 0;
  let productsWithCost = 0;
  for (const p of products) {
    const productCost = getCost(p.id);
    let pHasCost = false;
    for (const v of (p.variants || [])) {
      const qty = v.inventory_quantity || 0;
      const price = parseFloat(v.price || '0');
      const cost = getCost(p.id, v.id) || productCost;
      const costPrice = cost?.cost_price || 0;
      const cat = cost?.category || 'inventario';
      if (cat === 'inmovilizado') {
        totalInmovilizadoValue += price * qty;
        totalInmovilizadoCost += costPrice * qty;
      } else {
        totalStockValue += price * qty;
        totalStockCost += costPrice * qty;
      }
      if (costPrice > 0) pHasCost = true;
    }
    if (pHasCost) productsWithCost++;
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleApplyBulkCosts}
              disabled={applyingBulkCosts || products.length === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg font-medium disabled:opacity-50"
              title="Aplica los costes BAC 26 (Pingüino, GOD LUCK, etc.) a todos los productos coincidentes"
            >
              {applyingBulkCosts ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Aplicar costes BAC 26
            </button>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-medium"
            >
              {showMetrics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showMetrics ? 'Ocultar métricas' : 'Ver métricas'}
            </button>
          </div>
        </div>

        {saveMsg && (
          <div className={`rounded-lg p-3 text-sm font-medium ${
            saveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveMsg.text}
          </div>
        )}

        {showMetrics && (
          <div className="space-y-4">
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-blue-500" />
                  <p className="text-xs text-gray-500 font-medium">Valor Stock (PVP)</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalStockValue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Ingreso potencial</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Archive size={14} className="text-orange-500" />
                  <p className="text-xs text-gray-500 font-medium">Inmovilizado (€ invertidos)</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalStockCost)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Coste × unidades</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-green-500" />
                  <p className="text-xs text-gray-500 font-medium">Beneficio Potencial</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalMargin)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{marginPercent.toFixed(1)}% margen</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse size={14} className="text-purple-500" />
                  <p className="text-xs text-gray-500 font-medium">Inmov. (categ.)</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-purple-700">{formatCurrency(totalInmovilizadoValue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Coste: {formatCurrency(totalInmovilizadoCost)}</p>
              </Card>
            </div>
          </div>
        )}

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
                    <th className="w-8"></th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Producto</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Variants</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Stock</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">PVP</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">Coste</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">Margen</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const totalInv = product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
                    const price = parseFloat(product.variants?.[0]?.price || '0');
                    const productCost = getCost(product.id);
                    const costPrice = productCost?.cost_price || 0;
                    const margin = costPrice > 0 ? price - costPrice : 0;
                    const marginPct = costPrice > 0 && price > 0 ? ((margin / price) * 100) : 0;
                    const isExpanded = expandedIds.has(product.id);
                    const hasMultipleVariants = (product.variants?.length || 0) > 1;
                    const hasOnlyDefault = (product.variants?.length || 0) === 1 && product.variants?.[0]?.title === 'Default Title';

                    return (
                      <>
                        <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-3">
                            {hasMultipleVariants ? (
                              <button
                                onClick={() => toggleExpand(product.id)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            ) : <span className="block w-6"></span>}
                          </td>
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
                                <span className="text-sm font-medium text-gray-900 truncate block max-w-[180px] sm:max-w-[260px]">
                                  {product.title}
                                </span>
                                <span className="text-xs text-gray-400">{product.product_type || ''}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-gray-500">
                            {product.variants?.length || 0}
                            {hasOnlyDefault && (
                              <Badge variant="warning" className="ml-1 text-[9px]">sin tallas</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                              totalInv <= 0 ? 'text-red-600 bg-red-50' :
                              totalInv <= 5 ? 'text-amber-600 bg-amber-50' :
                              'text-gray-700 bg-gray-50'
                            }`}>
                              {totalInv}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                            {formatCurrency(price)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <CostInlineEditor
                              variant={null}
                              product={product}
                              currentCost={costPrice}
                              currentCategory={(productCost?.category as any) || 'inventario'}
                              isEditing={editingCostKey === `${product.id}`}
                              editValue={editCostValue}
                              editCategory={editCostCategory}
                              saving={savingCost}
                              onStartEdit={() => {
                                setEditingCostKey(`${product.id}`);
                                setEditCostValue(costPrice > 0 ? costPrice.toString() : '');
                                setEditCostCategory((productCost?.category as any) || 'inventario');
                              }}
                              onChangeValue={setEditCostValue}
                              onChangeCategory={setEditCostCategory}
                              onCancel={() => { setEditingCostKey(null); setEditCostValue(''); }}
                              onSave={() => handleSaveVariantCost(product, null)}
                            />
                          </td>
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
                          <td className="px-3 py-3 text-center">
                            {hasOnlyDefault && (
                              <button
                                onClick={() => openSizeCreator(product)}
                                className="text-xs px-2 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded font-medium flex items-center gap-1 mx-auto"
                                title="Crear variants por talla"
                              >
                                <Layers size={12} />
                                Tallas
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Variants expandidos */}
                        {isExpanded && product.variants?.map((variant) => {
                          const vKey = `${product.id}_${variant.id}`;
                          const vCost = getCost(product.id, variant.id);
                          const vCostPrice = vCost?.cost_price || costPrice;
                          const vPrice = parseFloat(variant.price || '0');
                          const vQty = variant.inventory_quantity || 0;
                          const vMargin = vCostPrice > 0 ? vPrice - vCostPrice : 0;
                          const vMarginPct = vCostPrice > 0 && vPrice > 0 ? ((vMargin / vPrice) * 100) : 0;
                          const editingThisStock = editingStockKey === vKey;
                          const editingThisCost = editingCostKey === vKey;

                          return (
                            <tr key={vKey} className="border-b border-gray-50 bg-gray-50/40">
                              <td></td>
                              <td className="px-4 sm:px-6 py-2 pl-12">
                                <span className="text-xs text-gray-600">
                                  ↳ {variant.title}
                                  {variant.sku && <span className="ml-2 text-[10px] text-gray-400">SKU:{variant.sku}</span>}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                              <td className="px-3 py-2">
                                {editingThisStock ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={targetStock}
                                      onChange={(e) => setTargetStock(Math.max(0, parseInt(e.target.value) || 0))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveVariantStock(product, variant);
                                        if (e.key === 'Escape') { setEditingStockKey(null); setTargetStock(0); }
                                      }}
                                      className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-0.5"
                                      autoFocus
                                    />
                                    <button onClick={() => handleSaveVariantStock(product, variant)} disabled={savingStock} className="p-0.5 rounded bg-green-100 text-green-700">
                                      {savingStock ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                    </button>
                                    <button onClick={() => { setEditingStockKey(null); setTargetStock(0); }} className="p-0.5 rounded bg-gray-100 text-gray-500">
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingStockKey(vKey); setTargetStock(vQty); }}
                                    className={`block mx-auto text-xs font-semibold px-2 py-0.5 rounded hover:ring-1 hover:ring-violet-300 ${
                                      vQty <= 0 ? 'text-red-600 bg-red-50' :
                                      vQty <= 3 ? 'text-amber-600 bg-amber-50' :
                                      'text-gray-700 bg-white'
                                    }`}
                                  >
                                    {vQty}
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-gray-500">{formatCurrency(vPrice)}</td>
                              <td className="px-3 py-2 text-right">
                                <CostInlineEditor
                                  variant={variant}
                                  product={product}
                                  currentCost={vCost?.cost_price || 0}
                                  currentCategory={(vCost?.category as any) || 'inventario'}
                                  isEditing={editingThisCost}
                                  editValue={editCostValue}
                                  editCategory={editCostCategory}
                                  saving={savingCost}
                                  small
                                  onStartEdit={() => {
                                    setEditingCostKey(vKey);
                                    setEditCostValue(vCost?.cost_price ? vCost.cost_price.toString() : '');
                                    setEditCostCategory((vCost?.category as any) || 'inventario');
                                  }}
                                  onChangeValue={setEditCostValue}
                                  onChangeCategory={setEditCostCategory}
                                  onCancel={() => { setEditingCostKey(null); setEditCostValue(''); }}
                                  onSave={() => handleSaveVariantCost(product, variant)}
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                {vCostPrice > 0 ? (
                                  <div>
                                    <span className={`text-xs font-semibold ${vMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(vMargin)}
                                    </span>
                                    <span className="block text-[9px] text-gray-400">{vMarginPct.toFixed(0)}%</span>
                                  </div>
                                ) : <span className="text-xs text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2"></td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-sm text-gray-400">
                        Sin productos{categoryFilter !== 'all' ? ` en categoría "${categoryFilter}"` : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>{filtered.length} productos mostrados</span>
              <span>·</span>
              <span>Valor liquidación: <strong className="text-gray-700">{formatCurrency(totalStockValue)}</strong></span>
              <span>·</span>
              <span>Inmovilizado: <strong className="text-gray-700">{formatCurrency(totalStockCost)}</strong></span>
              {totalInmovilizadoValue > 0 && (
                <>
                  <span>·</span>
                  <span>Inmov. categ.: <strong className="text-purple-700">{formatCurrency(totalInmovilizadoValue)}</strong></span>
                </>
              )}
            </div>
          )}
        </Card>

        {/* Modal: Crear tallas */}
        {creatingSizesFor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Layers size={18} className="text-violet-600" />
                  Crear tallas en {creatingSizesFor.title}
                </h3>
                <button onClick={() => setCreatingSizesFor(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Marca las tallas y pon la cantidad. El variant actual <code className="bg-gray-100 px-1">Default Title</code> será reemplazado.
              </p>
              <div className="space-y-2">
                {TALLAS_DEFAULT.map(t => (
                  <div key={t} className={`flex items-center gap-3 p-2 rounded-lg border ${sizeData[t]?.enabled ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={sizeData[t]?.enabled || false}
                      onChange={(e) => setSizeData(prev => ({ ...prev, [t]: { ...prev[t], enabled: e.target.checked, qty: prev[t]?.qty || 0 } }))}
                    />
                    <span className="font-medium text-gray-900 w-12">{t}</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeData[t]?.qty || 0}
                      onChange={(e) => setSizeData(prev => ({ ...prev, [t]: { ...prev[t], enabled: prev[t]?.enabled || false, qty: parseInt(e.target.value) || 0 } }))}
                      disabled={!sizeData[t]?.enabled}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded disabled:bg-gray-100"
                      placeholder="Unidades"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setCreatingSizesFor(null)}
                  className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSizes}
                  disabled={creatingSizes}
                  className="flex-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creatingSizes && <Loader2 size={14} className="animate-spin" />}
                  Crear tallas en Shopify
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ===========================================
// Editor inline de coste reutilizable
// ===========================================
function CostInlineEditor(props: {
  variant: ShopifyVariant | null;
  product: ShopifyProduct;
  currentCost: number;
  currentCategory: 'inventario' | 'inmovilizado';
  isEditing: boolean;
  editValue: string;
  editCategory: 'inventario' | 'inmovilizado';
  saving: boolean;
  small?: boolean;
  onStartEdit: () => void;
  onChangeValue: (v: string) => void;
  onChangeCategory: (v: 'inventario' | 'inmovilizado') => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const sz = props.small ? 'text-xs' : 'text-sm';
  if (props.isEditing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          type="number"
          step="0.01"
          value={props.editValue}
          onChange={(e) => props.onChangeValue(e.target.value)}
          className={`w-16 text-right ${sz} border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') props.onSave();
            if (e.key === 'Escape') props.onCancel();
          }}
        />
        <select
          value={props.editCategory}
          onChange={(e) => props.onChangeCategory(e.target.value as any)}
          className="text-[10px] border border-gray-200 rounded px-0.5 py-0.5"
        >
          <option value="inventario">📦</option>
          <option value="inmovilizado">🏗️</option>
        </select>
        <button onClick={props.onSave} disabled={props.saving} className="p-0.5 rounded bg-green-100 text-green-700">
          {props.saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
        </button>
        <button onClick={props.onCancel} className="p-0.5 rounded bg-gray-100 text-gray-500">
          <X size={10} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={props.onStartEdit}
      className={`${sz} font-medium px-2 py-0.5 rounded hover:ring-1 hover:ring-violet-300 ${props.currentCost > 0 ? 'text-gray-700' : 'text-gray-300 italic'}`}
      title={props.currentCategory === 'inmovilizado' ? '🏗️ Inmovilizado' : '📦 Inventario'}
    >
      {props.currentCost > 0 ? formatCurrency(props.currentCost) : '—'}
    </button>
  );
}
