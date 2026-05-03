'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Scale, Loader2, Check, AlertTriangle, AlertCircle,
  ChevronDown, ChevronRight, ShoppingCart, Store, Landmark,
} from 'lucide-react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function MonthLabel({ month }: { month: string }) {
  const [year, m] = month.split('-');
  return <span>{MONTH_NAMES[parseInt(m) - 1]} {year.slice(2)}</span>;
}

interface MonthData {
  month: string;
  teorico: { shopify: number; ventas: number; total: number; orders: number; ventasCount: number };
  real: { bizum: number; transferencia: number; stripePayout: number; total: number; txs: number };
  diferencia: number;
  pct: number;
  detalle: {
    shopifyOrders: Array<{ name: string; total: number; date: string; financial_status: string }>;
    ventas: Array<{ id: string; customer: string; total: number; date: string; method: string; saleType: string }>;
    bankBrand: Array<{ id: string; concept: string; amount: number; date: string; tag: string }>;
  };
}

export default function ConciliacionPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [data, setData] = useState<{ months: MonthData[]; totals: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/conciliacion?${params}`);
        if (res.ok) setData(await res.json());
      } catch { setData(null); }
      finally { setLoading(false); }
    }
    fetch_();
  }, [selectedRange]);

  function status(diff: number, pct: number, teorico: number) {
    if (teorico === 0) return { color: 'gray', icon: AlertCircle, label: 'Sin datos teóricos' };
    if (Math.abs(pct) <= 5) return { color: 'emerald', icon: Check, label: 'Cuadra' };
    if (Math.abs(pct) <= 15) return { color: 'amber', icon: AlertTriangle, label: 'Desviación moderada' };
    return { color: 'red', icon: AlertCircle, label: 'Desviación alta' };
  }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Scale size={24} className="text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Conciliación bancaria</h1>
            <p className="text-sm text-gray-500">Ingresos teóricos (Shopify + Presencial) vs reales del banco</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={28} />
            <span className="ml-3 text-gray-500">Calculando...</span>
          </div>
        ) : !data ? (
          <Card><p className="text-center text-gray-400 py-12">Sin datos</p></Card>
        ) : (
          <>
            {/* Totales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-violet-500">
                <p className="text-xs text-gray-500 font-medium uppercase">Teórico (lo que debería entrar)</p>
                <p className="text-2xl font-bold text-violet-700 mt-1">{formatCurrency(data.totals.teoricoTotal)}</p>
                <div className="text-[11px] text-gray-400 mt-2 space-y-0.5">
                  <p>Shopify: {formatCurrency(data.totals.teoricoShopify)}</p>
                  <p>Presencial: {formatCurrency(data.totals.teoricoVentas)}</p>
                </div>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <p className="text-xs text-gray-500 font-medium uppercase">Real (entró al banco)</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(data.totals.realTotal)}</p>
                <div className="text-[11px] text-gray-400 mt-2 space-y-0.5">
                  <p>Stripe payouts: {formatCurrency(data.totals.realStripe)}</p>
                  <p>Bizum: {formatCurrency(data.totals.realBizum)}</p>
                  <p>Transferencias: {formatCurrency(data.totals.realTransfer)}</p>
                </div>
              </Card>
              <Card className={`border-l-4 ${
                Math.abs(data.totals.teoricoTotal - data.totals.realTotal) <= data.totals.teoricoTotal * 0.05
                  ? 'border-l-emerald-500' : 'border-l-amber-500'
              }`}>
                <p className="text-xs text-gray-500 font-medium uppercase">Diferencia</p>
                <p className={`text-2xl font-bold mt-1 ${
                  data.totals.teoricoTotal - data.totals.realTotal >= 0 ? 'text-amber-700' : 'text-red-600'
                }`}>
                  {formatCurrency(data.totals.teoricoTotal - data.totals.realTotal)}
                </p>
                <p className="text-[11px] text-gray-400 mt-2">
                  {data.totals.teoricoTotal > 0
                    ? `${(((data.totals.teoricoTotal - data.totals.realTotal) / data.totals.teoricoTotal) * 100).toFixed(1)}% desv.`
                    : 'Sin teórico'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {data.totals.teoricoTotal > data.totals.realTotal
                    ? '⚠️ Falta entrada en banco (cobros pendientes / Bizum no etiquetado)'
                    : '⚠️ Banco recibió más de lo registrado teóricamente'}
                </p>
              </Card>
            </div>

            {/* Por mes */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Por mes</h3>
              <div className="space-y-2">
                {data.months.map((m) => {
                  const st = status(m.diferencia, m.pct, m.teorico.total);
                  const Icon = st.icon;
                  const isOpen = expanded === m.month;
                  return (
                    <div key={m.month} className="border border-gray-100 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpanded(isOpen ? null : m.month)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                      >
                        {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        <div className="text-sm font-bold text-gray-900 w-20">
                          <MonthLabel month={m.month} />
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400">Teórico:</span>{' '}
                            <span className="font-semibold text-violet-700">{formatCurrency(m.teorico.total)}</span>
                            <span className="text-gray-400 ml-1">({m.teorico.orders + m.teorico.ventasCount})</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Real:</span>{' '}
                            <span className="font-semibold text-blue-700">{formatCurrency(m.real.total)}</span>
                            <span className="text-gray-400 ml-1">({m.real.txs})</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-semibold text-${st.color}-600`}>
                              {formatCurrency(m.diferencia)} ({m.pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <Badge variant={st.color === 'emerald' ? 'success' : st.color === 'amber' ? 'warning' : st.color === 'red' ? 'danger' : 'default'}>
                          <Icon size={10} className="inline mr-1" />
                          {st.label}
                        </Badge>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                          {/* Teórico */}
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <ShoppingCart size={12} /> Teórico Shopify ({m.detalle.shopifyOrders.length})
                            </p>
                            <div className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                              {m.detalle.shopifyOrders.map((o, i) => (
                                <div key={i} className="flex justify-between hover:bg-white px-2 py-0.5 rounded">
                                  <span className="text-gray-600 truncate">{o.name} · {new Date(o.date).toLocaleDateString('es-ES')}</span>
                                  <span className="font-medium">{formatCurrency(o.total)}</span>
                                </div>
                              ))}
                              {m.detalle.shopifyOrders.length === 0 && <p className="text-gray-400">Sin pedidos</p>}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Store size={12} /> Teórico Presencial ({m.detalle.ventas.length})
                            </p>
                            <div className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                              {m.detalle.ventas.map((v, i) => (
                                <div key={i} className="flex justify-between hover:bg-white px-2 py-0.5 rounded">
                                  <span className="text-gray-600 truncate">{v.customer} · {v.method} · {new Date(v.date).toLocaleDateString('es-ES')}</span>
                                  <span className="font-medium">{formatCurrency(v.total)}</span>
                                </div>
                              ))}
                              {m.detalle.ventas.length === 0 && <p className="text-gray-400">Sin ventas presenciales</p>}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Landmark size={12} /> Real banco brand ({m.detalle.bankBrand.length})
                            </p>
                            <div className="text-[11px] space-y-0.5 max-h-40 overflow-y-auto">
                              {m.detalle.bankBrand.map((b, i) => (
                                <div key={i} className="flex justify-between hover:bg-white px-2 py-0.5 rounded">
                                  <span className="text-gray-600 truncate">{b.concept.substring(0, 70)} · {new Date(b.date).toLocaleDateString('es-ES')}</span>
                                  <span className="font-medium">{formatCurrency(b.amount)}</span>
                                </div>
                              ))}
                              {m.detalle.bankBrand.length === 0 && <p className="text-gray-400">Sin movimientos brand en banco</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="text-xs text-gray-400 px-4">
              <p><strong>Cómo interpretar:</strong></p>
              <p>· <span className="text-emerald-700 font-semibold">Cuadra (≤5%)</span>: ingresos teóricos y reales coinciden — todo facturado entró al banco.</p>
              <p>· <span className="text-amber-700 font-semibold">Desviación moderada (5-15%)</span>: posible Bizum sin etiquetar, ventas con efectivo no depositadas, o desfase Stripe payout.</p>
              <p>· <span className="text-red-700 font-semibold">Desviación alta (&gt;15%)</span>: revisar. Puede haber Bizums no contados, ventas mal registradas, o pagos en efectivo no ingresados.</p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
