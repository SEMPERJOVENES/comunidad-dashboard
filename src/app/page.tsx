'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import RevenueChart from '@/components/dashboard/RevenueChart';
import TopProducts from '@/components/dashboard/TopProducts';
import RecentOrders from '@/components/dashboard/RecentOrders';
import { DateRange, RevenueDataPoint, TopProduct, ShopifyOrder } from '@/lib/types';
import { getDefaultRange, formatCurrency } from '@/lib/utils';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, Church, Store,
  Landmark, ChevronDown, ChevronRight, Package,
  Calendar, CreditCard,
} from 'lucide-react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_TABS = [2023, 2024, 2025, 2026];

function getMonthFilters(year: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const maxMonth = year === currentYear ? now.getMonth() : 11;
  const filters: { label: string; key: string; start: Date; end: Date }[] = [];
  filters.push({
    label: `${year}`,
    key: 'year',
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59),
  });
  for (let m = 0; m <= maxMonth; m++) {
    const lastDay = new Date(year, m + 1, 0);
    filters.push({
      label: MONTH_NAMES[m],
      key: `m-${m}`,
      start: new Date(year, m, 1),
      end: new Date(year, m, lastDay.getDate(), 23, 59, 59),
    });
  }
  return filters;
}

interface TagTransaction { date: string; description: string; amount: number }

interface MacroGroup {
  income: number;
  expenses: number;
  net: number;
  tags: { tag: string; income: number; expenses: number; net: number; transactions: TagTransaction[] }[];
}

interface DashboardData {
  financials: { totalIncome: number; totalExpenses: number; profit: number; bankBalance: number };
  macroGroups: { diezmos: MacroGroup; brand: MacroGroup; otros: MacroGroup };
  caja: { tag: string; net: number; count: number; transactions: TagTransaction[] }[];
  cajaMacro: { comunidad: number; brand: number; otros: number };
  stripe: { volume: number; available: number; pending: number };
  shopify: { revenue: number; orders: number; stockValue: number; stockCost: number; totalUnits: number; productCount: number };
  revenueData: RevenueDataPoint[];
  topProducts: TopProduct[];
  recentOrders: ShopifyOrder[];
}

const TAG_COLORS: Record<string, string> = {
  'Diezmo': 'bg-violet-500', 'Donativo': 'bg-pink-500', 'Brand': 'bg-indigo-500',
  'Shopify': 'bg-green-500', 'Stripe': 'bg-blue-500', 'Bizum': 'bg-cyan-500',
  'Transferencia': 'bg-teal-500', 'Misa/Tabor': 'bg-amber-500', 'Retiros': 'bg-orange-500',
  'Viajes': 'bg-rose-500', 'Música': 'bg-fuchsia-500', 'Nómina': 'bg-red-500',
  'Material': 'bg-yellow-500', 'Comisión bancaria': 'bg-gray-400', 'BAC': 'bg-emerald-500',
  'Gasto operativo': 'bg-slate-500', 'Venta presencial': 'bg-lime-500',
  'Semper CD': 'bg-purple-500', 'Proveedor': 'bg-zinc-500', 'Alquiler': 'bg-stone-500',
};

export default function DashboardPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [expandedCajaTag, setExpandedCajaTag] = useState<string | null>(null);
  const [showAllCaja, setShowAllCaja] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState('year');

  const monthFilters = useMemo(() => getMonthFilters(selectedYear), [selectedYear]);

  const effectiveRange = useMemo(() => {
    const mf = monthFilters.find(f => f.key === monthFilter);
    if (mf) return { start: mf.start, end: mf.end };
    return { start: selectedRange.startDate, end: selectedRange.endDate };
  }, [monthFilter, monthFilters, selectedRange]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: effectiveRange.start.toISOString(),
          end: effectiveRange.end.toISOString(),
        });
        const res = await fetch(`/api/dashboard?${params}`);
        if (!res.ok) throw new Error('Error al cargar datos');
        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [effectiveRange]);

  function toggleGroup(g: string) {
    setExpandedGroup(expandedGroup === g ? null : g);
  }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Year + Month Filter Tabs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Calendar size={16} className="text-gray-400 flex-shrink-0" />
            <div className="flex gap-1 flex-nowrap">
              {YEAR_TABS.map((y) => (
                <button
                  key={y}
                  onClick={() => { setSelectedYear(y); setMonthFilter('year'); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                    selectedYear === y
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 pl-7">
            {monthFilters.filter(mf => mf.key !== 'year').map((mf) => (
              <button
                key={mf.key}
                onClick={() => setMonthFilter(mf.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  monthFilter === mf.key
                    ? 'bg-violet-100 text-violet-700 border border-violet-200'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {mf.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando datos...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        ) : data ? (
          <>
            {/* === KPI CARDS: Ingresos, Gastos, Beneficio, Saldo Banco === */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="!p-4 border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Ingresos Totales</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(data.financials.totalIncome)}</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Gastos Totales</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(data.financials.totalExpenses)}</p>
              </Card>
              <Card className={`!p-4 border-l-4 ${data.financials.profit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={14} className="text-gray-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Beneficio</p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${data.financials.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(data.financials.profit)}
                </p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark size={14} className="text-blue-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Saldo Banco</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(data.financials.bankBalance)}</p>
              </Card>
            </div>

            {/* === STRIPE KPIs === */}
            {data.stripe && (data.stripe.available > 0 || data.stripe.pending > 0 || data.stripe.volume > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card className="!p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={14} className="text-violet-500" />
                    <p className="text-xs font-medium text-gray-500 uppercase">Stripe Disponible</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-violet-600">{formatCurrency(data.stripe.available)}</p>
                </Card>
                <Card className="!p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={14} className="text-amber-500" />
                    <p className="text-xs font-medium text-gray-500 uppercase">Stripe Pendiente</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">{formatCurrency(data.stripe.pending)}</p>
                </Card>
                <Card className="!p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={14} className="text-blue-500" />
                    <p className="text-xs font-medium text-gray-500 uppercase">Volumen Stripe</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(data.stripe.volume)}</p>
                </Card>
              </div>
            )}

            {/* Cajas eliminadas por pedido del usuario */}

            {/* === MACRO GROUPS: Diezmos, Brand, Otros === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Comunidad */}
              <Card className="!p-0 overflow-hidden">
                <button onClick={() => toggleGroup('diezmos')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Church size={20} className="text-violet-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Comunidad</p>
                      <p className={`text-lg font-bold ${data.macroGroups.diezmos.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(data.macroGroups.diezmos.net)}
                      </p>
                    </div>
                  </div>
                  {expandedGroup === 'diezmos' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </button>
                <div className="px-4 pb-2 flex gap-4 text-xs border-t border-gray-50 pt-2">
                  <span className="text-emerald-600">▲ {formatCurrency(data.macroGroups.diezmos.income)}</span>
                  <span className="text-red-500">▼ {formatCurrency(data.macroGroups.diezmos.expenses)}</span>
                </div>
                {expandedGroup === 'diezmos' && data.macroGroups.diezmos.tags.length > 0 && (
                  <div className="px-4 pb-4 space-y-1">
                    {data.macroGroups.diezmos.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag}>
                        <button onClick={() => setExpandedTag(expandedTag === `d-${t.tag}` ? null : `d-${t.tag}`)}
                          className="w-full flex items-center justify-between text-xs py-1 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                            <span className="text-gray-700">{t.tag}</span>
                            <span className="text-gray-400">({t.transactions.length})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
                            {expandedTag === `d-${t.tag}` ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          </div>
                        </button>
                        {expandedTag === `d-${t.tag}` && t.transactions.length > 0 && (
                          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-gray-100 pl-3">
                            {t.transactions.map((tx, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                  <span className="truncate">{tx.description || '—'}</span>
                                </div>
                                <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Brand */}
              <Card className="!p-0 overflow-hidden">
                <button onClick={() => toggleGroup('brand')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Store size={20} className="text-indigo-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Semper Brand</p>
                      <p className={`text-lg font-bold ${data.macroGroups.brand.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(data.macroGroups.brand.net)}
                      </p>
                    </div>
                  </div>
                  {expandedGroup === 'brand' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </button>
                <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs border-t border-gray-50 pt-2">
                  <span className="text-emerald-600">▲ {formatCurrency(data.macroGroups.brand.income)}</span>
                  <span className="text-red-500">▼ {formatCurrency(data.macroGroups.brand.expenses)}</span>
                  {data.shopify.stockValue > 0 && (
                    <>
                      <span className="text-indigo-600" title="Stock a precio de venta">📦 Valor: {formatCurrency(data.shopify.stockValue)}</span>
                      {data.shopify.stockCost > 0 && (
                        <span className="text-gray-500" title="Stock a precio de coste">Coste: {formatCurrency(data.shopify.stockCost)}</span>
                      )}
                    </>
                  )}
                </div>
                {expandedGroup === 'brand' && data.macroGroups.brand.tags.length > 0 && (
                  <div className="px-4 pb-4 space-y-1">
                    {data.macroGroups.brand.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag}>
                        <button onClick={() => setExpandedTag(expandedTag === `b-${t.tag}` ? null : `b-${t.tag}`)}
                          className="w-full flex items-center justify-between text-xs py-1 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                            <span className="text-gray-700">{t.tag}</span>
                            <span className="text-gray-400">({t.transactions.length})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
                            {expandedTag === `b-${t.tag}` ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          </div>
                        </button>
                        {expandedTag === `b-${t.tag}` && t.transactions.length > 0 && (
                          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-gray-100 pl-3">
                            {t.transactions.map((tx, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                  <span className="truncate">{tx.description || '—'}</span>
                                </div>
                                <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Otros */}
              <Card className="!p-0 overflow-hidden">
                <button onClick={() => toggleGroup('otros')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Package size={20} className="text-amber-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Otros</p>
                      <p className={`text-lg font-bold ${data.macroGroups.otros.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(data.macroGroups.otros.net)}
                      </p>
                    </div>
                  </div>
                  {expandedGroup === 'otros' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </button>
                <div className="px-4 pb-2 flex gap-4 text-xs border-t border-gray-50 pt-2">
                  <span className="text-emerald-600">▲ {formatCurrency(data.macroGroups.otros.income)}</span>
                  <span className="text-red-500">▼ {formatCurrency(data.macroGroups.otros.expenses)}</span>
                </div>
                {expandedGroup === 'otros' && data.macroGroups.otros.tags.length > 0 && (
                  <div className="px-4 pb-4 space-y-1">
                    {data.macroGroups.otros.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag}>
                        <button onClick={() => setExpandedTag(expandedTag === `o-${t.tag}` ? null : `o-${t.tag}`)}
                          className="w-full flex items-center justify-between text-xs py-1 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                            <span className="text-gray-700">{t.tag}</span>
                            <span className="text-gray-400">({t.transactions.length})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
                            {expandedTag === `o-${t.tag}` ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          </div>
                        </button>
                        {expandedTag === `o-${t.tag}` && t.transactions.length > 0 && (
                          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-gray-100 pl-3">
                            {t.transactions.map((tx, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                  <span className="truncate">{tx.description || '—'}</span>
                                </div>
                                <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* === CAJA: Desglose del saldo bancario por categoría === */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-blue-500" />
                    Caja — Desglose por Categoría
                  </div>
                </CardTitle>
                <Badge variant={data.financials.bankBalance >= 0 ? 'success' : 'danger'}>
                  Saldo: {formatCurrency(data.financials.bankBalance)}
                </Badge>
              </CardHeader>
              <div className="space-y-2">
                {(showAllCaja ? data.caja : data.caja.slice(0, 8)).map(item => {
                  const maxAbs = Math.max(...data.caja.map(c => Math.abs(c.net)), 1);
                  const pct = (Math.abs(item.net) / maxAbs) * 100;
                  const isExpanded = expandedCajaTag === item.tag;
                  return (
                    <div key={item.tag}>
                      <button onClick={() => setExpandedCajaTag(isExpanded ? null : item.tag)}
                        className="w-full text-left hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${TAG_COLORS[item.tag] || 'bg-gray-400'}`} />
                            <span className="text-xs font-medium text-gray-700">{item.tag}</span>
                            <span className="text-[10px] text-gray-400">({item.count})</span>
                            {isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          </div>
                          <span className={`text-sm font-semibold ${item.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {item.net >= 0 ? '+' : ''}{formatCurrency(item.net)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${item.net >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </button>
                      {isExpanded && item.transactions && item.transactions.length > 0 && (
                        <div className="ml-5 mt-1.5 mb-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                          {item.transactions.map((tx, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                <span className="truncate">{tx.description || '—'}</span>
                              </div>
                              <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                              </span>
                            </div>
                          ))}
                          {item.count > 20 && (
                            <p className="text-[10px] text-gray-400 pt-1">Mostrando 20 de {item.count} movimientos</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {data.caja.length > 8 && (
                <button onClick={() => setShowAllCaja(!showAllCaja)}
                  className="mt-3 text-xs text-violet-600 hover:text-violet-800 font-medium">
                  {showAllCaja ? 'Ver menos' : `Ver todas (${data.caja.length})`}
                </button>
              )}
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart data={data.revenueData} />
              <TopProducts products={data.topProducts} />
            </div>

            <RecentOrders orders={data.recentOrders} />
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
