'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  CreditCard, Loader2, RefreshCw, Repeat, ShoppingBag, AlertCircle,
  TrendingUp, Wallet, ArrowRight, ChevronDown, ChevronRight, Lock,
  ArrowDownToLine,
} from 'lucide-react';

export default function StripePage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/stripe?${params}`);
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [selectedRange]);

  const split = useMemo(() => {
    const charges = data?.charges || [];
    const paid = charges.filter((c: any) => c.paid && c.status === 'succeeded');
    const subs = paid.filter((c: any) => c.isSubscription);
    const oneTime = paid.filter((c: any) => !c.isSubscription);
    const subsTotal = subs.reduce((s: number, c: any) => s + c.amount - (c.amountRefunded || 0), 0);
    const oneTimeTotal = oneTime.reduce((s: number, c: any) => s + c.amount - (c.amountRefunded || 0), 0);
    const refundsTotal = paid.reduce((s: number, c: any) => s + (c.amountRefunded || 0), 0);
    const subsByCustomer = new Map<string, { name: string; email: string; total: number; charges: any[] }>();
    for (const c of subs) {
      const key = c.customerEmail || c.customerName || 'desconocido';
      if (!subsByCustomer.has(key)) {
        subsByCustomer.set(key, { name: c.customerName || '?', email: c.customerEmail || '', total: 0, charges: [] });
      }
      const e = subsByCustomer.get(key)!;
      e.total += c.amount - (c.amountRefunded || 0);
      e.charges.push(c);
    }
    return {
      subs, oneTime, subsTotal, oneTimeTotal, refundsTotal,
      total: subsTotal + oneTimeTotal,
      subsByCustomer: Array.from(subsByCustomer.values()).sort((a, b) => b.total - a.total),
    };
  }, [data]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <CreditCard size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Stripe</h1>
            <p className="text-sm text-gray-500">Suscripciones (Diezmo) vs pagos puntuales (Brand) · clasificación automática desde Stripe API</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
        ) : !data ? (
          <Card><p className="text-center py-8 text-gray-400">Sin datos</p></Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-violet-500">
                <div className="flex items-center gap-2 mb-2">
                  <Repeat size={16} className="text-violet-600" />
                  <p className="text-xs uppercase font-bold text-gray-500">Suscripciones · Diezmo</p>
                </div>
                <p className="text-3xl font-bold text-violet-700">{formatCurrency(split.subsTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">{split.subs.length} cargos · {split.subsByCustomer.length} suscriptores</p>
              </Card>
              <Card className="border-l-4 border-l-indigo-500">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag size={16} className="text-indigo-600" />
                  <p className="text-xs uppercase font-bold text-gray-500">Pagos puntuales · Brand</p>
                </div>
                <p className="text-3xl font-bold text-indigo-700">{formatCurrency(split.oneTimeTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">{split.oneTime.length} cargos one-time</p>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  <p className="text-xs uppercase font-bold text-gray-500">Total cobrado</p>
                </div>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(split.total)}</p>
                <p className="text-xs text-gray-500 mt-1">Refunds: -{formatCurrency(split.refundsTotal)}</p>
              </Card>
            </div>

            {/* Banner explicativo */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start gap-3">
              <Lock size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-violet-900">
                <strong>Cómo se clasifica</strong>: cada cargo en Stripe se identifica como suscripción si tiene un <code className="bg-violet-100 px-1 rounded">invoice</code> asociado (subscriptions API) → <Badge variant="purple">Diezmo</Badge>.
                Si no tiene invoice → es pago puntual → <Badge variant="info">Brand</Badge>.
                Cuando llegan al banco como "Transferencia De Stripe", se clasifican según el desglose REAL del payout (sección abajo).
              </div>
            </div>

            {/* PAYOUTS — desglose real Diezmo/Brand */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownToLine size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Payouts al banco — desglose Diezmo / Brand</h3>
                <span className="ml-auto text-[11px] text-gray-400">Cada payout cruzado con su composición real</span>
              </div>

              <div className="space-y-2">
                {(data?.payouts || []).length === 0 && <p className="text-xs text-gray-400 italic">Sin payouts en el periodo</p>}
                {(data?.payouts || []).map((p: any) => {
                  const bd = p.breakdown;
                  const isOpen = expanded === p.id;
                  const composition = bd?.composition;
                  const compLabel = composition === 'pure_subscription' ? '100% Diezmo' :
                                    composition === 'pure_one_time' ? '100% Brand' :
                                    composition === 'mixed' ? 'Mixto' : 'Vacío';
                  const compColor = composition === 'pure_subscription' ? 'purple' :
                                    composition === 'pure_one_time' ? 'info' :
                                    composition === 'mixed' ? 'warning' : 'default';

                  return (
                    <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                        className="w-full px-4 py-3 hover:bg-gray-50 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">{new Date(p.arrival_date).toLocaleDateString('es-ES')}</span>
                          <Badge variant={compColor as any}>{compLabel}</Badge>
                          {bd && (
                            <div className="flex items-center gap-2 text-xs flex-1 min-w-0 overflow-hidden">
                              {bd.subsAmount > 0 && (
                                <span className="text-violet-700 font-medium whitespace-nowrap">
                                  Diezmo: {formatCurrency(bd.subsAmount)}
                                </span>
                              )}
                              {bd.subsAmount > 0 && bd.oneTimeAmount > 0 && <span className="text-gray-300">·</span>}
                              {bd.oneTimeAmount > 0 && (
                                <span className="text-indigo-700 font-medium whitespace-nowrap">
                                  Brand: {formatCurrency(bd.oneTimeAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-base font-bold text-gray-900 ml-3 flex-shrink-0">{formatCurrency(p.amount)}</span>
                      </button>

                      {isOpen && bd && (
                        <div className="border-t border-gray-100 bg-gray-50/40 p-4 space-y-3">
                          {/* Barra proporcional */}
                          {bd.total > 0 && (
                            <div>
                              <div className="flex items-center text-[10px] text-gray-500 mb-1 gap-3">
                                <span>Diezmo {bd.pctSubs.toFixed(1)}%</span>
                                <span className="ml-auto">Brand {bd.pctOneTime.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                <div className="bg-violet-500 h-full" style={{ width: `${bd.pctSubs}%` }} />
                                <div className="bg-indigo-500 h-full" style={{ width: `${bd.pctOneTime}%` }} />
                              </div>
                            </div>
                          )}

                          {/* Lista de cargos */}
                          <div>
                            <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Cargos del payout ({bd.breakdown.length})</p>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                              {bd.breakdown.map((b: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 bg-white rounded border border-gray-100">
                                  <Badge variant={
                                    b.type === 'subscription' ? 'purple' :
                                    b.type === 'one_time' ? 'info' :
                                    b.type === 'refund' ? 'danger' :
                                    'default'
                                  }>
                                    {b.type === 'subscription' ? 'Diezmo' :
                                     b.type === 'one_time' ? 'Brand' :
                                     b.type === 'refund' ? 'Refund' :
                                     b.type === 'fee' ? 'Fee' : b.type}
                                  </Badge>
                                  <span className="text-gray-400 flex-shrink-0">{new Date(b.created).toLocaleDateString('es-ES')}</span>
                                  <span className="flex-1 truncate text-gray-700">
                                    {b.customerName || b.description || '—'}
                                  </span>
                                  <span className="text-right">
                                    <span className="font-semibold">{formatCurrency(b.net)}</span>
                                    {b.fee > 0 && <span className="text-[10px] text-gray-400 ml-1">(fee {formatCurrency(b.fee)})</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {bd.composition === 'mixed' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800 flex items-start gap-2">
                              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                              <span>
                                Este payout tiene Diezmo y Brand mezclados. En el banco se etiquetó como una sola categoría
                                según el "Concepto" que asigna el banco. El desglose real se ve aquí.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Suscriptores activos */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Repeat size={16} className="text-violet-600" />
                <h3 className="text-sm font-bold text-gray-900">Suscriptores activos · {formatCurrency(split.subsTotal)}</h3>
                <span className="ml-auto text-xs text-gray-400">{split.subsByCustomer.length} personas</span>
              </div>
              <div className="space-y-2">
                {split.subsByCustomer.length === 0 && <p className="text-xs text-gray-400 italic">Sin suscripciones en el periodo</p>}
                {split.subsByCustomer.map((s, i) => (
                  <div key={i} className="border border-violet-100 rounded-lg p-3 hover:bg-violet-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-violet-700">{formatCurrency(s.total)}</p>
                        <p className="text-[10px] text-gray-400">{s.charges.length} pagos</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Pagos puntuales */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">Pagos puntuales · {formatCurrency(split.oneTimeTotal)}</h3>
                <span className="ml-auto text-xs text-gray-400">{split.oneTime.length} cargos</span>
              </div>
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50 text-xs">
                      <th className="text-left font-semibold text-gray-600 px-3 py-2">Fecha</th>
                      <th className="text-left font-semibold text-gray-600 px-3 py-2">Cliente</th>
                      <th className="text-left font-semibold text-gray-600 px-3 py-2">Descripción</th>
                      <th className="text-right font-semibold text-gray-600 px-3 py-2">Importe</th>
                      <th className="text-center font-semibold text-gray-600 px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {split.oneTime.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6 text-xs text-gray-400 italic">Sin pagos puntuales</td></tr>
                    )}
                    {split.oneTime.sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime()).map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-500">{new Date(c.created).toLocaleDateString('es-ES')}</td>
                        <td className="px-3 py-2 text-xs">
                          <p className="font-medium text-gray-900">{c.customerName || 'Anónimo'}</p>
                          <p className="text-gray-400">{c.customerEmail || ''}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[180px]">{c.description || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                          {formatCurrency(c.amount - (c.amountRefunded || 0))}
                          {c.amountRefunded > 0 && <span className="block text-[10px] text-red-500">−{formatCurrency(c.amountRefunded)} refund</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.refunded ? <Badge variant="danger">Refund</Badge> : c.disputed ? <Badge variant="warning">Disputed</Badge> : <Badge variant="success">OK</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
