'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange, ShopifyProduct, ShopifyVariant } from '@/lib/types';
import {
  Tag, Loader2, Search, Edit3, Check, X, Package, Save, AlertCircle,
} from 'lucide-react';

interface CostData {
  cost_price: number;
  category: string;
  notes: string | null;
  id: number;
  price_community?: number;
}

type CostMap = Record<string, CostData>;

export default function PreciosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [costMap, setCostMap] = useState<CostMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ pvp?: string; coste?: string; comunidad?: string }>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [prodRes, costRes] = await Promise.all([
        fetch('/api/shopify/products'),
        fetch('/api/product-costs'),
      ]);
      const p = await prodRes.json();
      const c = await costRes.json();
      setProducts(p.products || []);
      setCostMap(c.costMap || {});
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  function getCost(productId: number, variantId?: number) {
    if (variantId) {
      const k = `${productId}_${variantId}`;
      if (costMap[k]) return costMap[k];
    }
    return costMap[`${productId}`];
  }

  async function handleSave(product: ShopifyProduct) {
    setSaving(true);
    setMsg(null);
    try {
      const variantId = product.variants?.[0]?.id;
      const newCost = parseFloat(draft.coste || '0') || 0;
      const newPvp = parseFloat(draft.pvp || '0') || 0;

      // 1. Actualizar coste en product_costs
      if (newCost >= 0) {
        await fetch('/api/product-costs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert',
            shopify_product_id: product.id,
            shopify_variant_id: variantId || null,
            cost_price: newCost,
            category: getCost(product.id, variantId)?.category || 'inventario',
          }),
        });
      }

      // 2. Actualizar PVP en Shopify (todas las variants)
      if (newPvp > 0 && product.variants) {
        for (const v of product.variants) {
          await fetch(`/api/shopify/products`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set_variant_price',
              variantId: v.id,
              price: newPvp.toFixed(2),
            }),
          }).catch(() => {});
        }
      }

      setMsg({ type: 'ok', text: `${product.title} actualizado` });
      setEditing(null);
      setDraft({});
      await fetchAll();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  const filtered = products.filter(p => {
    if (!search) return true;
    return p.title.toLowerCase().includes(search.toLowerCase());
  });

  // Agregados
  const totalCoste = products.reduce((s, p) => {
    const cost = getCost(p.id, p.variants?.[0]?.id) || getCost(p.id);
    if (cost?.category === 'preproduccion' || cost?.category === 'inmovilizado') return s;
    const totalUnits = p.variants?.reduce((u, v) => u + (v.inventory_quantity || 0), 0) || 0;
    return s + (cost?.cost_price || 0) * totalUnits;
  }, 0);
  const totalPVP = products.reduce((s, p) => {
    const cost = getCost(p.id, p.variants?.[0]?.id) || getCost(p.id);
    if (cost?.category === 'preproduccion' || cost?.category === 'inmovilizado') return s;
    const totalUnits = p.variants?.reduce((u, v) => u + (v.inventory_quantity || 0), 0) || 0;
    const price = parseFloat(p.variants?.[0]?.price || '0');
    return s + price * totalUnits;
  }, 0);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Tag size={20} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Tabla de precios</h1>
            <p className="text-sm text-gray-500">Coste, PVP y precio comunidad por artículo · click para editar</p>
          </div>
          <a href="/products" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Ver inventario completo →</a>
        </div>

        {/* Stats top */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Productos activos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Excl. preproducción/inmovilizado</p>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <p className="text-xs text-gray-500 font-medium">Total invertido (stock)</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(totalCoste)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Coste × unidades</p>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <p className="text-xs text-gray-500 font-medium">Valor potencial PVP</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalPVP)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Si vendemos todo a PVP</p>
          </Card>
        </div>

        {msg && (
          <div className={`px-4 py-2 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..."
            className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Tabla precios */}
        <Card>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-600" /></div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Producto</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-3 py-3">Estado</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-3 py-3">Stock</th>
                    <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-orange-50/50">Coste</th>
                    <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-blue-50/50">PVP online</th>
                    <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-violet-50/50">PVP comunidad</th>
                    <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-emerald-50/50">Margen</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-3 py-3 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const cost = getCost(p.id, p.variants?.[0]?.id) || getCost(p.id);
                    const pvp = parseFloat(p.variants?.[0]?.price || '0');
                    const coste = cost?.cost_price || 0;
                    const margen = coste > 0 ? pvp - coste : 0;
                    const margenPct = coste > 0 && pvp > 0 ? (margen / pvp) * 100 : 0;
                    const totalStock = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
                    const isEditing = editing === String(p.id);
                    const isPreproduccion = cost?.category === 'preproduccion';
                    const isInmovilizado = cost?.category === 'inmovilizado';

                    return (
                      <tr key={p.id} className={`border-b border-gray-50 hover:bg-violet-50/20 ${isPreproduccion || isInmovilizado ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {p.images?.[0]?.src ? (
                              <img src={p.images[0].src} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={14} className="text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{p.title}</p>
                              {(p.variants?.length || 0) > 1 && <p className="text-[10px] text-gray-400">{p.variants?.length} variants</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isPreproduccion ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Preventa</span> :
                           isInmovilizado ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">Inmovilizado</span> :
                           <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Activo</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-sm font-semibold">{totalStock}</td>
                        <td className="px-3 py-2 text-right bg-orange-50/20">
                          {isEditing ? (
                            <input type="number" step="0.01" value={draft.coste ?? coste} onChange={e => setDraft({...draft, coste: e.target.value})}
                              className="w-20 text-right px-2 py-1 text-sm border border-violet-300 rounded" />
                          ) : (
                            <span className="text-sm font-semibold text-orange-700">{coste > 0 ? formatCurrency(coste) : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-blue-50/20">
                          {isEditing ? (
                            <input type="number" step="0.01" value={draft.pvp ?? pvp} onChange={e => setDraft({...draft, pvp: e.target.value})}
                              className="w-20 text-right px-2 py-1 text-sm border border-violet-300 rounded" />
                          ) : (
                            <span className="text-sm font-semibold text-blue-700">{formatCurrency(pvp)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-violet-50/20">
                          <span className="text-sm text-gray-400 italic">{coste > 0 ? formatCurrency(coste + ((pvp - coste) * 0.4)) : '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-right bg-emerald-50/20">
                          {coste > 0 ? (
                            <div>
                              <span className={`text-sm font-semibold ${margen >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(margen)}</span>
                              <span className="block text-[10px] text-gray-400">{margenPct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-sm text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleSave(p)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={() => { setEditing(null); setDraft({}); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditing(String(p.id)); setDraft({ coste: String(coste || ''), pvp: String(pvp || '') }); }}
                              className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Edit3 size={14} /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-3 px-4 flex items-center gap-1">
            <AlertCircle size={11} />
            Editar coste actualiza Supabase. Editar PVP intenta actualizar Shopify (requiere scope write_products).
            Precio comunidad es informativo (40% del margen sobre coste).
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}
