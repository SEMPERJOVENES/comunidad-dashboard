'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DateRange } from '@/lib/types';
import { getDefaultRange, formatCurrency } from '@/lib/utils';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, Church, Users,
  CreditCard, Landmark, ChevronDown, ChevronRight,
  AlertCircle, UserPlus, Plane, Music, BookOpen, Tent, HandHeart,
} from 'lucide-react';

const TAG_COLORS: Record<string, string> = {
  'Diezmo': 'bg-violet-500', 'Donativo': 'bg-pink-500',
  'Misa/Tabor': 'bg-amber-500', 'Música': 'bg-fuchsia-500',
  'Nómina': 'bg-red-500', 'Gasto operativo': 'bg-slate-500',
  'Comision bancaria': 'bg-gray-400',
};

const CATEGORY_STYLES: Record<string, { icon: any; text: string; lightBg: string }> = {
  'Viajes': { icon: Plane, text: 'text-blue-600', lightBg: 'bg-blue-50' },
  'Retiros': { icon: Tent, text: 'text-teal-600', lightBg: 'bg-teal-50' },
  'BAC': { icon: BookOpen, text: 'text-orange-600', lightBg: 'bg-orange-50' },
  'Música': { icon: Music, text: 'text-fuchsia-600', lightBg: 'bg-fuchsia-50' },
  'Misa/Tabor': { icon: Church, text: 'text-amber-600', lightBg: 'bg-amber-50' },
  'Otros': { icon: Wallet, text: 'text-gray-600', lightBg: 'bg-gray-50' },
};

interface MemberStatus {
  id: string;
  name: string;
  community: string;
  paidPrevMonth: boolean;
  paidCurrentMonth: boolean;
  isActive: boolean;
}

interface ComunidadData {
  financials: {
    totalIncome: number;
    totalExpenses: number;
    net: number;
    stripeIncome: number;
    bankIncome: number;
  };
  members: { total: number; active: number; paying: number };
  tagBreakdown: {
    tag: string;
    income: number;
    expenses: number;
    net: number;
    color: string;
    count: number;
    transactions: { date: string; concept: string; amount: number; memberName: string | null }[];
  }[];
  monthlyChart: { month: string; income: number; expenses: number; net: number }[];
  unmatchedTxs: { id: string; date: string; concept: string; amount: number }[];
  memberStatus?: MemberStatus[];
  prevMonthKey?: string;
}

interface EventCategory {
  name: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
  transactions: { id: string; date: string; concept: string; amount: number; tag: string }[];
}

interface ViajesEventosData {
  categories: EventCategory[];
  totals: { income: number; expenses: number; net: number };
}

export default function ComunidadPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComunidadData | null>(null);
  const [eventosData, setEventosData] = useState<ViajesEventosData | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  function formatMonthLabel(key: string) {
    const [y, m] = key.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  const COMUNIDADES_ORDER = ['San Martín', 'San Ignacio', 'San Pablo', 'Colaboradores'];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const [comunidadRes, eventosRes] = await Promise.all([
          fetch(`/api/comunidad?${params}`),
          fetch(`/api/viajes-eventos?${params}`),
        ]);
        if (!comunidadRes.ok) throw new Error('Error al cargar datos de comunidad');
        if (!eventosRes.ok) throw new Error('Error al cargar datos de eventos');
        setData(await comunidadRes.json());
        setEventosData(await eventosRes.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  const incomeTags = data?.tagBreakdown.filter(t => t.income > 0) || [];
  const expenseTags = data?.tagBreakdown.filter(t => t.expenses > 0) || [];

  // Totales globales (diezmos + eventos)
  const globalIncome = (data?.financials.totalIncome || 0) + (eventosData?.totals.income || 0);
  const globalExpenses = (data?.financials.totalExpenses || 0) + (eventosData?.totals.expenses || 0);
  const globalNet = globalIncome - globalExpenses;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <Church size={22} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard Comunidad</h1>
              <p className="text-sm text-gray-500">Visión completa de finanzas</p>
            </div>
          </div>
          {/* Resumen global compacto */}
          {!loading && data && eventosData && (
            <div className="flex items-center gap-4 text-xs bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="text-gray-400 uppercase text-[10px]">Total Ingresos</span>
                <p className="font-bold text-emerald-600">{formatCurrency(globalIncome)}</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <span className="text-gray-400 uppercase text-[10px]">Total Gastos</span>
                <p className="font-bold text-red-500">{formatCurrency(globalExpenses)}</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <span className="text-gray-400 uppercase text-[10px]">Neto</span>
                <p className={`font-bold ${globalNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {globalNet >= 0 ? '+' : ''}{formatCurrency(globalNet)}
                </p>
              </div>
            </div>
          )}
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
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════ */}
            {/*  SECCIÓN 1: DIEZMOS Y COMUNIDAD                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {data && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                    <HandHeart size={16} className="text-violet-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Diezmos y Comunidad</h2>
                  <div className="flex-1 h-px bg-violet-200 ml-2" />
                </div>

                {/* KPIs Diezmos */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
                  <Card className="!p-4 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={14} className="text-emerald-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(data.financials.totalIncome)}</p>
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><Landmark size={10} /> {formatCurrency(data.financials.bankIncome)}</span>
                      <span className="flex items-center gap-1"><CreditCard size={10} /> {formatCurrency(data.financials.stripeIncome)}</span>
                    </div>
                  </Card>
                  <Card className="!p-4 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown size={14} className="text-red-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Gastos</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(data.financials.totalExpenses)}</p>
                  </Card>
                  <Card className={`!p-4 border-l-4 ${data.financials.net >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet size={14} className="text-gray-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Resultado</p>
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold ${data.financials.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(data.financials.net)}
                    </p>
                  </Card>
                  <Card className="!p-4 border-l-4 border-l-violet-500">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className="text-violet-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Miembros</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-violet-600">{data.members.paying}<span className="text-sm text-gray-400">/{data.members.active}</span></p>
                    <p className="text-[10px] text-gray-400 mt-0.5">pagando / activos</p>
                  </Card>
                </div>

                {/* Monthly Chart Diezmos */}
                {data.monthlyChart.length > 0 && (
                  <Card className="!p-4 mb-4">
                    <CardHeader className="!px-0 !pt-0">
                      <CardTitle className="text-sm">Evolución Mensual — Diezmos</CardTitle>
                    </CardHeader>
                    <div className="space-y-2">
                      {data.monthlyChart.map((m) => {
                        const maxVal = Math.max(...data.monthlyChart.map(c => Math.max(c.income, c.expenses)), 1);
                        const incPct = (m.income / maxVal) * 100;
                        const expPct = (m.expenses / maxVal) * 100;
                        return (
                          <div key={m.month} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-medium w-16">{m.month}</span>
                              <span className={`font-semibold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {m.net >= 0 ? '+' : ''}{formatCurrency(m.net)}
                              </span>
                            </div>
                            <div className="flex gap-1 h-3">
                              <div className="bg-emerald-200 rounded-full overflow-hidden flex-1">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(incPct, 2)}%` }} />
                              </div>
                              <div className="bg-red-200 rounded-full overflow-hidden flex-1">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.max(expPct, 2)}%` }} />
                              </div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>▲ {formatCurrency(m.income)}</span>
                              <span>▼ {formatCurrency(m.expenses)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Income & Expense Breakdown Diezmos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {/* Income Tags */}
                  <Card className="!p-4">
                    <CardHeader className="!px-0 !pt-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-500" />
                        Ingresos por Categoría
                      </CardTitle>
                    </CardHeader>
                    <div className="space-y-1">
                      {incomeTags.length === 0 && (
                        <p className="text-xs text-gray-400 py-4 text-center">Sin ingresos en este período</p>
                      )}
                      {incomeTags.map(t => {
                        const isExpanded = expandedTag === `inc-${t.tag}`;
                        return (
                          <div key={t.tag}>
                            <button onClick={() => setExpandedTag(isExpanded ? null : `inc-${t.tag}`)}
                              className="w-full flex items-center justify-between text-xs py-1.5 hover:bg-gray-50 rounded px-2 -mx-1 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                <span className="text-gray-700 font-medium">{t.tag}</span>
                                <span className="text-gray-400">({t.count})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-emerald-600">+{formatCurrency(t.income)}</span>
                                {isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                              </div>
                            </button>
                            {isExpanded && t.transactions.length > 0 && (
                              <div className="ml-5 mt-1 mb-2 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                                {t.transactions.filter(tx => tx.amount > 0).map((tx, i) => (
                                  <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                      <span className="truncate">{tx.memberName || tx.concept || '—'}</span>
                                    </div>
                                    <span className="font-medium flex-shrink-0 ml-2 text-emerald-600">
                                      +{formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {data.financials.stripeIncome > 0 && (
                        <div className="flex items-center justify-between text-xs py-1.5 px-2 -mx-1 bg-blue-50 rounded">
                          <div className="flex items-center gap-2">
                            <CreditCard size={10} className="text-blue-500" />
                            <span className="text-blue-700 font-medium">Stripe (Diezmos online)</span>
                          </div>
                          <span className="font-semibold text-blue-600">+{formatCurrency(data.financials.stripeIncome)}</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Expense Tags */}
                  <Card className="!p-4">
                    <CardHeader className="!px-0 !pt-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingDown size={14} className="text-red-500" />
                        Gastos por Categoría
                      </CardTitle>
                    </CardHeader>
                    <div className="space-y-1">
                      {expenseTags.length === 0 && (
                        <p className="text-xs text-gray-400 py-4 text-center">Sin gastos en este período</p>
                      )}
                      {expenseTags.map(t => {
                        const isExpanded = expandedTag === `exp-${t.tag}`;
                        const maxExp = Math.max(...expenseTags.map(e => e.expenses), 1);
                        const pct = (t.expenses / maxExp) * 100;
                        return (
                          <div key={t.tag}>
                            <button onClick={() => setExpandedTag(isExpanded ? null : `exp-${t.tag}`)}
                              className="w-full text-left hover:bg-gray-50 rounded px-2 py-1.5 -mx-1 transition-colors">
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                                  <span className="text-gray-700 font-medium">{t.tag}</span>
                                  <span className="text-gray-400">({t.count})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-red-500">-{formatCurrency(t.expenses)}</span>
                                  {isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                              </div>
                            </button>
                            {isExpanded && t.transactions.length > 0 && (
                              <div className="ml-5 mt-1 mb-2 space-y-0.5 border-l-2 border-red-100 pl-3">
                                {t.transactions.filter(tx => tx.amount < 0).map((tx, i) => (
                                  <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                      <span className="truncate">{tx.concept || '—'}</span>
                                    </div>
                                    <span className="font-medium flex-shrink-0 ml-2 text-red-500">
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {/* Unmatched Diezmo Transactions */}
                {data.unmatchedTxs.length > 0 && (
                  <Card className="!p-4 border-l-4 border-l-amber-400">
                    <button
                      onClick={() => setShowUnmatched(!showUnmatched)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-500" />
                        <span className="text-sm font-bold text-gray-900">
                          Diezmos sin asignar ({data.unmatchedTxs.length})
                        </span>
                      </div>
                      {showUnmatched ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Transacciones marcadas como diezmo pero sin miembro identificado.
                    </p>
                    {showUnmatched && (
                      <div className="mt-3 space-y-1">
                        {data.unmatchedTxs.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-amber-50 rounded">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <UserPlus size={12} className="text-amber-500 flex-shrink-0" />
                              <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                              <span className="truncate text-gray-700">{tx.concept}</span>
                            </div>
                            <span className="font-semibold text-emerald-600 flex-shrink-0 ml-2">
                              +{formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </section>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/*  SECCIÓN 2: VIAJES, EVENTOS Y OTROS                   */}
            {/* ═══════════════════════════════════════════════════════ */}
            {eventosData && (
              <section className="mt-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Plane size={16} className="text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Viajes, Eventos y Otros</h2>
                  <div className="flex-1 h-px bg-blue-200 ml-2" />
                </div>

                {/* KPIs Eventos */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
                  <Card className="!p-4 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={14} className="text-blue-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(eventosData.totals.income)}</p>
                  </Card>
                  <Card className="!p-4 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown size={14} className="text-red-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Gastos</p>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(eventosData.totals.expenses)}</p>
                  </Card>
                  <Card className={`!p-4 border-l-4 ${eventosData.totals.net >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet size={14} className="text-gray-500" />
                      <p className="text-xs font-medium text-gray-500 uppercase">Resultado</p>
                    </div>
                    <p className={`text-lg sm:text-2xl font-bold ${eventosData.totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {eventosData.totals.net >= 0 ? '+' : ''}{formatCurrency(eventosData.totals.net)}
                    </p>
                  </Card>
                </div>

                {/* Category Cards */}
                {eventosData.categories.length === 0 ? (
                  <Card className="!p-6 text-center">
                    <p className="text-sm text-gray-400">Sin movimientos de eventos en este período</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {eventosData.categories.map((cat) => {
                      const style = CATEGORY_STYLES[cat.name] || CATEGORY_STYLES['Otros'];
                      const Icon = style.icon;
                      const isExpanded = expandedCat === cat.name;
                      return (
                        <Card key={cat.name} className="!p-0 overflow-hidden">
                          <button
                            onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                            className="w-full text-left p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.lightBg}`}>
                                  <Icon size={16} className={style.text} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{cat.name}</p>
                                  <p className="text-[10px] text-gray-400">{cat.count} movimientos</p>
                                </div>
                              </div>
                              {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Ingresos</p>
                                <p className="text-xs font-bold text-emerald-600">{formatCurrency(cat.income)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Gastos</p>
                                <p className="text-xs font-bold text-red-500">{formatCurrency(cat.expenses)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Neto</p>
                                <p className={`text-xs font-bold ${cat.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {cat.net >= 0 ? '+' : ''}{formatCurrency(cat.net)}
                                </p>
                              </div>
                            </div>
                          </button>
                          {isExpanded && cat.transactions.length > 0 && (
                            <div className="px-4 pb-4 pt-0">
                              <div className="border-t border-gray-100 pt-3 space-y-1 max-h-48 overflow-y-auto">
                                {cat.transactions.map((tx, i) => (
                                  <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-gray-400 flex-shrink-0">{tx.date}</span>
                                      <span className="truncate">{tx.concept || '—'}</span>
                                    </div>
                                    <span className={`font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            {/* ═══════════════════════════════════════════════════════ */}
            {/*  SECCIÓN 3: PERTENENCIA — QUIÉN DA Y QUIÉN NO         */}
            {/* ═══════════════════════════════════════════════════════ */}
            {data?.memberStatus && data.memberStatus.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Users size={16} className="text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Pertenencia</h2>
                <div className="flex-1 h-px bg-violet-200 ml-2" />
                <span className="text-xs text-gray-400">
                  Ref: {data.prevMonthKey ? formatMonthLabel(data.prevMonthKey) : '—'}
                </span>
              </div>

              <div className="space-y-3">
                {COMUNIDADES_ORDER.map(comunidad => {
                  const comMembers = data.memberStatus!.filter(m => m.community === comunidad);
                  if (comMembers.length === 0) return null;
                  const paying = comMembers.filter(m => m.paidPrevMonth);
                  const notPaying = comMembers.filter(m => !m.paidPrevMonth);
                  const pct = Math.round((paying.length / comMembers.length) * 100);
                  const communityColor =
                    comunidad === 'San Martín' ? { bg: 'bg-orange-100', text: 'text-orange-600', bar: 'bg-orange-500' } :
                    comunidad === 'San Ignacio' ? { bg: 'bg-green-100', text: 'text-green-600', bar: 'bg-green-500' } :
                    comunidad === 'San Pablo' ? { bg: 'bg-blue-100', text: 'text-blue-600', bar: 'bg-blue-500' } :
                    { bg: 'bg-purple-100', text: 'text-purple-600', bar: 'bg-purple-500' };
                  return (
                    <Card key={comunidad} className="!p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${communityColor.bg}`}>
                            <Church size={15} className={communityColor.text} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">{comunidad}</h3>
                            <p className="text-[10px] text-gray-400">{comMembers.length} miembros</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                            {paying.length}/{comMembers.length}
                          </p>
                          <p className="text-[10px] text-gray-400">{pct}% al día</p>
                        </div>
                      </div>

                      <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                          style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {paying.map(m => (
                          <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                            {m.name}
                          </span>
                        ))}
                        {notPaying.map(m => (
                          <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-medium">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
