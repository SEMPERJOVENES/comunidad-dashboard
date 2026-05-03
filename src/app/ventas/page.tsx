'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime, getDefaultRange } from '@/lib/utils';
import { DateRange, PresentialSale, ShopifyProduct, ShopifyVariant } from '@/lib/types';
import {
  Store, Plus, Loader2, Minus, Trash2, Check, Package, X,
  User, StickyNote, Calendar, Gift, AlertTriangle, TrendingDown,
} from 'lucide-react';

type PaymentMethod = 'bizum' | 'efectivo' | 'transferencia' | 'regalo';

interface CartItem {
  productId: number;
  variantId?: number;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  image?: string;
}

interface PresentialSaleEx extends PresentialSale {
  saleType?: 'venta' | 'regalo';
  costLoss?: number;
}

export default function VentasPresencialesPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [sales, setSales] = useState<PresentialSaleEx[]>([]);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [costMap, setCostMap] = useState<Record<string, { cost_price: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bizum');
  const [cashHolder, setCashHolder] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [variantPickerFor, setVariantPickerFor] = useState<ShopifyProduct | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const [salesRes, productsRes, costsRes] = await Promise.all([
          fetch(`/api/ventas-presenciales?${params}`),
          fetch('/api/shopify/products'),
          fetch('/api/product-costs'),
        ]);
        const salesData = await salesRes.json();
        const productsData = await productsRes.json();
        const costsData = await costsRes.json();
        setSales(salesData.sales || []);
        setProducts(productsData.products || []);
        setCostMap(costsData.costMap || {});
      } catch {
        setSales([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  function getCostFor(productId: number, variantId?: number): number {
    if (variantId) {
      const k = `${productId}_${variantId}`;
      if (costMap[k]?.cost_price) return costMap[k].cost_price;
    }
    return costMap[`${productId}`]?.cost_price || 0;
  }

  function selectProduct(product: ShopifyProduct) {
    const variants = product.variants || [];
    if (variants.length > 1) {
      setVariantPickerFor(product);
      return;
    }
    addProduct(product, variants[0]);
  }

  function addProduct(product: ShopifyProduct, variant?: ShopifyVariant) {
    const variantId = variant?.id;
    const existing = items.find(i => i.productId === product.id && i.variantId === variantId);
    if (existing) {
      setItems(items.map(i =>
        i.productId === product.id && i.variantId === variantId
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      const price = parseFloat(variant?.price || product.variants?.[0]?.price || '0');
      setItems([...items, {
        productId: product.id,
        variantId,
        productTitle: product.title,
        variantTitle: variant?.title && variant.title !== 'Default Title' ? variant.title : undefined,
        quantity: 1,
        unitPrice: price,
        unitCost: getCostFor(product.id, variantId),
        image: product.images?.[0]?.src,
      }]);
    }
    setVariantPickerFor(null);
  }

  function removeItem(productId: number, variantId?: number) {
    setItems(items.filter(i => !(i.productId === productId && i.variantId === variantId)));
  }

  function adjustQty(productId: number, variantId: number | undefined, delta: number) {
    setItems(items.map(i => {
      if (i.productId !== productId || i.variantId !== variantId) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }));
  }

  const isRegalo = paymentMethod === 'regalo';
  const totalItemsRetail = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalItemsCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const totalAmount = isRegalo ? 0 : (customAmount ? parseFloat(customAmount) : totalItemsRetail);
  const costLoss = isRegalo ? totalItemsCost : 0;

  async function handleSave() {
    if (!customerName.trim()) return;
    setSaving(true);
    try {
      const sale = {
        customerName: customerName.trim(),
        paymentMethod,
        totalAmount,
        date: new Date(saleDate + 'T12:00:00').toISOString(),
        items: items.map(({ image, ...rest }) => rest),
        notes: [
          notes.trim(),
          paymentMethod === 'efectivo' && cashHolder.trim() ? `💰 Efectivo con: ${cashHolder.trim()}` : '',
          isRegalo ? `🎁 REGALO · Pérdida coste: ${costLoss.toFixed(2)}€` : '',
        ].filter(Boolean).join(' | ') || undefined,
        saleType: isRegalo ? 'regalo' : 'venta',
        costLoss,
      };
      const res = await fetch('/api/ventas-presenciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale),
      });
      if (res.ok) {
        const data = await res.json();
        setSales([data.sale, ...sales]);
        setShowForm(false);
        setCustomerName('');
        setItems([]);
        setCustomAmount('');
        setNotes('');
        setCashHolder('');
        setSaleDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('bizum');
      } else {
        alert('Error al guardar la venta. Revisa la conexión.');
      }
    } catch {
      alert('Error de conexión al guardar la venta.');
    } finally {
      setSaving(false);
    }
  }

  const totalRevenue = sales.filter(s => (s as any).saleType !== 'regalo' && s.paymentMethod !== 'regalo').reduce((s, sale) => s + sale.totalAmount, 0);
  const totalGiftLoss = sales.filter(s => (s as any).saleType === 'regalo' || s.paymentMethod === 'regalo').reduce((s, sale) => s + ((sale as any).costLoss || 0), 0);
  const numGifts = sales.filter(s => (s as any).saleType === 'regalo' || s.paymentMethod === 'regalo').length;
  const numSales = sales.length - numGifts;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Store size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ventas Presenciales</h1>
              <p className="text-sm text-gray-500">Bizum, efectivo, transferencia, regalo</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancelar' : 'Nueva Venta'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Ingresos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{numSales} ventas</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Ticket Medio</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {numSales > 0 ? formatCurrency(totalRevenue / numSales) : '—'}
            </p>
          </Card>
          <Card className="border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-1.5">
              <Gift size={14} className="text-amber-600" />
              <p className="text-xs text-amber-700 font-medium">Regalos</p>
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-1">{numGifts}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">unidades regaladas</p>
          </Card>
          <Card className="border-red-200 bg-red-50/30">
            <div className="flex items-center gap-1.5">
              <TrendingDown size={14} className="text-red-600" />
              <p className="text-xs text-red-700 font-medium">Pérdida regalos</p>
            </div>
            <p className="text-2xl font-bold text-red-700 mt-1">-{formatCurrency(totalGiftLoss)}</p>
            <p className="text-[10px] text-red-600 mt-0.5">coste producción</p>
          </Card>
        </div>

        {/* New sale form */}
        {showForm && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {isRegalo ? '🎁 Registrar Regalo' : 'Registrar Venta'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del cliente</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={isRegalo ? 'Ej: Salva (regalo familiar)' : 'Ej: Sara Cuesta'}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Método de pago</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['bizum', 'efectivo', 'transferencia', 'regalo'] as PaymentMethod[]).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-2 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
                        paymentMethod === method
                          ? method === 'regalo'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {method === 'bizum' ? '📱 Bizum'
                        : method === 'efectivo' ? '💵 Efectivo'
                        : method === 'transferencia' ? '🏦 Transfer.'
                        : '🎁 Regalo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cash holder note */}
            {paymentMethod === 'efectivo' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="block text-xs font-medium text-amber-700 mb-1">💰 ¿Quién tiene el efectivo?</label>
                <input
                  type="text"
                  value={cashHolder}
                  onChange={(e) => setCashHolder(e.target.value)}
                  placeholder="Ej: Gonzalo, caja fuerte, sacristía..."
                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>
            )}

            {/* Gift warning */}
            {isRegalo && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <strong>Modo regalo:</strong> ingreso = 0 €. Se registra la pérdida de coste de producción ({formatCurrency(costLoss)}). El stock baja igualmente.
                  {totalItemsCost === 0 && items.length > 0 && (
                    <div className="mt-1 text-red-600">⚠️ Los productos seleccionados no tienen coste de producción asignado. Configúralo en Inventario.</div>
                  )}
                </div>
              </div>
            )}

            {/* Visual product selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Seleccionar productos</label>
              <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
                {products.map(p => {
                  const isSelected = items.some(i => i.productId === p.id);
                  const price = parseFloat(p.variants?.[0]?.price || '0');
                  const stock = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
                  const hasMultipleVariants = (p.variants?.length || 0) > 1;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className={`flex-shrink-0 snap-start w-28 sm:w-32 rounded-xl border-2 transition-all overflow-hidden ${
                        isSelected
                          ? 'border-violet-500 ring-2 ring-violet-200 shadow-md'
                          : 'border-gray-100 hover:border-violet-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="aspect-square bg-gray-50 relative">
                        {p.images?.[0]?.src ? (
                          <img src={p.images[0].src} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={24} className="text-gray-300" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        {hasMultipleVariants && (
                          <div className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] px-1 rounded">
                            {p.variants?.length} tallas
                          </div>
                        )}
                        {stock <= 0 && (
                          <div className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-[10px] text-center py-0.5">
                            Agotado
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-gray-900 truncate">{p.title}</p>
                        <p className="text-[11px] font-bold text-violet-600">{formatCurrency(price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected items */}
            {items.length > 0 && (
              <div className="mb-4 space-y-2">
                <label className="block text-xs font-medium text-gray-500">Artículos ({items.length})</label>
                {items.map(item => (
                  <div key={`${item.productId}_${item.variantId || 'default'}`} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <Package size={12} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm block truncate">{item.productTitle}</span>
                      {item.variantTitle && <span className="text-[10px] text-gray-500">{item.variantTitle}</span>}
                      {isRegalo && item.unitCost > 0 && (
                        <span className="text-[10px] text-red-600 ml-2">-{formatCurrency(item.unitCost * item.quantity)} coste</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty(item.productId, item.variantId, -1)} className="p-1 rounded hover:bg-gray-200"><Minus size={12} /></button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => adjustQty(item.productId, item.variantId, 1)} className="p-1 rounded hover:bg-gray-200"><Plus size={12} /></button>
                    </div>
                    <span className={`text-sm font-semibold w-16 text-right ${isRegalo ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                    <button onClick={() => removeItem(item.productId, item.variantId)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {!isRegalo && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Importe total (override manual)</label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={totalItemsRetail > 0 ? `Auto: ${totalItemsRetail.toFixed(2)}€` : '0.00'}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
              <div className={isRegalo ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                <div className="relative">
                  <StickyNote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRegalo ? 'Ej: regalo a hermanas comunidad' : 'Ej: 6 pegatinas + 2 rosarios'}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {isRegalo ? (
                <div>
                  <div className="text-xs text-gray-500">Valor regalado (PVP)</div>
                  <div className="text-base font-medium text-gray-700 line-through">{formatCurrency(totalItemsRetail)}</div>
                  <div className="text-sm text-red-600 font-semibold mt-1">Pérdida coste: -{formatCurrency(costLoss)}</div>
                </div>
              ) : (
                <div className="text-lg font-bold text-gray-900">Total: {formatCurrency(totalAmount)}</div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !customerName.trim() || (!isRegalo && totalAmount <= 0) || (isRegalo && items.length === 0)}
                className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
                  isRegalo ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : isRegalo ? <Gift size={16} /> : <Check size={16} />}
                {isRegalo ? 'Registrar Regalo' : 'Registrar Venta'}
              </button>
            </div>
          </Card>
        )}

        {/* Variant picker modal */}
        {variantPickerFor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setVariantPickerFor(null)}>
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{variantPickerFor.title}</h3>
                <button onClick={() => setVariantPickerFor(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Elige talla</p>
              <div className="grid grid-cols-3 gap-2">
                {variantPickerFor.variants?.map(v => (
                  <button
                    key={v.id}
                    onClick={() => addProduct(variantPickerFor, v)}
                    disabled={(v.inventory_quantity || 0) <= 0}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-violet-50 hover:border-violet-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="font-semibold">{v.title}</div>
                    <div className="text-[10px] text-gray-400">stock: {v.inventory_quantity || 0}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sales history */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Historial</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fecha</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Método</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Artículos</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Importe</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const sType = (sale as any).saleType || (sale.paymentMethod === 'regalo' ? 'regalo' : 'venta');
                    const cLoss = (sale as any).costLoss || 0;
                    return (
                      <tr key={sale.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${sType === 'regalo' ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDateTime(sale.date)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm font-medium text-gray-900">{sale.customerName}</td>
                        <td className="px-4 sm:px-6 py-3">
                          {sType === 'regalo' ? (
                            <Badge variant="warning">🎁 Regalo</Badge>
                          ) : (
                            <Badge variant={sale.paymentMethod === 'bizum' ? 'info' : sale.paymentMethod === 'efectivo' ? 'success' : 'purple'}>
                              {sale.paymentMethod === 'bizum' ? 'Bizum' : sale.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">
                          {sale.items?.length > 0
                            ? sale.items.map((i: any) => `${i.quantity}x ${i.productTitle}${i.variantTitle ? ` [${i.variantTitle}]` : ''}`).join(', ')
                            : sale.notes || '—'}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">
                          {sType === 'regalo' ? (
                            <span className="text-red-600">-{formatCurrency(cLoss)}</span>
                          ) : (
                            formatCurrency(sale.totalAmount)
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {sType === 'regalo' ? (
                            <span className="text-[10px] text-amber-700">Pérdida coste</span>
                          ) : (sale as any).bankTransactionId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-100">
                              <Check size={10} /> Conciliado
                            </span>
                          ) : sale.paymentMethod !== 'efectivo' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-500 border border-amber-100">
                              Pendiente
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        Sin ventas presenciales registradas
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
