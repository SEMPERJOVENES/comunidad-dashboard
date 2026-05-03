'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Users, Loader2, CreditCard, Smartphone, Landmark, Repeat,
  Search, ChevronDown, ChevronRight, Mail, Link2, AlertCircle,
} from 'lucide-react';

const METHOD_COLOR: Record<string, string> = {
  stripe: 'purple',
  bizum: 'info',
  transferencia: 'success',
  otro: 'default',
};
const METHOD_ICON: Record<string, any> = {
  stripe: CreditCard,
  bizum: Smartphone,
  transferencia: Landmark,
};
const METHOD_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  bizum: 'Bizum',
  transferencia: 'Transferencia',
};

export default function PagosPorMiembroPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/miembros-pagos?${params}`);
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [selectedRange]);

  const filtered = useMemo(() => {
    if (!data?.members) return [];
    return data.members.filter((m: any) => {
      if (search) {
        const s = search.toLowerCase();
        if (!(m.name.toLowerCase().includes(s) || (m.email || '').toLowerCase().includes(s) || (m.apodo || '').toLowerCase().includes(s))) return false;
      }
      if (filterMethod !== 'all') {
        if (filterMethod === 'sin pagos' && m.totalPaid > 0) return false;
        if (filterMethod !== 'sin pagos' && m.methodPrimary !== filterMethod) return false;
      }
      return true;
    });
  }, [data, search, filterMethod]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users size={20} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Pagos por miembro · 100% accuracy</h1>
            <p className="text-sm text-gray-500">Cómo paga cada uno: Stripe (suscripción), Bizum o Transferencia. Cruzado con Stripe API + banco.</p>
          </div>
          <a href="/miembros" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">← Vista diezmos</a>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-600" /></div>
        ) : !data ? (
          <Card><p className="text-center py-8 text-gray-400">Sin datos</p></Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <p className="text-xs text-gray-500 uppercase font-bold">Miembros</p>
                <p className="text-2xl font-bold text-gray-900">{data.totals.members}</p>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <p className="text-xs text-gray-500 uppercase font-bold">Pagan</p>
                <p className="text-2xl font-bold text-emerald-700">{data.totals.paying}</p>
                <p className="text-[10px] text-gray-400">{Math.round((data.totals.paying / data.totals.members) * 100)}%</p>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <p className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><Repeat size={11} /> Stripe activo</p>
                <p className="text-2xl font-bold text-purple-700">{data.totals.stripeActive}</p>
              </Card>
              <Card className="border-l-4 border-l-violet-500">
                <p className="text-xs text-gray-500 uppercase font-bold">Total recaudado</p>
                <p className="text-2xl font-bold text-violet-700">{formatCurrency(data.totals.totalRecaudado)}</p>
              </Card>
            </div>

            {/* Stripe sin matchear */}
            {data.unmatchedSubs?.length > 0 && (
              <Card className="border-2 border-amber-300 bg-amber-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-900">{data.unmatchedSubs.length} suscripciones Stripe sin vincular a ningún miembro</p>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.unmatchedSubs.map((s: any) => (
                    <div key={s.subscriptionId || s.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-white rounded">
                      <Mail size={11} className="text-amber-600" />
                      <span className="font-medium">{s.customerName}</span>
                      <span className="text-gray-400">{s.customerEmail}</span>
                      <span className="ml-auto font-semibold text-purple-700">{formatCurrency(s.amount)}/{s.interval}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-700 mt-2">
                  Vincúlalas desde <a href="/miembros" className="underline">/miembros</a> vista Tabla.
                </p>
              </Card>
            )}

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[
                  { k: 'all', l: 'Todos' },
                  { k: 'stripe', l: '💳 Stripe' },
                  { k: 'bizum', l: '📱 Bizum' },
                  { k: 'transferencia', l: '🏦 Transfer' },
                  { k: 'sin pagos', l: '✗ Sin pagar' },
                ].map(o => (
                  <button key={o.k} onClick={() => setFilterMethod(o.k)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filterMethod === o.k ? 'bg-white shadow-sm text-violet-700' : 'text-gray-600'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla principal */}
            <Card>
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Miembro</th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Comunidad</th>
                      <th className="text-center text-xs font-semibold text-gray-600 px-3 py-3">Método principal</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-purple-50/50">💳 Stripe</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-blue-50/50">📱 Bizum</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3 bg-emerald-50/50">🏦 Transfer</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-3 py-3">Total</th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Último pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m: any) => {
                      const isOpen = expanded === m.id;
                      return (
                        <>
                          <tr key={m.id} className={`border-b border-gray-50 hover:bg-violet-50/20 cursor-pointer ${!m.isActive ? 'opacity-50' : ''}`} onClick={() => setExpanded(isOpen ? null : m.id)}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {isOpen ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                                  {m.apodo && <p className="text-[10px] text-gray-400">"{m.apodo}"</p>}
                                  {m.pairedWith && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 mt-0.5">
                                      <Link2 size={9} /> Pareja vinculada
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-700">{m.community}</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {m.methodPrimary === 'sin pagos' ? (
                                <Badge variant="default">Sin pagar</Badge>
                              ) : (
                                <Badge variant={METHOD_COLOR[m.methodPrimary] as any}>
                                  {METHOD_LABEL[m.methodPrimary] || m.methodPrimary}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right bg-purple-50/30">
                              {m.methods.stripe.subscriptionActive && (
                                <p className="text-[10px] text-purple-700 font-bold">📅 Sub activa {m.methods.stripe.subscriptionAmount ? `${formatCurrency(m.methods.stripe.subscriptionAmount)}/${m.methods.stripe.subscriptionInterval || 'mes'}` : ''}</p>
                              )}
                              {m.methods.stripe.count > 0 ? (
                                <span className="text-sm font-semibold text-purple-700">{formatCurrency(m.methods.stripe.total)}</span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                              {m.methods.stripe.count > 0 && <span className="block text-[10px] text-gray-400">{m.methods.stripe.count} pagos</span>}
                            </td>
                            <td className="px-3 py-2 text-right bg-blue-50/30">
                              {m.methods.bizum.count > 0 ? (
                                <>
                                  <span className="text-sm font-semibold text-blue-700">{formatCurrency(m.methods.bizum.total)}</span>
                                  <span className="block text-[10px] text-gray-400">{m.methods.bizum.count} bizums</span>
                                </>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right bg-emerald-50/30">
                              {m.methods.transferencia.count > 0 ? (
                                <>
                                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(m.methods.transferencia.total)}</span>
                                  <span className="block text-[10px] text-gray-400">{m.methods.transferencia.count} transf.</span>
                                </>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-sm font-bold text-gray-900">{formatCurrency(m.totalPaid)}</span>
                              <span className="block text-[10px] text-gray-400">{m.paymentCount} pagos</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {m.lastPayment ? (
                                <>
                                  <p>{new Date(m.lastPayment.date).toLocaleDateString('es-ES')}</p>
                                  <p className="text-[10px] text-gray-400">{METHOD_LABEL[m.lastPayment.method] || m.lastPayment.method} · {formatCurrency(m.lastPayment.amount)}</p>
                                </>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-gray-50/40">
                              <td colSpan={8} className="px-4 py-3">
                                <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2">Histórico de pagos ({m.history.length})</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-60 overflow-y-auto">
                                  {m.history.map((h: any, i: number) => {
                                    const Icon = METHOD_ICON[h.method] || Landmark;
                                    return (
                                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 bg-white rounded border border-gray-100">
                                        <Icon size={11} className="text-gray-400 flex-shrink-0" />
                                        <span className="text-gray-500 w-20 flex-shrink-0">{new Date(h.date).toLocaleDateString('es-ES')}</span>
                                        <Badge variant={METHOD_COLOR[h.method] as any}>{METHOD_LABEL[h.method] || h.method}</Badge>
                                        <span className="flex-1 truncate text-gray-600 text-[10px]">{h.concept || '—'}</span>
                                        <span className="font-semibold text-gray-900 text-xs ml-auto">{formatCurrency(h.amount)}</span>
                                      </div>
                                    );
                                  })}
                                  {m.history.length === 0 && <p className="text-xs text-gray-400 italic col-span-2">Sin pagos registrados</p>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-3 px-4">
                Cruzado: <strong>diezmos_members</strong> + <strong>bank_transactions</strong> con tag Diezmo + <strong>Stripe API</strong> (subscriptions + charges). Matching por email Stripe → email miembro → fuzzy nombre (≥2 palabras coincidentes).
              </p>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
