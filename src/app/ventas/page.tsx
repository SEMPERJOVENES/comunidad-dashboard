'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatDateTime, getDateRanges } from '@/lib/utils';
import { DateRange, PresentialSale, ShopifyProduct } from '@/lib/types';
import { Store, Plus, Loader2, Minus, Trash2, Check, Package, X, User, StickyNote } from 'lucide-react';

export default function VentasPresencialesPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [sales, setSales] = useState<PresentialSale[]>([]);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bizum' | 'efectivo' | 'transferencia'>('bizum');
  const [cashHolder, setCashHolder] = useState('');
  const [items, setItems] = useState<{ productId: number; productTitle: string; quantity: number; unitPrice: number; image?: string }[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const [salesRes, productsRes] = await Promise.all([
          fetch(`/api/ventas-presenciales?${params}`),
          fetch('/api/shopify/products'),
        ]);
        const salesData = await salesRes.json();
        const productsData = await productsRes.json();
        setSales(salesData.sales || []);
        setProducts(productsData.products || []);
      } catch {
        setSales([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  function addProduct(product: ShopifyProduct) {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      const price = parseFloat(product.variants?.[0]?.price || '0');
      setItems([...items, {
        productId: product.id,
        productTitle: product.title,
        quantity: 1,
        unitPrice: price,
        image: product.images?.[0]?.src,
      }]);
    }
  }

  function removeItem(productId: number) {
    setItems(items.filter(i => i.productId !== productId));
  }

  function adjustQty(productId: number, delta: number) {
    setItems(items.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }));
  }

  const totalItems = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalAmount = customAmount ? parseFloat(customAmount) : totalItems;

  async function handleSave() {
    if (!customerName.trim()) return;
    setSaving(true);
    try {
      const sale = {
        customerName: customerName.trim(),
        paymentMethod,
        totalAmount,
        items: items.map(({ image, ...rest }) => rest),
        notes: [
          notes.trim(),
          paymentMethod === 'efectivo' && cashHolder.trim() ? `💰 Efectivo con: ${cashHolder.trim()}` : '',
        ].filter(Boolean).join(' | ') || undefined,
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
      } else {
        alert('Error al guardar la venta. Revisa la conexión.');
      }
    } catch {
      alert('Error de conexión al guardar la venta.');
    } finally {
      setSaving(false);
    }
  }

  const totalRevenue = sales.reduce((s, sale) => s + sale.totalAmount, 0);
  const selectedProducts = items.map(i => i.productId);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Store size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ventas Presenciales</h1>
              <p className="text-sm text-gray-500">Bizum, efectivo, transferencia</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Ingresos Presenciales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Ventas Totales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{sales.length}</p>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500 font-medium">Ticket Medio</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {sales.length > 0 ? formatCurrency(totalRevenue / sales.length) : '—'}
            </p>
          </Card>
        </div>

        {/* New sale form */}
        {showForm && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Registrar Venta</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del cliente</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej: Sara Cuesta"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Método de pago</label>
                <div className="flex gap-2">
                  {(['bizum', 'efectivo', 'transferencia'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors font-medium ${
                        paymentMethod === method
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {method === 'bizum' ? '📱 Bizum' : method === 'efectivo' ? '💵 Efectivo' : '🏦 Transfer.'}
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

            {/* Visual product selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Seleccionar productos</label>
              <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
                {products.map(p => {
                  const isSelected = selectedProducts.includes(p.id);
                  const price = parseFloat(p.variants?.[0]?.price || '0');
                  const stock = p.variants?.reduce((s, v) => s + (v.inventory_quantity || 0), 0) || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
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
                  <div key={item.productId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <Package size={12} className="text-gray-400" />
                      </div>
                    )}
                    <span className="text-sm flex-1 truncate">{item.productTitle}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty(item.productId, -1)} className="p-1 rounded hover:bg-gray-200"><Minus size={12} /></button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => adjustQty(item.productId, 1)} className="p-1 rounded hover:bg-gray-200"><Plus size={12} /></button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                    <button onClick={() => removeItem(item.productId)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Importe total (override manual)</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={totalItems > 0 ? `Auto: ${totalItems.toFixed(2)}€` : '0.00'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                <div className="relative">
                  <StickyNote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: 6 pegatinas + 2 rosarios"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="text-lg font-bold text-gray-900">Total: {formatCurrency(totalAmount)}</div>
              <button
                onClick={handleSave}
                disabled={saving || !customerName.trim() || totalAmount <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Registrar Venta
              </button>
            </div>
          </Card>
        )}

        {/* Sales history */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Historial de Ventas</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando ventas...</span>
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
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDateTime(sale.date)}</td>
                      <td className="px-4 sm:px-6 py-3 text-sm font-medium text-gray-900">{sale.customerName}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <Badge variant={sale.paymentMethod === 'bizum' ? 'info' : sale.paymentMethod === 'efectivo' ? 'success' : 'purple'}>
                          {sale.paymentMethod === 'bizum' ? 'Bizum' : sale.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">
                        {sale.items?.length > 0
                          ? sale.items.map(i => `${i.quantity}x ${i.productTitle}`).join(', ')
                          : sale.notes || '—'
                        }
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">{formatCurrency(sale.totalAmount)}</td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
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
