'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DateRange } from '@/lib/types';
import { getDateRanges, formatCurrency } from '@/lib/utils';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, Church, Users,
  CreditCard, Landmark, ChevronDown, ChevronRight, Calendar,
  AlertCircle, UserPlus,
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

const TAG_COLORS: Record<string, string> = {
  'Diezmo': 'bg-violet-500', 'Donativo': 'bg-pink-500',
  'Misa/Tabor': 'bg-amber-500', 'Música': 'bg-fuchsia-500',
  'Nómina': 'bg-red-500', 'Gasto operativo': 'bg-slate-500',
  'Comision bancaria': 'bg-gray-400',
};

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
}

export default function ComunidadPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComunidadData | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
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
        const res = await fetch(`/api/comunidad?${params}`);
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

  const incomeTags = data?.tagBreakdown.filter(t => t.income > 0) || [];
  const expenseTags = data?.tagBreakdown.filter(t => t.expenses > 0) || [];

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Church size={22} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Comunidad</h1>
            <p className="text-sm text-gray-500">Diezmos, donativos y gastos operativos</p>
          </div>
        </div>

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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                <p className="text-[10px] text-gray-400 mt-0.5">pagando este mes / activos</p>
              </Card>
            </div>

            {/* Monthly Chart */}
            {data.monthlyChart.length > 0 && (
              <Card className="!p-4">
                <CardHeader className="!px-0 !pt-0">
                  <CardTitle className="text-sm">Evolución Mensual</CardTitle>
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

            {/* Income & Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  Transacciones marcadas como diezmo pero sin miembro identificado. Asígnalas en la sección de Diezmos.
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
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
