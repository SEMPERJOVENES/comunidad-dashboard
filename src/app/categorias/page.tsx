'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  TrendingUp, TrendingDown, Tag, Loader2, ArrowUpRight, ArrowDownRight,
  AlertCircle, Calendar,
} from 'lucide-react';

interface Category {
  tag: string;
  income: number;
  expenses: number;
  net: number;
  incomeCount: number;
  expensesCount: number;
  totalOps: number;
}

interface CategoriesData {
  categories: Category[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
  totalTransactions: number;
  uncategorized: number;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getMonthFilters() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const filters: { label: string; key: string; start: Date; end: Date }[] = [];

  // "Este Año" default
  filters.push({
    label: `${currentYear}`,
    key: 'year',
    start: new Date(currentYear, 0, 1),
    end: new Date(currentYear, 11, 31, 23, 59, 59),
  });

  // Individual months up to current month
  for (let m = 0; m <= currentMonth; m++) {
    const lastDay = new Date(currentYear, m + 1, 0);
    filters.push({
      label: MONTH_NAMES[m],
      key: `m-${m}`,
      start: new Date(currentYear, m, 1),
      end: new Date(currentYear, m, lastDay.getDate(), 23, 59, 59),
    });
  }

  return filters;
}

export default function CategoriasPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[8]);
  const [data, setData] = useState<CategoriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'income' | 'expenses'>('all');
  const [monthFilter, setMonthFilter] = useState('year');

  const monthFilters = useMemo(() => getMonthFilters(), []);

  // Compute the effective date range from month filter
  const effectiveRange = useMemo(() => {
    const mf = monthFilters.find(f => f.key === monthFilter);
    if (mf) return { start: mf.start, end: mf.end };
    return { start: selectedRange.startDate, end: selectedRange.endDate };
  }, [monthFilter, monthFilters, selectedRange]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: effectiveRange.start.toISOString(),
          end: effectiveRange.end.toISOString(),
        });
        const res = await fetch(`/api/categorias?${params}`);
        if (!res.ok) throw new Error('Error');
        setData(await res.json());
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [effectiveRange]);

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'income') return data.categories.filter(c => c.income > 0).sort((a, b) => b.income - a.income);
    if (viewMode === 'expenses') return data.categories.filter(c => c.expenses > 0).sort((a, b) => b.expenses - a.expenses);
    return data.categories;
  }, [data, viewMode]);

  const incomeCategories = useMemo(() => {
    if (!data) return [];
    return data.categories.filter(c => c.income > 0).sort((a, b) => b.income - a.income);
  }, [data]);

  const expenseCategories = useMemo(() => {
    if (!data) return [];
    return data.categories.filter(c => c.expenses > 0).sort((a, b) => b.expenses - a.expenses);
  }, [data]);

  const TAG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    'Diezmo': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    'Donativo': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
    'Merch': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
    'Shopify': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    'Stripe': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    'Bizum': { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
    'Transferencia': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
    'Misa/Tabor': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'Retiros': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    'Viajes': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    'Música': { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
    'Nómina': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    'Material': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    'Comisión bancaria': { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
    'BAC': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Gasto operativo': { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
    'Semper CD': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    'Venta presencial': { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
    'Alquiler': { bg: 'bg-stone-50', text: 'text-stone-700', dot: 'bg-stone-500' },
    'Proveedor': { bg: 'bg-zinc-50', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  };

  function getTagColor(tag: string) {
    return TAG_COLORS[tag] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' };
  }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tag size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Categorías Financieras</h1>
              <p className="text-sm text-gray-500">Ingresos y gastos agrupados por categoría</p>
            </div>
          </div>
        </div>

        {/* Month Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Calendar size={16} className="text-gray-400 flex-shrink-0" />
          <div className="flex gap-1 flex-nowrap">
            {monthFilters.map((mf) => (
              <button
                key={mf.key}
                onClick={() => setMonthFilter(mf.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  monthFilter === mf.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {mf.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={28} />
            <span className="ml-3 text-gray-500">Cargando categorías...</span>
          </div>
        ) : !data ? (
          <Card>
            <p className="text-center text-gray-400 py-12">No se pudieron cargar los datos</p>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="!p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Ingresos</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(data.totalIncome)}</p>
                <div className="mt-1 flex items-center gap-1">
                  <ArrowUpRight size={14} className="text-emerald-500" />
                  <span className="text-xs text-gray-500">{incomeCategories.length} categorías</span>
                </div>
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Gastos</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.totalExpenses)}</p>
                <div className="mt-1 flex items-center gap-1">
                  <ArrowDownRight size={14} className="text-red-500" />
                  <span className="text-xs text-gray-500">{expenseCategories.length} categorías</span>
                </div>
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resultado Neto</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(data.net)}
                </p>
                <div className="mt-1">
                  <span className="text-xs text-gray-500">{data.totalTransactions} operaciones</span>
                </div>
              </Card>
              <Card className="!p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sin Categorizar</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.uncategorized > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {data.uncategorized}
                </p>
                {data.uncategorized > 0 && (
                  <div className="mt-1 flex items-center gap-1">
                    <AlertCircle size={12} className="text-amber-500" />
                    <span className="text-xs text-amber-600">Pendiente de clasificar</span>
                  </div>
                )}
              </Card>
            </div>

            {/* Income & Expenses Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Ingresos por Categoría */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      Ingresos por Categoría
                    </div>
                  </CardTitle>
                  <Badge variant="success">{formatCurrency(data.totalIncome)}</Badge>
                </CardHeader>
                <div className="space-y-2.5">
                  {incomeCategories.map((cat) => {
                    const pct = data.totalIncome > 0 ? (cat.income / data.totalIncome) * 100 : 0;
                    const colors = getTagColor(cat.tag);
                    return (
                      <div key={cat.tag}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                              {cat.tag}
                            </span>
                            <span className="text-xs text-gray-400">{cat.incomeCount} ops</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.income)}</span>
                            <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {incomeCategories.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ingresos en este período</p>
                  )}
                </div>
              </Card>

              {/* Gastos por Categoría */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={16} className="text-red-500" />
                      Gastos por Categoría
                    </div>
                  </CardTitle>
                  <Badge variant="danger">{formatCurrency(data.totalExpenses)}</Badge>
                </CardHeader>
                <div className="space-y-2.5">
                  {expenseCategories.map((cat) => {
                    const pct = data.totalExpenses > 0 ? (cat.expenses / data.totalExpenses) * 100 : 0;
                    const colors = getTagColor(cat.tag);
                    return (
                      <div key={cat.tag}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                              {cat.tag}
                            </span>
                            <span className="text-xs text-gray-400">{cat.expensesCount} ops</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.expenses)}</span>
                            <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {expenseCategories.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin gastos en este período</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Full Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-violet-500" />
                    Todas las Categorías
                  </div>
                </CardTitle>
                <div className="flex gap-1">
                  {(['all', 'income', 'expenses'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        viewMode === mode
                          ? 'bg-violet-100 text-violet-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}>
                      {mode === 'all' ? 'Todo' : mode === 'income' ? 'Ingresos' : 'Gastos'}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Categoría</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ingresos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Gastos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Neto</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ops</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((cat) => {
                      const colors = getTagColor(cat.tag);
                      return (
                        <tr key={cat.tag} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                {cat.tag}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-emerald-600 font-medium">
                            {cat.income > 0 ? formatCurrency(cat.income) : '-'}
                          </td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-red-500 font-medium">
                            {cat.expenses > 0 ? `-${formatCurrency(cat.expenses)}` : '-'}
                          </td>
                          <td className={`px-4 sm:px-6 py-2.5 text-sm text-right font-bold ${cat.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(cat.net)}
                          </td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-500">
                            {cat.totalOps}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCategories.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-sm text-gray-400">Sin datos</td>
                      </tr>
                    )}
                  </tbody>
                  {filteredCategories.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                        <td className="px-4 sm:px-6 py-3 text-sm font-bold text-gray-900">Total</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-emerald-600">
                          {formatCurrency(data.totalIncome)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-red-600">
                          -{formatCurrency(data.totalExpenses)}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-sm text-right font-bold ${data.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(data.net)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                          {data.totalTransactions}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
