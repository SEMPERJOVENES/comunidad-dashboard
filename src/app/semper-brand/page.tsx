'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatNumber, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, ShoppingCart,
  Store, Landmark, Package, Loader2, ArrowUpRight, ArrowDownRight,
  BarChart3, Plus, Trash2, Calendar, Truck, User, CreditCard, X, Check,
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

export default function SemperBrandPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[8]);
  const [data, setData] = useState<SemperBrandData | null>(null);
  const [costsData, setCostsData] = useState<BrandCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState('year');
  const [showAddCost, setShowAddCost] = useState(false);
  const [costForm, setCostForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'cogs', description: '', amount: '', product: '' });
  const [showCostsList, setShowCostsList] = useState(false);

  const monthFilters = useMemo(() => getMonthFilters(selectedYear), [selectedYear]);

  const effectiveRange = useMemo(() => {
    const mf = monthFilters.find(f => f.key === monthFilter);
    if (mf) return { start: mf.start, end: mf.end };
    return { start: selectedRange.startDate, end: selectedRange.endDate };
  }, [monthFilter, monthFilters, selectedRange]);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: effectiveRange.start.toISOString(),
        end: effectiveRange.end.toISOString(),
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

  useEffect(() => { fetchAll(); }, [effectiveRange]);

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

  // Combined P&L
  const totalManualCosts = costsData?.total || 0;
  const totalExpenses = (data?.expenses.total || 0) + totalManualCosts;
  const totalIncome = data?.income.total || 0;
  const netProfit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const incomeBreakdown = useMemo(() => {
    if (!data) return [];
    const items: { label: string; amount: number; icon: any; color: string; bg: string; detail: string }[] = [];
    if (data.income.shopify > 0) {
      items.push({ label: 'Shopify', amount: data.income.shopify, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50', detail: `${data.income.shopifyOrders} órdenes` });
    }
    if (data.income.ventasPresenciales > 0) {
      items.push({ label: 'Ventas Presenciales', amount: data.income.ventasPresenciales, icon: Store, color: 'text-emerald-600', bg: 'bg-emerald-50', detail: `${data.income.ventasCount} ventas` });
    }
    Object.entries(data.income.bankIncome).forEach(([tag, amount]) => {
      items.push({ label: tag, amount, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', detail: 'Banco' });
    });
    return items.sort((a, b) => b.amount - a.amount);
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    if (!data) return [];
    const items: { tag: string; amount: number }[] = [];
    // Bank expenses
    Object.entries(data.expenses.byTag).forEach(([tag, amount]) => {
      items.push({ tag, amount });
    });
    // Manual costs
    if (costsData) {
      Object.entries(costsData.byType).forEach(([type, amount]) => {
        const ct = COST_TYPES.find(c => c.value === type);
        items.push({ tag: `📦 ${ct?.label || type}`, amount });
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
                      ? 'bg-indigo-600 text-white shadow-sm'
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
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {mf.label}
              </button>
            ))}
          </div>
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
            {/* KPI Cards - P&L Formula: Income - Auto - Manual = Real Profit */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="!p-4 border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-gray-400 mt-1">{data.income.shopifyOrders + data.income.ventasCount} operaciones</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-orange-500">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark size={14} className="text-orange-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Gastos Auto</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{formatCurrency(data.expenses.total)}</p>
                <p className="text-xs text-gray-400 mt-1">Shopify ~36€/mes, Ionos...</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-1">
                  <Package size={14} className="text-red-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Costes Manual</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(totalManualCosts)}</p>
                <p className="text-xs text-gray-400 mt-1">Stock, envío, otros</p>
              </Card>
              <Card className={`!p-4 border-l-4 ${netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-gray-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Beneficio Real</p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-indigo-500">
                <div className="flex items-center gap-2 mb-1">
                  <Percent size={14} className="text-indigo-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase">Margen</p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${margin >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </p>
              </Card>
            </div>

            {/* P&L Formula visual */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg py-2 px-4 overflow-x-auto">
              <span className="text-emerald-600 font-semibold whitespace-nowrap">{formatCurrency(totalIncome)}</span>
              <span>−</span>
              <span className="text-orange-600 font-semibold whitespace-nowrap">{formatCurrency(data.expenses.total)}</span>
              <span>−</span>
              <span className="text-red-600 font-semibold whitespace-nowrap">{formatCurrency(totalManualCosts)}</span>
              <span>=</span>
              <span className={`font-bold whitespace-nowrap ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(netProfit)}</span>
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
                  <Badge variant="success">{formatCurrency(totalIncome)}</Badge>
                </CardHeader>
                <div className="space-y-3">
                  {incomeBreakdown.map((item, i) => {
                    const pct = totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0;
                    return (
                      <div key={i}>
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
                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {incomeBreakdown.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ingresos en este período</p>
                  )}
                  {data.income.shopifyRefunds > 0 && (
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Devoluciones Shopify</span>
                      <span className="text-red-500 font-medium">-{formatCurrency(data.income.shopifyRefunds)}</span>
                    </div>
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
                          <div className={`h-full ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
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
                {/* Summary by type */}
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
                {/* Detail list */}
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
                                  className="p-1.5 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
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

            {/* Monthly Breakdown */}
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
                  <div className="flex items-end gap-1 sm:gap-2 h-40 sm:h-48">
                    {data.monthlyBreakdown.map((m) => {
                      const monthCosts = costsData?.byMonth[m.month] || 0;
                      const incomeH = (m.totalIncome / maxMonthlyIncome) * 100;
                      const totalExp = m.expenses + monthCosts;
                      const expenseH = (totalExp / maxMonthlyIncome) * 100;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                              <p className="font-medium"><MonthLabel month={m.month} /></p>
                              <p className="text-emerald-300">Ingresos: {formatCurrency(m.totalIncome)}</p>
                              <p className="text-red-300">Gastos banco: {formatCurrency(m.expenses)}</p>
                              {monthCosts > 0 && <p className="text-orange-300">Costes manual: {formatCurrency(monthCosts)}</p>}
                              <p className={m.totalIncome - totalExp >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                Beneficio: {formatCurrency(m.totalIncome - totalExp)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full flex gap-0.5 items-end h-full">
                            <div className="flex-1 bg-emerald-400 rounded-t-sm transition-all hover:bg-emerald-500"
                              style={{ height: `${Math.max(incomeH, 2)}%` }} />
                            <div className="flex-1 bg-red-300 rounded-t-sm transition-all hover:bg-red-400"
                              style={{ height: `${Math.max(expenseH, 2)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1"><MonthLabel month={m.month} /></span>
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

              {/* Table */}
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Mes</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Shopify</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Presencial</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Banco</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ingresos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Gastos</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Costes</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Beneficio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyBreakdown.map((m) => {
                      const monthCosts = costsData?.byMonth[m.month] || 0;
                      const totalExp = m.expenses + monthCosts;
                      const profit = m.totalIncome - totalExp;
                      return (
                        <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-800"><MonthLabel month={m.month} /></td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.shopify > 0 ? formatCurrency(m.shopify) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.ventas > 0 ? formatCurrency(m.ventas) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-600">{m.bankIncome > 0 ? formatCurrency(m.bankIncome) : '-'}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right font-semibold text-gray-900">{formatCurrency(m.totalIncome)}</td>
                          <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-red-500">{m.expenses > 0 ? `-${formatCurrency(m.expenses)}` : '-'}</td>
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
                        <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-red-600">-{formatCurrency(data.expenses.total)}</td>
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
