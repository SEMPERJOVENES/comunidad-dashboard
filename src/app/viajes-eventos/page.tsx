'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Loader2, Plane, TrendingUp, TrendingDown, Calendar,
  ChevronDown, ChevronRight, Mountain, Music, Church, Heart, Ticket,
} from 'lucide-react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getMonthFilters() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const filters: { label: string; key: string; start: Date; end: Date }[] = [];
  filters.push({
    label: `${currentYear}`,
    key: 'year',
    start: new Date(currentYear, 0, 1),
    end: new Date(currentYear, 11, 31, 23, 59, 59),
  });
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

const CATEGORY_ICONS: Record<string, any> = {
  'Viajes': Plane,
  'Retiros': Mountain,
  'BAC': Ticket,
  'Música': Music,
  'Misa/Tabor': Church,
  'Donativo': Heart,
};

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  'Viajes': { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-600' },
  'Retiros': { border: 'border-l-orange-500', bg: 'bg-orange-50', text: 'text-orange-600' },
  'BAC': { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Música': { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
  'Misa/Tabor': { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
  'Donativo': { border: 'border-l-pink-500', bg: 'bg-pink-50', text: 'text-pink-600' },
};

interface CategoryData {
  name: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
  transactions: { id: string; date: string; concept: string; amount: number; tag: string }[];
}

export default function ViajesEventosPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, net: 0 });
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState('year');

  const monthFilters = useMemo(() => getMonthFilters(), []);

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
        const res = await fetch(`/api/viajes-eventos?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setTotals(data.totals || { income: 0, expenses: 0, net: 0 });
        }
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [effectiveRange]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Plane size={24} className="text-rose-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Viajes y Eventos — P&L</h1>
            <p className="text-sm text-gray-500">Ingresos vs gastos por categoría</p>
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
                    ? 'bg-rose-600 text-white shadow-sm'
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
            <Loader2 className="animate-spin text-rose-600" size={28} />
            <span className="ml-3 text-gray-500">Cargando datos...</span>
          </div>
        ) : (
          <>
            {/* Totals KPIs */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Card className="!p-4 border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(totals.income)}</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Gastos</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(totals.expenses)}</p>
              </Card>
              <Card className={`!p-4 border-l-4 ${totals.net >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Plane size={14} className="text-gray-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Balance</p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.net)}
                </p>
              </Card>
            </div>

            {/* Category Cards */}
            <div className="space-y-3">
              {categories.map((cat) => {
                const colors = CATEGORY_COLORS[cat.name] || { border: 'border-l-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' };
                const Icon = CATEGORY_ICONS[cat.name] || Ticket;
                const isExpanded = expandedCat === cat.name;
                const maxBar = Math.max(cat.income, cat.expenses, 1);

                return (
                  <Card key={cat.name} className={`!p-0 overflow-hidden border-l-4 ${colors.border}`}>
                    <button
                      onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                      className="w-full p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
                            <Icon size={20} className={colors.text} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-gray-900">{cat.name}</p>
                            <p className="text-xs text-gray-400">{cat.count} movimientos</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={cat.net >= 0 ? 'success' : 'danger'}>
                            {formatCurrency(cat.net)}
                          </Badge>
                          {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        </div>
                      </div>

                      {/* Income vs Expenses bars */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 text-right">Ingresos</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(cat.income / maxBar) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 w-20 text-right">{formatCurrency(cat.income)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 text-right">Gastos</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${(cat.expenses / maxBar) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-red-500 w-20 text-right">{formatCurrency(cat.expenses)}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded: transaction list */}
                    {isExpanded && cat.transactions.length > 0 && (
                      <div className="border-t border-gray-100">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[500px]">
                            <thead>
                              <tr className="border-b border-gray-50">
                                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Fecha</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Concepto</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cat.transactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                                  <td className="px-4 py-2 text-sm text-gray-800 break-words">{tx.concept}</td>
                                  <td className={`px-4 py-2 text-sm text-right font-semibold whitespace-nowrap ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}

              {categories.length === 0 && (
                <Card>
                  <p className="text-center text-gray-400 py-8 text-sm">
                    Sin movimientos de viajes o eventos en este período
                  </p>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
