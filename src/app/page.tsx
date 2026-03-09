'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import RevenueChart from '@/components/dashboard/RevenueChart';
import TopProducts from '@/components/dashboard/TopProducts';
import RecentOrders from '@/components/dashboard/RecentOrders';
import { DateRange, RevenueDataPoint, TopProduct, ShopifyOrder } from '@/lib/types';
import { getDateRanges, formatCurrency } from '@/lib/utils';
import {
  Loader2, TrendingUp, TrendingDown, Wallet, Church, Store,
  Landmark, ChevronDown, ChevronRight, Package,
  Calendar,
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

interface MacroGroup {
  income: number;
  expenses: number;
  net: number;
  tags: { tag: string; income: number; expenses: number; net: number }[];
}

interface DashboardData {
  financials: { totalIncome: number; totalExpenses: number; profit: number; bankBalance: number };
  macroGroups: { diezmos: MacroGroup; brand: MacroGroup; otros: MacroGroup };
  caja: { tag: string; net: number }[];
  stripe: { volume: number; available: number; pending: number };
  shopify: { revenue: number; orders: number };
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
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showAllCaja, setShowAllCaja] = useState(false);
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

            {/* === MACRO GROUPS: Diezmos, Brand, Otros === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Diezmos */}
              <Card className="!p-0 overflow-hidden">
                <button onClick={() => toggleGroup('diezmos')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Church size={20} className="text-violet-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Diezmos</p>
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
                  <div className="px-4 pb-4 space-y-1.5">
                    {data.macroGroups.diezmos.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                          <span className="text-gray-700">{t.tag}</span>
                        </div>
                        <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
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
                <div className="px-4 pb-2 flex gap-4 text-xs border-t border-gray-50 pt-2">
                  <span className="text-emerald-600">▲ {formatCurrency(data.macroGroups.brand.income)}</span>
                  <span className="text-red-500">▼ {formatCurrency(data.macroGroups.brand.expenses)}</span>
                </div>
                {expandedGroup === 'brand' && data.macroGroups.brand.tags.length > 0 && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {data.macroGroups.brand.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                          <span className="text-gray-700">{t.tag}</span>
                        </div>
                        <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
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
                  <div className="px-4 pb-4 space-y-1.5">
                    {data.macroGroups.otros.tags.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(t => (
                      <div key={t.tag} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${TAG_COLORS[t.tag] || 'bg-gray-400'}`} />
                          <span className="text-gray-700">{t.tag}</span>
                        </div>
                        <span className={`font-medium ${t.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(t.net)}</span>
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
                  return (
                    <div key={item.tag}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${TAG_COLORS[item.tag] || 'bg-gray-400'}`} />
                          <span className="text-xs font-medium text-gray-700">{item.tag}</span>
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
