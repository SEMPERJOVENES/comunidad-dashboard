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
  CreditCard, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Cake,
} from 'lucide-react';

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

const MACRO_CONFIG = {
  diezmos: { label: 'Comunidad', icon: Church, color: 'violet', bg: 'bg-violet-50', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', border: 'border-violet-200', ring: 'ring-violet-500', barBg: 'bg-violet-100', barFill: 'bg-violet-500' },
  brand: { label: 'Semper Brand', icon: Store, color: 'indigo', bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', border: 'border-indigo-200', ring: 'ring-indigo-500', barBg: 'bg-indigo-100', barFill: 'bg-indigo-500' },
  otros: { label: 'Otros', icon: Package, color: 'amber', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', border: 'border-amber-200', ring: 'ring-amber-500', barBg: 'bg-amber-100', barFill: 'bg-amber-500' },
};

const MNAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MSHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function DashboardPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [expandedCajaTag, setExpandedCajaTag] = useState<string | null>(null);
  const [showAllCaja, setShowAllCaja] = useState(false);
  const [birthdayMembers, setBirthdayMembers] = useState<{ nombre: string; apellido: string; fecha_nacimiento: string }[]>([]);

  const periodLabel = useMemo(() => {
    const s = selectedRange.startDate;
    const e = selectedRange.endDate;
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${MNAMES[s.getMonth()]} ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${MSHORT[s.getMonth()]} – ${MSHORT[e.getMonth()]} ${s.getFullYear()}`;
    }
    return `${MSHORT[s.getMonth()]} ${s.getFullYear()} – ${MSHORT[e.getMonth()]} ${e.getFullYear()}`;
  }, [selectedRange]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
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
  }, [selectedRange]);

  useEffect(() => {
    fetch('/api/community-members')
      .then(r => r.json())
      .then(json => {
        const currentMonth = new Date().getMonth() + 1;
        const thisMonth = (json.members || []).filter((m: any) =>
          parseInt(m.fecha_nacimiento.split('-')[1]) === currentMonth
        );
        setBirthdayMembers(thisMonth);
      })
      .catch(() => {});
  }, []);

  const analysis = useMemo(() => {
    if (!data) return null;
    const { diezmos, brand, otros } = data.macroGroups;
    const totalIncome = diezmos.income + brand.income + otros.income;
    const totalExpenses = diezmos.expenses + brand.expenses + otros.expenses;
    return {
      totalIncome,
      totalExpenses,
      areas: [
        { key: 'diezmos' as const, ...diezmos, pctIncome: totalIncome > 0 ? (diezmos.income / totalIncome) * 100 : 0 },
        { key: 'brand' as const, ...brand, pctIncome: totalIncome > 0 ? (brand.income / totalIncome) * 100 : 0 },
        { key: 'otros' as const, ...otros, pctIncome: totalIncome > 0 ? (otros.income / totalIncome) * 100 : 0 },
      ],
    };
  }, [data]);

  function toggleGroup(g: string) {
    setExpandedGroup(expandedGroup === g ? null : g);
    setExpandedTag(null);
  }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando informe...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        ) : data && analysis ? (
          <>
            {/* ══════ RESUMEN GENERAL ══════ */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                      <BarChart3 size={18} className="text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Informe Económico</h2>
                      <p className="text-xs text-gray-500">{periodLabel}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${data.financials.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {data.financials.profit >= 0 ? '+' : ''}{formatCurrency(data.financials.profit)}
                  </div>
                </div>
              </div>

              {/* KPIs compactos */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ArrowUpRight size={12} className="text-emerald-500" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Ingresos</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">{formatCurrency(data.financials.totalIncome)}</p>
                </div>
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ArrowDownRight size={12} className="text-red-500" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Gastos</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(data.financials.totalExpenses)}</p>
                </div>
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Wallet size={12} className="text-gray-400" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Beneficio</p>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold ${data.financials.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(data.financials.profit)}
                  </p>
                </div>
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Landmark size={12} className="text-blue-500" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">Saldo Banco</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(data.financials.bankBalance)}</p>
                </div>
              </div>

              {/* Distribución visual */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Distribución de ingresos</p>
                <div className="h-3 rounded-full overflow-hidden flex bg-gray-200">
                  {analysis.areas.map(a => {
                    const cfg = MACRO_CONFIG[a.key];
                    if (a.pctIncome < 1) return null;
                    return (
                      <div key={a.key} className={`${cfg.barFill} transition-all duration-500`} style={{ width: `${a.pctIncome}%` }} title={`${cfg.label}: ${a.pctIncome.toFixed(1)}%`} />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {analysis.areas.map(a => {
                    const cfg = MACRO_CONFIG[a.key];
                    return (
                      <div key={a.key} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <div className={`w-2 h-2 rounded-full ${cfg.barFill}`} />
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-gray-400">{a.pctIncome.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ══════ STRIPE + STOCK ══════ */}
            {(data.stripe.available > 0 || data.stripe.pending > 0 || data.shopify.stockValue > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.stripe.available > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CreditCard size={11} className="text-violet-500" />
                      <p className="text-[10px] font-medium text-gray-400 uppercase">Stripe Disp.</p>
                    </div>
                    <p className="text-base font-bold text-violet-600">{formatCurrency(data.stripe.available)}</p>
                  </div>
                )}
                {data.stripe.pending > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CreditCard size={11} className="text-amber-500" />
                      <p className="text-[10px] font-medium text-gray-400 uppercase">Stripe Pend.</p>
                    </div>
                    <p className="text-base font-bold text-amber-600">{formatCurrency(data.stripe.pending)}</p>
                  </div>
                )}
                {data.shopify.stockValue > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Package size={11} className="text-indigo-500" />
                      <p className="text-[10px] font-medium text-gray-400 uppercase">Stock Valor</p>
                    </div>
                    <p className="text-base font-bold text-indigo-600">{formatCurrency(data.shopify.stockValue)}</p>
                  </div>
                )}
                {data.shopify.stockCost > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Package size={11} className="text-gray-400" />
                      <p className="text-[10px] font-medium text-gray-400 uppercase">Stock Coste</p>
                    </div>
                    <p className="text-base font-bold text-gray-600">{formatCurrency(data.shopify.stockCost)}</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════ P&L POR ÁREA ══════ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <PieChart size={16} className="text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">P&L por Área</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(['diezmos', 'brand', 'otros'] as const).map(key => {
                  const group = data.macroGroups[key];
                  const cfg = MACRO_CONFIG[key];
                  const Icon = cfg.icon;
                  const isExpanded = expandedGroup === key;
                  const maxIncome = Math.max(group.income, group.expenses, 1);
                  return (
                    <div key={key} className={`bg-white rounded-2xl border ${isExpanded ? cfg.border : 'border-gray-200'} overflow-hidden transition-all shadow-sm`}>
                      <button onClick={() => toggleGroup(key)} className={`w-full text-left p-4 sm:p-5 transition-colors ${isExpanded ? cfg.bg : 'hover:bg-gray-50'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center`}>
                              <Icon size={20} className={cfg.iconColor} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{cfg.label}</p>
                              <p className={`text-xl font-bold ${group.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {group.net >= 0 ? '+' : ''}{formatCurrency(group.net)}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown size={16} className="text-gray-400 mt-1" /> : <ChevronRight size={16} className="text-gray-400 mt-1" />}
                        </div>
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-12 flex-shrink-0">Ingreso</span>
                            <div className={`flex-1 h-2 rounded-full ${cfg.barBg} overflow-hidden`}>
                              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(group.income / maxIncome) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-emerald-600 w-16 text-right flex-shrink-0">{formatCurrency(group.income)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-12 flex-shrink-0">Gasto</span>
                            <div className={`flex-1 h-2 rounded-full ${cfg.barBg} overflow-hidden`}>
                              <div className="h-full rounded-full bg-red-400 transition-all duration-500" style={{ width: `${(group.expenses / maxIncome) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-red-500 w-16 text-right flex-shrink-0">{formatCurrency(group.expenses)}</span>
                          </div>
                        </div>
                      </button>
                      {isExpanded && group.tags.length > 0 && (
                        <div className="px-4 sm:px-5 pb-4 space-y-1 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-3 pb-1">Desglose por categoría</p>
                          {group.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => {
                            const tagKey = `${key[0]}-${t.tag}`;
                            const isTagExpanded = expandedTag === tagKey;
                            return (
                              <div key={t.tag}>
                                <button onClick={(e) => { e.stopPropagation(); setExpandedTag(isTagExpanded ? null : tagKey); }}
                                  className="w-full flex items-center justify-between text-xs py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-1 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                    <span className="text-gray-700 font-medium">{t.tag}</span>
                                    <span className="text-gray-400 text-[10px]">({t.transactions.length})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-semibold ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {t.net >= 0 ? '+' : ''}{formatCurrency(t.net)}
                                    </span>
                                    {isTagExpanded ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                                  </div>
                                </button>
                                {isTagExpanded && t.transactions.length > 0 && (
                                  <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-gray-100 pl-3">
                                    {t.transactions.map((tx, i) => (
                                      <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                          <span className="truncate" title={tx.description || ''}>{tx.description || '—'}</span>
                                        </div>
                                        <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══════ CAJA ══════ */}
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
                          <div className={`h-full rounded-full transition-all ${item.net >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                        </div>
                      </button>
                      {isExpanded && item.transactions && item.transactions.length > 0 && (
                        <div className="ml-5 mt-1.5 mb-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                          {item.transactions.map((tx, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                <span className="truncate" title={tx.description || ''}>{tx.description || '—'}</span>
                              </div>
                              <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                              </span>
                            </div>
                          ))}
                          {item.count > 20 && <p className="text-[10px] text-gray-400 pt-1">Mostrando 20 de {item.count} movimientos</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {data.caja.length > 8 && (
                <button onClick={() => setShowAllCaja(!showAllCaja)} className="mt-3 text-xs text-violet-600 hover:text-violet-800 font-medium">
                  {showAllCaja ? 'Ver menos' : `Ver todas (${data.caja.length})`}
                </button>
              )}
            </Card>

            {/* ══════ CUMPLEAÑOS ESTE MES ══════ */}
            {birthdayMembers.length > 0 && (
              <Card className="!p-4 border-l-4 border-l-amber-400 bg-amber-50">
                <div className="flex items-center gap-2 mb-3">
                  <Cake size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-amber-800">
                    Cumpleaños este mes ({birthdayMembers.length})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {birthdayMembers.map((m, i) => {
                    const [, month, day] = m.fecha_nacimiento.split('-');
                    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    return (
                      <span key={i} className="flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                        <Cake size={11} className="text-amber-400" />
                        {m.nombre} {m.apellido}
                        <span className="text-amber-400 font-normal">{parseInt(day)} {months[parseInt(month)-1]}</span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* ══════ CHARTS ══════ */}
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
