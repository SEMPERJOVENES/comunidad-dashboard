'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Church, Loader2, TrendingUp, TrendingDown, Users, Wallet, Repeat,
  Activity, BarChart3, ArrowUpRight, ArrowDownRight, AlertTriangle,
} from 'lucide-react';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function formatMonth(key: string) { const [y,m] = key.split('-'); return `${MONTHS_SHORT[parseInt(m)-1]} ${y.slice(2)}`; }

export default function DiezmosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    label: 'Este año',
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(),
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: new Date(2023, 0, 1).toISOString(),
          end: new Date().toISOString(),
        });
        const res = await fetch(`/api/diezmos?${params}`);
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [selectedRange]);

  const summary = data?.summary;
  const ops = data?.operationalExpenses;

  const currentMonth = useMemo(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }, []);
  const prevMonth = useMemo(() => { const n = new Date(); n.setMonth(n.getMonth()-1); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }, []);

  const currentMonthData = useMemo(() => ops?.monthlyChart?.find((x:any) => x.month === currentMonth) || { income: 0, expenses: 0, net: 0 }, [ops, currentMonth]);
  const prevMonthData = useMemo(() => ops?.monthlyChart?.find((x:any) => x.month === prevMonth) || { income: 0, expenses: 0, net: 0 }, [ops, prevMonth]);

  const monthDelta = currentMonthData.income - prevMonthData.income;
  const monthDeltaPct = prevMonthData.income > 0 ? Math.round((monthDelta / prevMonthData.income) * 100) : 0;

  const maxMonthlyValue = useMemo(() => {
    if (!ops?.monthlyChart) return 0;
    return Math.max(...ops.monthlyChart.map((m: any) => Math.max(m.income, m.expenses)), 1);
  }, [ops]);

  const last12Months = useMemo(() => {
    if (!ops?.monthlyChart) return [];
    return ops.monthlyChart.slice(-12);
  }, [ops]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <Church size={22} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Diezmos</h1>
            <p className="text-sm text-gray-500">Métricas financieras de la comunidad · Ingresos vs gastos operativos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/miembros" className="text-xs px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium">Ver Miembros →</a>
            <a href="/miembros/pagos" className="text-xs px-3 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 font-medium">Conciliación →</a>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-600" size={32} /></div>
        ) : !data ? (
          <Card><p className="text-center py-8 text-gray-400">Sin datos</p></Card>
        ) : (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="!p-4 border-l-4 border-l-emerald-500 bg-emerald-50/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1.5">
                    <TrendingUp size={11} /> Recaudado este mes
                  </p>
                  {monthDelta !== 0 && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${monthDelta > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {monthDelta > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />} {monthDeltaPct}%
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(currentMonthData.income)}</p>
                <p className="text-[11px] text-gray-500 mt-1">{formatMonth(currentMonth)} · vs {formatCurrency(prevMonthData.income)} anterior</p>
              </Card>

              <Card className="!p-4 border-l-4 border-l-rose-500 bg-rose-50/30">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1.5 mb-2">
                  <TrendingDown size={11} /> Gastos este mes
                </p>
                <p className="text-2xl font-bold text-rose-700">{formatCurrency(currentMonthData.expenses)}</p>
                <p className="text-[11px] text-gray-500 mt-1">{formatMonth(currentMonth)} · operativos</p>
              </Card>

              <Card className="!p-4 border-l-4 border-l-violet-500 bg-violet-50/30">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1.5 mb-2">
                  <Wallet size={11} /> Neto este mes
                </p>
                <p className={`text-2xl font-bold ${currentMonthData.net >= 0 ? 'text-violet-700' : 'text-rose-600'}`}>
                  {formatCurrency(currentMonthData.net)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Ingresos - Gastos</p>
              </Card>

              <Card className="!p-4 border-l-4 border-l-blue-500 bg-blue-50/30">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1.5 mb-2">
                  <Users size={11} /> Miembros pagando
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-blue-700">{summary?.totalPaying || 0}</p>
                  <p className="text-sm text-gray-400">/ {summary?.totalMembers || 0}</p>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${summary?.totalMembers > 0 ? Math.round((summary.totalPaying / summary.totalMembers) * 100) : 0}%` }} />
                </div>
              </Card>
            </div>

            {/* KPIs secundarios */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="!p-3.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1.5">
                  <Repeat size={11} /> Stripe activos
                </p>
                <p className="text-xl font-bold text-purple-700 mt-1">{summary?.matchedStripeSubs || 0} <span className="text-xs text-gray-400 font-normal">/ {summary?.totalStripeSubs || 0}</span></p>
              </Card>
              <Card className="!p-3.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Stripe recaudado</p>
                <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(summary?.totalStripeFromPayments || 0)}</p>
                <p className="text-[10px] text-gray-400">Comisión: {formatCurrency(summary?.stripeCommission || 0)}</p>
              </Card>
              <Card className="!p-3.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total ingresos rango</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(ops?.totalIncome || 0)}</p>
              </Card>
              <Card className="!p-3.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total gastos rango</p>
                <p className="text-xl font-bold text-rose-700 mt-1">{formatCurrency(ops?.totalExpenses || 0)}</p>
                <p className={`text-[10px] font-semibold ${(ops?.net || 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Neto: {formatCurrency(ops?.net || 0)}</p>
              </Card>
            </div>

            {/* Gráfico mensual */}
            {last12Months.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-violet-600" />
                  <h3 className="text-sm font-bold text-gray-900">Evolución mensual</h3>
                  <span className="ml-auto text-[10px] text-gray-400">Últimos {last12Months.length} meses</span>
                </div>
                <div className="space-y-2">
                  {last12Months.map((m: any) => {
                    const incomeW = (m.income / maxMonthlyValue) * 100;
                    const expW = (m.expenses / maxMonthlyValue) * 100;
                    const isCurrent = m.month === currentMonth;
                    return (
                      <div key={m.month} className={`flex items-center gap-3 p-2 rounded-lg ${isCurrent ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                        <span className={`text-xs font-bold w-14 flex-shrink-0 ${isCurrent ? 'text-violet-700' : 'text-gray-500'}`}>{formatMonth(m.month)}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(incomeW, 2)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-emerald-700 w-20 text-right">{formatCurrency(m.income)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.max(expW, 2)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-rose-600 w-20 text-right">{formatCurrency(m.expenses)}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold w-20 text-right ${m.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {formatCurrency(m.net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Ingresos</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-400 rounded" /> Gastos</span>
                  <span className="ml-auto text-violet-600 font-semibold">Neto = Ingresos - Gastos</span>
                </div>
              </Card>
            )}

            {/* Top categorías de gasto */}
            {ops?.byTag && ops.byTag.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-rose-500" />
                  <h3 className="text-sm font-bold text-gray-900">Categorías de gasto</h3>
                  <span className="ml-auto text-[10px] text-gray-400">{ops.byTag.length} categorías</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ops.byTag.slice(0, 12).map((cat: any) => {
                    const pct = (cat.amount / ops.totalExpenses) * 100;
                    return (
                      <div key={cat.tag} className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-gray-800 truncate flex-1">{cat.tag}</p>
                          <span className="text-[10px] text-rose-500 font-bold ml-2">{Math.round(pct)}%</span>
                        </div>
                        <p className="text-base font-bold text-rose-700">{formatCurrency(cat.amount)}</p>
                        <div className="h-1 bg-rose-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Movimientos recientes */}
            {ops?.recentExpenses && ops.recentExpenses.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-900">Gastos recientes</h3>
                  <span className="ml-auto text-[10px] text-gray-400">Últimos 20</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {ops.recentExpenses.slice(0, 20).map((tx: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <TrendingDown size={13} className="text-rose-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.concept || tx.tag}</p>
                        <p className="text-[10px] text-gray-400">{formatMonth(tx.month)} · {tx.tag}</p>
                      </div>
                      <span className="text-sm font-bold text-rose-600 flex-shrink-0">{formatCurrency(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
