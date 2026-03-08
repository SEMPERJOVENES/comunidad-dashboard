'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatNumber, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  ShoppingCart,
  Store,
  Landmark,
  Package,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
} from 'lucide-react';

interface SemperBrandData {
  income: {
    shopify: number;
    shopifyOrders: number;
    shopifyRefunds: number;
    ventasPresenciales: number;
    ventasCount: number;
    bankIncome: Record<string, number>;
    totalBankIncome: number;
    total: number;
  };
  expenses: {
    byTag: Record<string, number>;
    total: number;
  };
  profit: number;
  margin: number;
  monthlyBreakdown: {
    month: string;
    shopify: number;
    ventas: number;
    bankIncome: number;
    expenses: number;
    orders: number;
    totalIncome: number;
    profit: number;
  }[];
  topProducts: {
    title: string;
    revenue: number;
    units: number;
  }[];
}

function MonthLabel({ month }: { month: string }) {
  const [year, m] = month.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return <span>{names[parseInt(m) - 1]} {year.slice(2)}</span>;
}

export default function SemperBrandPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[8]); // Desde siempre
  const [data, setData] = useState<SemperBrandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/semper-brand?${params}`);
        if (!res.ok) throw new Error('Error al cargar datos');
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  const incomeBreakdown = useMemo(() => {
    if (!data) return [];
    const items = [];
    if (data.income.shopify > 0) {
      items.push({ label: 'Shopify', amount: data.income.shopify, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50', detail: `${data.income.shopifyOrders} órdenes` });
    }
    if (data.income.ventasPresenciales > 0) {
      items.push({ label: 'Ventas Presenciales', amount: data.income.ventasPresenciales, icon: Store, color: 'text-emerald-600', bg: 'bg-emerald-50', detail: `${data.income.ventasCount} ventas` });
    }
    // Bank income by tag
    Object.entries(data.income.bankIncome).forEach(([tag, amount]) => {
      items.push({ label: tag, amount, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', detail: 'Banco' });
    });
    return items.sort((a, b) => b.amount - a.amount);
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.expenses.byTag)
      .map(([tag, amount]) => ({ tag, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const maxMonthlyIncome = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.monthlyBreakdown.map(m => m.totalIncome), 1);
  }, [data]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resultado Semper Brand</h1>
          <p className="text-sm text-gray-500">Cuenta de pérdidas y ganancias</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={28} />
            <span className="ml-3 text-gray-500">Cargando datos financieros...</span>
          </div>
        ) : !data ? (
          <Card>
            <p className="text-center text-gray-400 py-12">No se pudieron cargar los datos</p>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Ingresos */}
              <Card className="!p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ingresos</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                      {formatCurrency(data.income.total)}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={18} className="text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <ArrowUpRight size={14} className="text-emerald-500" />
                  <span className="text-xs text-gray-500">
                    {data.income.shopifyOrders + data.income.ventasCount} operaciones
                  </span>
                </div>
              </Card>

              {/* Total Gastos */}
              <Card className="!p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gastos</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                      {formatCurrency(data.expenses.total)}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <TrendingDown size={18} className="text-red-500" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <ArrowDownRight size={14} className="text-red-500" />
                  <span className="text-xs text-gray-500">
                    {Object.keys(data.expenses.byTag).length} categorías
                  </span>
                </div>
              </Card>

              {/* Beneficio */}
              <Card className="!p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Beneficio</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(data.profit)}
                    </p>
                  </div>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${data.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <DollarSign size={18} className={data.profit >= 0 ? 'text-emerald-600' : 'text-red-500'} />
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`text-xs font-medium ${data.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {data.profit >= 0 ? 'Positivo' : 'Negativo'}
                  </span>
                </div>
              </Card>

              {/* Margen */}
              <Card className="!p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Margen</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.margin >= 0 ? 'text-violet-600' : 'text-red-600'}`}>
                      {data.margin.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Percent size={18} className="text-violet-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    Sobre ingresos totales
                  </span>
                </div>
              </Card>
            </div>

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
                  <Badge variant="success">{formatCurrency(data.income.total)}</Badge>
                </CardHeader>
                <div className="space-y-3">
                  {incomeBreakdown.map((item, i) => {
                    const pct = data!.income.total > 0 ? (item.amount / data!.income.total) * 100 : 0;
                    return (
                      <div key={i} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-md ${item.bg} flex items-center justify-center`}>
                              <item.icon size={14} className={item.color} />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-800">{item.label}</span>
                              <span className="text-xs text-gray-400 ml-2">{item.detail}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                            <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {incomeBreakdown.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ingresos en este período</p>
                  )}
                </div>

                {/* Refunds note */}
                {data.income.shopifyRefunds > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Devoluciones Shopify</span>
                      <span className="text-red-500 font-medium">-{formatCurrency(data.income.shopifyRefunds)}</span>
                    </div>
                  </div>
                )}
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
                  <Badge variant="danger">{formatCurrency(data.expenses.total)}</Badge>
                </CardHeader>
                <div className="space-y-3">
                  {expenseBreakdown.map((item, i) => {
                    const pct = data!.expenses.total > 0 ? (item.amount / data!.expenses.total) * 100 : 0;
                    const colors = [
                      'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-rose-400',
                      'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400', 'bg-indigo-400',
                    ];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                            <span className="text-sm font-medium text-gray-800">{item.tag}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                            <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {expenseBreakdown.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin gastos en este período</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Monthly Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-violet-500" />
                    Evolución Mensual
                  </div>
                </CardTitle>
              </CardHeader>

              {/* Visual bar chart */}
              {data.monthlyBreakdown.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-end gap-1 sm:gap-2 h-40 sm:h-48">
                    {data.monthlyBreakdown.map((m) => {
                      const incomeH = (m.totalIncome / maxMonthlyIncome) * 100;
                      const expenseH = (m.expenses / maxMonthlyIncome) * 100;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                              <p className="font-medium"><MonthLabel month={m.month} /></p>
                              <p className="text-emerald-300">Ingresos: {formatCurrency(m.totalIncome)}</p>
                              <p className="text-red-300">Gastos: {formatCurrency(m.expenses)}</p>
                              <p className={m.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                Beneficio: {formatCurrency(m.profit)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full flex gap-0.5 items-end h-full">
                            <div
                              className="flex-1 bg-emerald-400 rounded-t-sm transition-all hover:bg-emerald-500"
                              style={{ height: `${Math.max(incomeH, 2)}%` }}
                            />
                            <div
                              className="flex-1 bg-red-300 rounded-t-sm transition-all hover:bg-red-400"
                              style={{ height: `${Math.max(expenseH, 2)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1">
                            <MonthLabel month={m.month} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                      <span className="text-xs text-gray-500">Ingresos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-300" />
                      <span className="text-xs text-gray-500">Gastos</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Mes</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Shopify</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Presencial</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Banco</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Total Ingresos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Gastos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Beneficio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyBreakdown.map((m) => (
                      <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-800">
                          <MonthLabel month={m.month} />
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">
                          {m.shopify > 0 ? formatCurrency(m.shopify) : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">
                          {m.ventas > 0 ? formatCurrency(m.ventas) : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">
                          {m.bankIncome > 0 ? formatCurrency(m.bankIncome) : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-right font-semibold text-gray-900">
                          {formatCurrency(m.totalIncome)}
                        </td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-red-500">
                          {m.expenses > 0 ? `-${formatCurrency(m.expenses)}` : '-'}
                        </td>
                        <td className={`px-4 sm:px-6 py-2.5 text-sm text-right font-semibold ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(m.profit)}
                        </td>
                      </tr>
                    ))}
                    {data.monthlyBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                          Sin datos para este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {data.monthlyBreakdown.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                        <td className="px-4 sm:px-6 py-3 text-sm font-bold text-gray-900">Total</td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                          {formatCurrency(data.income.shopify)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                          {formatCurrency(data.income.ventasPresenciales)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                          {formatCurrency(data.income.totalBankIncome)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                          {formatCurrency(data.income.total)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-red-600">
                          -{formatCurrency(data.expenses.total)}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-sm text-right font-bold ${data.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(data.profit)}
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
                      <Package size={16} className="text-violet-500" />
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
                            <span className="text-sm font-medium text-gray-800 truncate max-w-[200px] sm:max-w-none">
                              {product.title}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</span>
                            <span className="text-xs text-gray-400 ml-1.5">{formatNumber(product.units)} uds</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-7">
                          <div
                            className="h-full bg-violet-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
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
