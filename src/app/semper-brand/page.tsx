'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatNumber, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, ShoppingCart,
  Store, Landmark, Package, Loader2,
  BarChart3, Plus, Trash2, Truck, User, CreditCard, X, Check,
  ChevronDown, ChevronUp, RotateCcw, Warehouse, Gift, Sparkles, Archive,
} from 'lucide-react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface ShopifyOrder {
  id: number;
  name: string;
  customer: string;
  email: string;
  date: string;
  total: number;
  financialStatus: string;
  fulfillmentStatus: string;
  itemCount: number;
  items: string;
}

interface TransactionDetail {
  date: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  fee?: number;
  concept?: string;
}

interface StockValuation {
  units: number;
  retailValue: number;
  costValue: number;
  potentialProfit: number;
  potentialMargin: number;
  productsWithCost: number;
  productsWithoutCost: number;
  topByValue: Array<{ title: string; units: number; retail: number; cost: number; potentialProfit: number }>;
}

interface SemperBrandData {
  income: {
    shopify: number;
    shopifyOrders: number;
    shopifyPaidOrders: number;
    ventasPresenciales: number;
    ventasCount: number;
    bankIncome: Record<string, number>;
    totalBankIncome: number;
    total: number;
  };
  expenses: {
    byTag: Record<string, number>;
    total: number;
    stripeFees: number;
    stripeGross: number;
    stripeNet: number;
    shopifyRefunds: number;
    shopifyRefundCount: number;
  };
  profit: number;
  margin: number;
  giftLoss?: number;
  stockValuation?: StockValuation;
  monthlyBreakdown: {
    month: string;
    shopify: number;
    shopifyRefunds: number;
    ventas: number;
    bankIncome: number;
    expenses: number;
    stripeFees: number;
    orders: number;
    totalIncome: number;
    totalExpenses: number;
    profit: number;
  }[];
  topProducts: {
    title: string;
    revenue: number;
    units: number;
  }[];
  orders: ShopifyOrder[];
  transactions: {
    ventas: TransactionDetail[];
    bankIncome: Record<string, TransactionDetail[]>;
    bankExpense: Record<string, TransactionDetail[]>;
    stripeCharges: TransactionDetail[];
  };
}

interface BrandCost {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  product?: string;
}

interface BrandCostsData {
  costs: BrandCost[];
  byType: Record<string, number>;
  byMonth: Record<string, number>;
  total: number;
}

const COST_TYPES = [
  { value: 'cogs', label: 'Coste de Stock', icon: Package, color: 'text-orange-600' },
  { value: 'shipping', label: 'Envío', icon: Truck, color: 'text-blue-600' },
  { value: 'influencer', label: 'Influencer', icon: User, color: 'text-pink-600' },
  { value: 'shopify_fee', label: 'Comisión Shopify', icon: ShoppingCart, color: 'text-green-600' },
  { value: 'other', label: 'Otro Gasto', icon: CreditCard, color: 'text-gray-600' },
];

function MonthLabel({ month }: { month: string }) {
  const [year, m] = month.split('-');
  return <span>{MONTH_NAMES[parseInt(m) - 1]} {year.slice(2)}</span>;
}

function StatusBadge({ status, type }: { status: string; type: 'financial' | 'fulfillment' }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
    refunded: { label: 'Reembolsado', cls: 'bg-red-100 text-red-700' },
    partially_refunded: { label: 'Reemb. parcial', cls: 'bg-orange-100 text-orange-700' },
    pending: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
    fulfilled: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
    partial: { label: 'Parcial', cls: 'bg-orange-100 text-orange-700' },
    unfulfilled: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  };
  const s = map[status] || { label: status || '-', cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default function SemperBrandPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [data, setData] = useState<SemperBrandData | null>(null);
  const [costsData, setCostsData] = useState<BrandCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCost, setShowAddCost] = useState(false);
  const [costForm, setCostForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'cogs', description: '', amount: '', product: '' });
  const [showCostsList, setShowCostsList] = useState(false);
  const [expandedIncome, setExpandedIncome] = useState<string | null>(null);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: selectedRange.startDate.toISOString(),
        end: selectedRange.endDate.toISOString(),
      });
      const [brandRes, costsRes] = await Promise.all([
        fetch(`/api/semper-brand?${params}`),
        fetch(`/api/brand-costs?${params}`),
      ]);
      if (brandRes.ok) setData(await brandRes.json());
      if (costsRes.ok) setCostsData(await costsRes.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [selectedRange]);

  async function handleAddCost() {
    if (!costForm.amount || !costForm.description) return;
    await fetch('/api/brand-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...costForm, amount: parseFloat(costForm.amount) }),
    });
    setCostForm({ date: new Date().toISOString().split('T')[0], type: 'cogs', description: '', amount: '', product: '' });
    setShowAddCost(false);
    fetchAll();
  }

  async function handleDeleteCost(id: string) {
    await fetch('/api/brand-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    fetchAll();
  }

  // Combined P&L — método bruto
  const totalManualCosts = costsData?.total || 0;
  const stripeFees = data?.expenses.stripeFees || 0;
  const shopifyRefunds = data?.expenses.shopifyRefunds || 0;
  const giftLoss = data?.giftLoss || 0;
  const totalExpenses = (data?.expenses.total || 0) + totalManualCosts + stripeFees + shopifyRefunds + giftLoss;
  const totalIncome = data?.income.total || 0;
  const netProfit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  const stockVal = data?.stockValuation;

  const incomeBreakdown = useMemo(() => {
    if (!data) return [];
    const items: { key: string; label: string; amount: number; icon: any; color: string; bg: string; detail: string; transactions: TransactionDetail[] }[] = [];
    if (data.income.shopify > 0) {
      const shopifyTxs = data.orders.map(o => ({ date: o.date, description: `${o.name} — ${o.customer}`, amount: o.total }));
      items.push({ key: 'shopify', label: 'Shopify', amount: data.income.shopify, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50', detail: `${data.income.shopifyOrders} pedidos`, transactions: shopifyTxs });
    }
    if (data.income.ventasPresenciales > 0) {
      items.push({ key: 'ventas', label: 'Ventas Presenciales', amount: data.income.ventasPresenciales, icon: Store, color: 'text-emerald-600', bg: 'bg-emerald-50', detail: `${data.income.ventasCount} ventas`, transactions: data.transactions.ventas });
    }
    Object.entries(data.income.bankIncome).forEach(([tag, amount]) => {
      const txs = (data.transactions.bankIncome[tag] || []).map(t => ({ date: t.date, description: t.concept || t.description, amount: t.amount }));
      items.push({ key: `bank-${tag}`, label: tag, amount, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', detail: `${txs.length} movimientos`, transactions: txs });
    });
    return items.sort((a, b) => b.amount - a.amount);
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    if (!data) return [];
    const items: { key: string; tag: string; amount: number; transactions: TransactionDetail[] }[] = [];
    // Devoluciones Shopify como gasto
    if (data.expenses.shopifyRefunds > 0) {
      const refundTxs = data.orders.filter(o => o.financialStatus === 'refunded' || o.financialStatus === 'partially_refunded')
        .map(o => ({ date: o.date, description: `${o.name} — ${o.customer}`, amount: o.total }));
      items.push({ key: 'shopify-refunds', tag: '↩️ Devoluciones Shopify', amount: data.expenses.shopifyRefunds, transactions: refundTxs });
    }
    Object.entries(data.expenses.byTag).forEach(([tag, amount]) => {
      const txs = (data.transactions.bankExpense[tag] || []).map(t => ({ date: t.date, description: t.concept || t.description, amount: t.amount }));
      items.push({ key: `bank-${tag}`, tag, amount, transactions: txs });
    });
    // Stripe fees como categoría de gasto
    if (data.expenses.stripeFees > 0) {
      items.push({ key: 'stripe-fees', tag: '💳 Comisión Stripe', amount: data.expenses.stripeFees, transactions: data.transactions.stripeCharges.map(t => ({ date: t.date, description: t.description, amount: t.fee || 0 })) });
    }
    // Regalos (pérdida por coste producción)
    if ((data.giftLoss || 0) > 0) {
      const giftTxs = data.transactions.ventas.filter((v: any) => v.saleType === 'regalo' || v.paymentMethod === 'regalo')
        .map((v: any) => ({ date: v.date, description: `🎁 ${v.description}`, amount: v.costLoss || 0 }));
      items.push({ key: 'gift-loss', tag: '🎁 Regalos (coste prod.)', amount: data.giftLoss || 0, transactions: giftTxs });
    }
    if (costsData) {
      Object.entries(costsData.byType).forEach(([type, amount]) => {
        const ct = COST_TYPES.find(c => c.value === type);
        const txs = costsData.costs.filter(c => c.type === type).map(c => ({ date: c.date, description: c.description, amount: c.amount }));
        items.push({ key: `manual-${type}`, tag: `📦 ${ct?.label || type}`, amount, transactions: txs });
      });
    }
    return items.sort((a, b) => b.amount - a.amount);
  }, [data, costsData]);

  const maxMonthlyIncome = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.monthlyBreakdown.map(m => m.totalIncome), 1);
  }, [data]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Store size={24} className="text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Semper Brand — P&L</h1>
              <p className="text-sm text-gray-500">Pérdidas y ganancias con costes de producto</p>
            </div>
          </div>
          <button onClick={() => setShowAddCost(!showAddCost)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Plus size={16} /> Añadir Coste
          </button>
        </div>

        {/* Add Cost Form */}
        {showAddCost && (
          <Card className="border-2 border-indigo-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Registrar Coste de Brand</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input type="date" value={costForm.date} onChange={e => setCostForm({ ...costForm, date: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={costForm.type} onChange={e => setCostForm({ ...costForm, type: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {COST_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
              <input type="text" value={costForm.description} onChange={e => setCostForm({ ...costForm, description: e.target.value })}
                placeholder="Descripción (ej: 50 camisetas)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="number" step="0.01" value={costForm.amount} onChange={e => setCostForm({ ...costForm, amount: e.target.value })}
                placeholder="Importe €" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" value={costForm.product} onChange={e => setCostForm({ ...costForm, product: e.target.value })}
                placeholder="Producto (opcional)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button onClick={handleAddCost} disabled={!costForm.amount || !costForm.description}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1">
                  <Check size={14} /> Guardar
                </button>
                <button onClick={() => setShowAddCost(false)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={28} />
            <span className="ml-3 text-gray-500">Cargando datos financieros...</span>
          </div>
        ) : !data ? (
          <Card><p className="text-center text-gray-400 py-12">No se pudieron cargar los datos</p></Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Card className="!p-4 border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-gray-400 mt-1">{data.income.shopifyOrders + data.income.ventasCount} operaciones</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Gastos Totales</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                  {shopifyRefunds > 0 && <p>↩️ Devoluciones: {formatCurrency(shopifyRefunds)}</p>}
                  {data.expenses.total > 0 && <p>Banco: {formatCurrency(data.expenses.total)}</p>}
                  {stripeFees > 0 && <p>Comisión Stripe: {formatCurrency(stripeFees)}</p>}
                  {giftLoss > 0 && <p>🎁 Regalos: {formatCurrency(giftLoss)}</p>}
                  {totalManualCosts > 0 && <p>Manuales: {formatCurrency(totalManualCosts)}</p>}
                </div>
              </Card>
              <Card className={`!p-4 border-l-4 ${netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-gray-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Beneficio · {margin.toFixed(1)}%</p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </Card>
            </div>

            {/* P&L Formula visual */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg py-2 px-4 overflow-x-auto">
              <span className="text-emerald-600 font-semibold whitespace-nowrap">{formatCurrency(totalIncome)}</span>
              {shopifyRefunds > 0 && (<><span>−</span><span className="text-rose-500 font-semibold whitespace-nowrap">{formatCurrency(shopifyRefunds)} <span className="font-normal text-gray-400">devol.</span></span></>)}
              <span>−</span>
              <span className="text-orange-600 font-semibold whitespace-nowrap">{formatCurrency(data.expenses.total)}</span>
              {stripeFees > 0 && (<><span>−</span><span className="text-purple-600 font-semibold whitespace-nowrap">{formatCurrency(stripeFees)} <span className="font-normal text-gray-400">Stripe</span></span></>)}
              {giftLoss > 0 && (<><span>−</span><span className="text-amber-600 font-semibold whitespace-nowrap">{formatCurrency(giftLoss)} <span className="font-normal text-gray-400">regalos</span></span></>)}
              {totalManualCosts > 0 && (<><span>−</span><span className="text-red-600 font-semibold whitespace-nowrap">{formatCurrency(totalManualCosts)}</span></>)}
              <span>=</span>
              <span className={`font-bold whitespace-nowrap ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(netProfit)}</span>
            </div>

            {/* === STOCK & INVERSIÓN === */}
            {stockVal && stockVal.units > 0 && (
              <Card className="!p-0 overflow-hidden border-l-4 border-l-indigo-500">
                <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-white p-4 border-b border-indigo-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Warehouse size={16} className="text-indigo-600" />
                      <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Stock & Inversión Inmovilizada</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{stockVal.units.toLocaleString('es-ES')} unidades</span>
                      <span>·</span>
                      <span>{stockVal.productsWithCost} productos con coste · {stockVal.productsWithoutCost} sin coste</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-gray-100">
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Archive size={12} className="text-orange-500" />
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">€ Invertidos</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-orange-700">{formatCurrency(stockVal.costValue)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Capital atrapado en stock</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign size={12} className="text-blue-500" />
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Ingreso Potencial</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-blue-700">{formatCurrency(stockVal.retailValue)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Si se vendiera todo a PVP</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={12} className="text-emerald-500" />
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Beneficio Potencial</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-700">{formatCurrency(stockVal.potentialProfit)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{stockVal.potentialMargin.toFixed(1)}% margen</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={12} className="text-violet-500" />
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">ROI Stock</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-violet-700">
                      {stockVal.costValue > 0
                        ? `${((stockVal.potentialProfit / stockVal.costValue) * 100).toFixed(0)}%`
                        : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Retorno sobre inversión</p>
                  </div>
                </div>
                {stockVal.topByValue.length > 0 && (
                  <div className="p-4 border-t border-gray-100">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Top productos por valor potencial</p>
                    <div className="space-y-2">
                      {stockVal.topByValue.slice(0, 6).map((p, i) => {
                        const pct = stockVal.retailValue > 0 ? (p.retail / stockVal.retailValue) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-5">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-medium text-gray-900 truncate">{p.title}</span>
                                <div className="text-right ml-2">
                                  <span className="text-xs font-bold text-blue-700">{formatCurrency(p.retail)}</span>
                                  <span className="text-[10px] text-gray-400 ml-1">({p.units} uds)</span>
                                </div>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            {p.cost > 0 && (
                              <span className="text-[10px] text-emerald-600 font-medium">+{formatCurrency(p.potentialProfit)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Gift loss banner si hay pérdida por regalos */}
            {giftLoss > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                <Gift size={18} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">Pérdida por regalos</p>
                  <p className="text-xs text-amber-700">Coste de producción de unidades regaladas (no genera ingreso)</p>
                </div>
                <p className="text-lg font-bold text-amber-700">-{formatCurrency(giftLoss)}</p>
              </div>
            )}

            {/* SECCIÓN: Movimientos bancarios Brand (DETALLE) */}
            <Card className="!p-0 overflow-hidden border-l-4 border-l-amber-500">
              <div className="bg-gradient-to-r from-amber-50 to-white p-4 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-amber-600" />
                  <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Movimientos bancarios — Brand</span>
                  <span className="ml-auto text-[11px] text-gray-500">Sólo cuentan transacciones del banco etiquetadas como Brand · NO se duplican con Shopify+Presencial arriba</span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-100">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-emerald-700 uppercase">Ingresos al banco (Brand)</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.income.totalBankIncome)}</p>
                  </div>
                  {Object.entries(data.income.bankIncome).length > 0 ? (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {Object.entries(data.income.bankIncome).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([tag, amt]) => {
                        const txs = data.transactions.bankIncome[tag] || [];
                        return (
                          <details key={tag} className="border border-emerald-100 rounded-lg overflow-hidden">
                            <summary className="px-3 py-2 cursor-pointer hover:bg-emerald-50 flex items-center justify-between text-xs">
                              <span className="font-medium text-gray-700">{tag} <span className="text-gray-400">({txs.length})</span></span>
                              <span className="font-bold text-emerald-700">{formatCurrency(amt as number)}</span>
                            </summary>
                            <div className="px-3 py-2 bg-gray-50/50 max-h-48 overflow-y-auto space-y-0.5">
                              {txs.slice(0, 30).map((tx, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                  <span className="text-gray-500 truncate max-w-[260px]">{new Date(tx.date).toLocaleDateString('es-ES')} · {tx.concept || tx.description}</span>
                                  <span className="font-medium">{formatCurrency(tx.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-gray-400">Sin movimientos brand</p>}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-rose-700 uppercase">Gastos del banco (Brand)</p>
                    <p className="text-lg font-bold text-rose-700">-{formatCurrency(data.expenses.total)}</p>
                  </div>
                  {Object.entries(data.expenses.byTag).length > 0 ? (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {Object.entries(data.expenses.byTag).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([tag, amt]) => {
                        const txs = data.transactions.bankExpense[tag] || [];
                        return (
                          <details key={tag} className="border border-rose-100 rounded-lg overflow-hidden">
                            <summary className="px-3 py-2 cursor-pointer hover:bg-rose-50 flex items-center justify-between text-xs">
                              <span className="font-medium text-gray-700">{tag} <span className="text-gray-400">({txs.length})</span></span>
                              <span className="font-bold text-rose-700">-{formatCurrency(amt as number)}</span>
                            </summary>
                            <div className="px-3 py-2 bg-gray-50/50 max-h-48 overflow-y-auto space-y-0.5">
                              {txs.slice(0, 30).map((tx, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                  <span className="text-gray-500 truncate max-w-[260px]">{new Date(tx.date).toLocaleDateString('es-ES')} · {tx.concept || tx.description}</span>
                                  <span className="font-medium">-{formatCurrency(tx.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-gray-400">Sin gastos brand</p>}
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-600 flex items-center justify-between">
                <span>Neto banco brand: <strong className={`${(data.income.totalBankIncome - data.expenses.total) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(data.income.totalBankIncome - data.expenses.total)}</strong></span>
                <span className="text-gray-400">Verificar la cifra de inversión Rockwear (lote BAC 26 ≈ 1.816 €) aparece en gastos arriba</span>
              </div>
            </Card>

            {/* Flujo de Comisiones Stripe */}
            {data.expenses.stripeGross > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-white rounded-xl border border-purple-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={14} className="text-purple-500" />
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Flujo de Ventas Online (Stripe)</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase">Cobrado (bruto)</p>
                    <p className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(data.expenses.stripeGross)}</p>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-red-400 uppercase">Comisión Stripe</p>
                    <p className="text-base sm:text-lg font-bold text-red-500">-{formatCurrency(stripeFees)}</p>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-emerald-500 uppercase">Payout (neto)</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-600">{formatCurrency(data.expenses.stripeNet)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-gray-400 uppercase">% Comisión</p>
                    <p className="text-base sm:text-lg font-bold text-purple-600">
                      {(data.expenses.stripeGross > 0 ? (stripeFees / data.expenses.stripeGross) * 100 : 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Income & Expenses Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Desglose Ingresos */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      Desglose de Ingresos
                    </div>
                  </CardTitle>
                  <Badge variant="success">{formatCurrency(totalIncome)}</Badge>
                </CardHeader>
                <div className="space-y-3">
                  {incomeBreakdown.map((item) => {
                    const pct = totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0;
                    const isExpanded = expandedIncome === item.key;
                    return (
                      <div key={item.key}>
                        <button
                          onClick={() => setExpandedIncome(isExpanded ? null : item.key)}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-md ${item.bg} flex items-center justify-center`}>
                                <item.icon size={14} className={item.color} />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-800">{item.label}</span>
                                <span className="text-xs text-gray-400 ml-2">{item.detail}</span>
                              </div>
                              {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                              <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                        {isExpanded && item.transactions.length > 0 && (
                          <div className="mt-2 ml-9 space-y-0.5 max-h-60 overflow-y-auto">
                            {item.transactions.map((tx, j) => (
                              <div key={j} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-gray-50 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-gray-400 flex-shrink-0">{new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                  <span className="text-gray-700 truncate">{tx.description}</span>
                                </div>
                                <span className="text-gray-900 font-medium flex-shrink-0 ml-2">{formatCurrency(tx.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {incomeBreakdown.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ingresos en este período</p>
                  )}
                </div>
              </Card>

              {/* Desglose Gastos */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={16} className="text-red-500" />
                      Desglose de Gastos
                    </div>
                  </CardTitle>
                  <Badge variant="danger">{formatCurrency(totalExpenses)}</Badge>
                </CardHeader>
                <div className="space-y-3">
                  {expenseBreakdown.map((item, i) => {
                    const pct = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;
                    const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400', 'bg-indigo-400'];
                    const isExpanded = expandedExpense === item.key;
                    return (
                      <div key={item.key}>
                        <button
                          onClick={() => setExpandedExpense(isExpanded ? null : item.key)}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                              <span className="text-sm font-medium text-gray-800">{item.tag}</span>
                              {isExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                              <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                        {isExpanded && item.transactions.length > 0 && (
                          <div className="mt-2 ml-5 space-y-0.5 max-h-60 overflow-y-auto">
                            {item.transactions.map((tx, j) => (
                              <div key={j} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-gray-50 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-gray-400 flex-shrink-0">{new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                  <span className="text-gray-700 truncate">{tx.description}</span>
                                </div>
                                <span className="text-red-600 font-medium flex-shrink-0 ml-2">-{formatCurrency(tx.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {expenseBreakdown.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin gastos en este período</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Manual Costs List */}
            {costsData && costsData.costs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-orange-500" />
                      Costes Manuales de Brand
                    </div>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{formatCurrency(totalManualCosts)}</Badge>
                    <button onClick={() => setShowCostsList(!showCostsList)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {showCostsList ? 'Ocultar' : `Ver ${costsData.costs.length} registros`}
                    </button>
                  </div>
                </CardHeader>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                  {COST_TYPES.map(ct => {
                    const amt = costsData.byType[ct.value] || 0;
                    if (amt === 0) return null;
                    return (
                      <div key={ct.value} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <ct.icon size={14} className={ct.color} />
                        <div>
                          <p className="text-[10px] text-gray-500">{ct.label}</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(amt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {showCostsList && (
                  <div className="overflow-x-auto -mx-4 sm:-mx-6">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Fecha</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Tipo</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Descripción</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Importe</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {costsData.costs.map(c => {
                          const ct = COST_TYPES.find(t => t.value === c.type);
                          return (
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                              <td className="px-4 sm:px-6 py-2 text-sm text-gray-600">{c.date}</td>
                              <td className="px-4 sm:px-6 py-2">
                                <span className="text-xs font-medium text-gray-700">{ct?.label || c.type}</span>
                              </td>
                              <td className="px-4 sm:px-6 py-2 text-sm text-gray-800">{c.description}</td>
                              <td className="px-4 sm:px-6 py-2 text-sm text-right font-semibold text-red-600">{formatCurrency(c.amount)}</td>
                              <td className="px-2">
                                <button onClick={() => handleDeleteCost(c.id)}
                                  className="p-1.5 text-gray-300 hover:text-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Monthly Breakdown - CHART FIXED */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-500" />
                    Evolución Mensual
                  </div>
                </CardTitle>
              </CardHeader>

              {data.monthlyBreakdown.length > 0 && (
                <div className="mb-6">
                  <div className="flex gap-1 sm:gap-2 h-40 sm:h-48">
                    {data.monthlyBreakdown.map((m) => {
                      const monthCosts = costsData?.byMonth[m.month] || 0;
                      const incomeH = (m.totalIncome / maxMonthlyIncome) * 100;
                      const totalExp = m.totalExpenses + monthCosts;
                      const expenseH = maxMonthlyIncome > 0 ? (totalExp / maxMonthlyIncome) * 100 : 0;
                      return (
                        <div key={m.month} className="flex-1 h-full flex flex-col items-center group relative">
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                              <p className="font-medium"><MonthLabel month={m.month} /></p>
                              <p className="text-emerald-300">Ingresos: {formatCurrency(m.totalIncome)}</p>
                              {m.shopifyRefunds > 0 && <p className="text-rose-300">Devoluciones: {formatCurrency(m.shopifyRefunds)}</p>}
                              <p className="text-red-300">Gastos banco: {formatCurrency(m.expenses)}</p>
                              {m.stripeFees > 0 && <p className="text-purple-300">Stripe fees: {formatCurrency(m.stripeFees)}</p>}
                              {monthCosts > 0 && <p className="text-orange-300">Costes manual: {formatCurrency(monthCosts)}</p>}
                              <p className={m.totalIncome - totalExp >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                Beneficio: {formatCurrency(m.totalIncome - totalExp)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full flex gap-0.5 items-end flex-1 min-h-0">
                            <div className="flex-1 bg-emerald-400 rounded-t-sm transition-all hover:bg-emerald-500"
                              style={{ height: `${Math.max(incomeH, 2)}%` }} />
                            <div className="flex-1 bg-red-300 rounded-t-sm transition-all hover:bg-red-400"
                              style={{ height: `${Math.max(expenseH, 2)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 flex-shrink-0"><MonthLabel month={m.month} /></span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-xs text-gray-500">Ingresos</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-300" /><span className="text-xs text-gray-500">Gastos</span></div>
                  </div>
                </div>
              )}

              {/* Monthly Table */}
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Mes</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Shopify</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Presencial</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Banco</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ingresos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Gastos</th>
                      <th className="text-right text-xs font-medium text-purple-500 px-4 sm:px-6 py-2">Comisión</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Costes</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Beneficio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyBreakdown.map((m) => {
                      const monthCosts = costsData?.byMonth[m.month] || 0;
                      const totalExp = m.totalExpenses + monthCosts;
                      const profit = m.totalIncome - totalExp;
                      return (
                        <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-800"><MonthLabel month={m.month} /></td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.shopify > 0 ? formatCurrency(m.shopify) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.ventas > 0 ? formatCurrency(m.ventas) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.bankIncome > 0 ? formatCurrency(m.bankIncome) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right font-semibold text-gray-900">{formatCurrency(m.totalIncome)}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-red-500">{(m.expenses + m.shopifyRefunds) > 0 ? `-${formatCurrency(m.expenses + m.shopifyRefunds)}` : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-purple-500">{m.stripeFees > 0 ? `-${formatCurrency(m.stripeFees)}` : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-orange-500">{monthCosts > 0 ? `-${formatCurrency(monthCosts)}` : '-'}</td>
                          <td className={`px-4 sm:px-6 py-2.5 text-sm text-right font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.monthlyBreakdown.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                        <td className="px-4 sm:px-6 py-3 text-sm font-bold text-gray-900">Total</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold">{formatCurrency(data.income.shopify)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold">{formatCurrency(data.income.ventasPresenciales)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold">{formatCurrency(data.income.totalBankIncome)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-emerald-600">{formatCurrency(totalIncome)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-red-600">-{formatCurrency(data.expenses.total + shopifyRefunds)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-purple-600">-{formatCurrency(stripeFees)}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-orange-600">-{formatCurrency(totalManualCosts)}</td>
                        <td className={`px-4 sm:px-6 py-3 text-sm text-right font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(netProfit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Top Products */}
            {data.topProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-indigo-500" />
                      Top Productos
                    </div>
                  </CardTitle>
                  <Badge variant="purple">{data.topProducts.length} productos</Badge>
                </CardHeader>
                <div className="space-y-2.5">
                  {data.topProducts.map((product, i) => {
                    const maxRev = data!.topProducts[0].revenue;
                    const pct = maxRev > 0 ? (product.revenue / maxRev) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                            <span className="text-sm font-medium text-gray-800 truncate max-w-[200px] sm:max-w-none">{product.title}</span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</span>
                            <span className="text-xs text-gray-400 ml-1.5">{formatNumber(product.units)} uds</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-7">
                          <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
