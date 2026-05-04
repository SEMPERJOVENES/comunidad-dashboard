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
  FileText, Tag,
} from 'lucide-react';
import { getBirthdaysThisMonth } from '@/lib/birthdays';

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
  const birthdayMembers = useMemo(() => getBirthdaysThisMonth(), []);

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
        const [resDash, resBrand] = await Promise.all([
          fetch(`/api/dashboard?${params}`),
          fetch(`/api/semper-brand?${params}`),
        ]);
        if (!resDash.ok) throw new Error('Error al cargar datos');
        const dash = await resDash.json();
        const brand = resBrand.ok ? await resBrand.json() : null;
        // Sobrescribir stockValue/stockCost con los del endpoint de brand
        // (excluye preventa y productos sin coste)
        if (brand?.stockValuation) {
          dash.shopify = {
            ...dash.shopify,
            stockValue: brand.stockValuation.retailValue ?? dash.shopify.stockValue,
            stockCost: brand.stockValuation.costValue ?? dash.shopify.stockCost,
            totalUnits: brand.stockValuation.units ?? dash.shopify.totalUnits,
          };
        }
        setData(dash);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);


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
        {/* Botones acciones globales */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/informe?type=diezmos&start=${selectedRange.startDate.toISOString()}&end=${selectedRange.endDate.toISOString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm"
          >
            <FileText size={14} /> PDF Diezmos
          </a>
          <a
            href={`/informe?type=completo&start=${selectedRange.startDate.toISOString()}&end=${selectedRange.endDate.toISOString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-violet-700 text-white text-sm font-bold rounded-xl hover:bg-violet-800 shadow-sm"
          >
            📊 PDF Completo
          </a>
        </div>

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
            {/* ══════ ACTIVOS ACTUALES (3 cards: Banco / Caja Brand / Stock) ══════ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl border-2 border-blue-200 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark size={14} className="text-blue-600" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo Banco</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-blue-700">{formatCurrency(data.financials.bankBalance)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Última transacción registrada</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-emerald-200 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={14} className="text-emerald-600" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Caja Brand (efectivo)</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-700">{formatCurrency((data.financials as any).cajaBrandEfectivo || 0)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Ventas presenciales en efectivo · pendiente depositar</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-indigo-200 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Package size={14} className="text-indigo-600" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Brand (PVP)</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-indigo-700">{formatCurrency(data.shopify.stockValue)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Valor potencial · Coste {formatCurrency(data.shopify.stockCost)}</p>
              </div>
            </div>

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

                        {/* Top categorías VISIBLES sin click — mini desglose */}
                        {group.tags.length > 0 && !isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Top categorías</p>
                            {group.tags
                              .sort((a, b) => Math.max(b.income, b.expenses) - Math.max(a.income, a.expenses))
                              .slice(0, 4)
                              .map(t => (
                                <div key={t.tag} className="flex items-center justify-between text-[11px] py-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                    <span className="text-gray-700 truncate">{t.tag}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {t.income > 0 && <span className="text-emerald-600 font-semibold">+{formatCurrency(t.income)}</span>}
                                    {t.expenses > 0 && <span className="text-red-500 font-semibold">-{formatCurrency(t.expenses)}</span>}
                                  </div>
                                </div>
                              ))}
                            {group.tags.length > 4 && (
                              <p className="text-[10px] text-gray-400 italic pt-1">+ {group.tags.length - 4} categorías más · click para ver todo</p>
                            )}
                          </div>
                        )}
                      </button>
                      {isExpanded && group.tags.length > 0 && (
                        <div className="px-4 sm:px-5 pb-4 border-t border-gray-100 space-y-4">
                          {/* INGRESOS */}
                          {(() => {
                            const incomeTags = group.tags.filter(t => t.income > 0).sort((a, b) => b.income - a.income);
                            if (incomeTags.length === 0) return null;
                            return (
                              <div className="pt-3">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-100">
                                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">↑ Ingresos</p>
                                  <p className="text-sm font-bold text-emerald-700">+{formatCurrency(group.income)}</p>
                                </div>
                                <div className="space-y-0.5">
                                  {incomeTags.map(t => {
                                    const tagKey = `${key[0]}-i-${t.tag}`;
                                    const isTagExpanded = expandedTag === tagKey;
                                    const incomeTxs = t.transactions.filter(tx => tx.amount > 0);
                                    return (
                                      <div key={t.tag}>
                                        <button onClick={(e) => { e.stopPropagation(); setExpandedTag(isTagExpanded ? null : tagKey); }}
                                          className="w-full flex items-center justify-between text-xs py-1.5 hover:bg-emerald-50/50 rounded-lg px-2 -mx-1">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                            <span className="text-gray-700 font-medium">{t.tag}</span>
                                            <span className="text-gray-400 text-[10px]">({incomeTxs.length})</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-emerald-600">+{formatCurrency(t.income)}</span>
                                            {isTagExpanded ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                                          </div>
                                        </button>
                                        {isTagExpanded && incomeTxs.length > 0 && (
                                          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                                            {incomeTxs.map((tx, i) => (
                                              <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                                  <span className="truncate" title={tx.description || ''}>{tx.description || '—'}</span>
                                                </div>
                                                <span className="font-medium flex-shrink-0 ml-2 text-emerald-600">+{formatCurrency(tx.amount)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* GASTOS */}
                          {(() => {
                            const expenseTags = group.tags.filter(t => t.expenses > 0).sort((a, b) => b.expenses - a.expenses);
                            if (expenseTags.length === 0) return null;
                            return (
                              <div>
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100">
                                  <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">↓ Gastos</p>
                                  <p className="text-sm font-bold text-rose-700">-{formatCurrency(group.expenses)}</p>
                                </div>
                                <div className="space-y-0.5">
                                  {expenseTags.map(t => {
                                    const tagKey = `${key[0]}-e-${t.tag}`;
                                    const isTagExpanded = expandedTag === tagKey;
                                    const expTxs = t.transactions.filter(tx => tx.amount < 0);
                                    return (
                                      <div key={t.tag}>
                                        <button onClick={(e) => { e.stopPropagation(); setExpandedTag(isTagExpanded ? null : tagKey); }}
                                          className="w-full flex items-center justify-between text-xs py-1.5 hover:bg-rose-50/50 rounded-lg px-2 -mx-1">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                            <span className="text-gray-700 font-medium">{t.tag}</span>
                                            <span className="text-gray-400 text-[10px]">({expTxs.length})</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-rose-600">-{formatCurrency(t.expenses)}</span>
                                            {isTagExpanded ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                                          </div>
                                        </button>
                                        {isTagExpanded && expTxs.length > 0 && (
                                          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-rose-100 pl-3">
                                            {expTxs.map((tx, i) => (
                                              <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                                  <span className="truncate" title={tx.description || ''}>{tx.description || '—'}</span>
                                                </div>
                                                <span className="font-medium flex-shrink-0 ml-2 text-rose-600">-{formatCurrency(Math.abs(tx.amount))}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
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
                    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    return (
                      <span key={i} className="flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                        <Cake size={11} className="text-amber-400" />
                        {m.name}
                        <span className="text-amber-400 font-normal">{m.day} {months[m.month - 1]}</span>
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
