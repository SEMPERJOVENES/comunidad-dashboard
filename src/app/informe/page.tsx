'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Printer, Loader2, ArrowLeft, CreditCard, Smartphone, Landmark, Check, X, Cake, Church, Repeat, Wallet, Banknote, Package, Scale, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { findBirthday } from '@/lib/birthdays';

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_LABELS_SHORT = ['E','F','M','A','M','J','J','A','S','O','N','D'];
const COMMUNITY_ORDER = ['San Pablo', 'San Ignacio', 'San Martín', 'Colaboradores'];

const COMMUNITY_COLORS: Record<string, { bg: string; text: string; gradient: string; border: string }> = {
  'San Pablo':     { bg: '#3b82f6', text: '#1e40af', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: '#bfdbfe' },
  'San Ignacio':   { bg: '#10b981', text: '#065f46', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '#a7f3d0' },
  'San Martín':    { bg: '#f97316', text: '#9a3412', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: '#fed7aa' },
  'Colaboradores': { bg: '#8b5cf6', text: '#5b21b6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', border: '#ddd6fe' },
};
const DEFAULT_COLOR = COMMUNITY_COLORS['Colaboradores'];

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function InformePage() {
  const [data, setData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [brandData, setBrandData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'diezmos' | 'completo'>('diezmos');
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  useEffect(() => {
    // Leer query params
    const params = new URL(window.location.href).searchParams;
    const type = params.get('type') === 'completo' ? 'completo' : 'diezmos';
    setReportType(type);
    const startParam = params.get('start');
    const endParam = params.get('end');
    const start = startParam ? new Date(startParam) : new Date(2026, 0, 1);
    const end = endParam ? new Date(endParam) : new Date();
    setRangeStart(start);
    setRangeEnd(end);

    async function load() {
      setLoading(true);
      try {
        const sStr = start.toISOString();
        const eStr = end.toISOString();
        const promises: Promise<any>[] = [
          fetch(`/api/miembros-pagos?start=${sStr}&end=${eStr}`).then(r => r.ok ? r.json() : null),
        ];
        if (type === 'completo') {
          promises.push(fetch(`/api/dashboard?start=${sStr}&end=${eStr}`).then(r => r.ok ? r.json() : null));
          promises.push(fetch(`/api/semper-brand?start=${sStr}&end=${eStr}`).then(r => r.ok ? r.json() : null));
        }
        const [d, dash, brand] = await Promise.all(promises);
        setData(d);
        setDashboardData(dash || null);
        setBrandData(brand || null);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const fechaImpresion = today.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // Combinar parejas: solo una entrada por pareja vinculada
  const visibleMembers = useMemo(() => {
    if (!data?.members) return [];
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const m of data.members) {
      if (seen.has(m.id)) continue;
      if (m.pairedWith && data.members.find((x: any) => x.id === m.pairedWith)) {
        seen.add(m.id); seen.add(m.pairedWith);
        const pair = data.members.find((x: any) => x.id === m.pairedWith);
        const main = (m.methods.stripe.subscriptionActive ? m :
          pair.methods.stripe.subscriptionActive ? pair :
          m.totalPaid >= pair.totalPaid ? m : pair);
        const partner = main.id === m.id ? pair : m;
        combined.push({ ...main, _isPair: true, _partner: partner });
      } else {
        combined.push(m);
      }
    }
    return combined;
  }, [data]);

  // Comunidades presentes
  const allCommunities = useMemo(() => {
    if (!visibleMembers.length) return [];
    const set = new Set<string>(visibleMembers.map((m: any) => m.community).filter(Boolean));
    const arr = Array.from(set);
    arr.sort((a, b) => COMMUNITY_ORDER.indexOf(a) - COMMUNITY_ORDER.indexOf(b));
    return arr;
  }, [visibleMembers]);

  const totalMembers = data?.totals?.members || 0;
  const totalPaying = data?.totals?.paying || 0;
  const totalRecaudado = data?.totals?.totalRecaudado || 0;
  const stripeActive = data?.totals?.stripeActive || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-violet-600" size={32} />
        <span className="ml-3 text-gray-500">Generando informe...</span>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar (no se imprime) */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
        <a href="/diezmos" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-violet-700">
          <ArrowLeft size={14} /> Volver
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 shadow-sm"
        >
          <Printer size={14} /> Descargar PDF
        </button>
      </div>

      {/* CONTENIDO IMPRIMIBLE */}
      <div className="max-w-[210mm] mx-auto p-8 print:p-6">
        {/* PORTADA HERO */}
        <div className="mb-10 -mx-8 -mt-8 px-8 pt-10 pb-8 text-white relative overflow-hidden print:-mx-6 print:-mt-6 print:px-6"
             style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a855f7 100%)' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 40%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Church size={16} className="text-white/80" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/70 font-semibold">Semper Jóvenes</p>
            </div>
            <h1 className="text-5xl font-black leading-none tracking-tight">
              {reportType === 'completo' ? 'Informe Completo' : 'Diezmos'}
            </h1>
            <p className="text-2xl font-light mt-3 text-white/90">
              {rangeStart ? rangeStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '?'}
              {' → '}
              {rangeEnd ? rangeEnd.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '?'}
            </p>
            <div className="grid grid-cols-3 gap-6 mt-6 pt-5 border-t border-white/20">
              <div>
                <p className="text-3xl font-black leading-none">{totalMembers}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/70 mt-1">Miembros</p>
              </div>
              <div>
                <p className="text-3xl font-black leading-none">{totalMembers > 0 ? Math.round((totalPaying / totalMembers) * 100) : 0}%</p>
                <p className="text-[10px] uppercase tracking-widest text-white/70 mt-1">Participación</p>
              </div>
              <div>
                <p className="text-3xl font-black leading-none">{formatCurrency(totalRecaudado)}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/70 mt-1">Recaudado</p>
              </div>
            </div>
            <p className="text-[10px] text-white/60 mt-4">Generado el {fechaImpresion}</p>
          </div>
        </div>

        {/* KPIs Diezmos */}
        <div className="mb-3">
          <h2 className="text-xs uppercase font-bold text-gray-400 tracking-widest">Diezmos · Resumen</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 print:grid-cols-4">
          <div className="rounded-2xl p-4 border" style={{ borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
            <p className="text-[10px] uppercase font-bold text-blue-700 tracking-wide">Miembros</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{totalMembers}</p>
            <p className="text-[10px] text-blue-600">Total comunidad</p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }}>
            <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wide">Pagan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalPaying}</p>
            <p className="text-[10px] text-emerald-600">{totalMembers > 0 ? Math.round((totalPaying / totalMembers) * 100) : 0}% participación</p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ borderColor: '#e9d5ff', backgroundColor: '#faf5ff' }}>
            <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wide">Stripe activos</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{stripeActive}</p>
            <p className="text-[10px] text-purple-600">Suscripciones</p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ borderColor: '#fde68a', backgroundColor: '#fef9c3' }}>
            <p className="text-[10px] uppercase font-bold text-amber-700 tracking-wide">Recaudado</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(totalRecaudado)}</p>
            <p className="text-[10px] text-amber-600">Total {currentYear}</p>
          </div>
        </div>

        {/* SALDOS (solo informe completo) */}
        {reportType === 'completo' && dashboardData?.financials && (
          <>
            <div className="mb-3">
              <h2 className="text-xs uppercase font-bold text-gray-400 tracking-widest">Saldos actuales</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl p-4 border" style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wide flex items-center gap-1.5">🏦 Saldo Banco</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#065f46' }}>{(dashboardData.financials.bankBalance || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                <p className="text-[10px] text-emerald-600">Última transacción registrada</p>
              </div>
              <div className="rounded-2xl p-4 border" style={{ borderColor: '#fed7aa', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' }}>
                <p className="text-[10px] uppercase font-bold text-orange-700 tracking-wide flex items-center gap-1.5">💵 Caja Brand (efectivo)</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#9a3412' }}>{(dashboardData.financials.cajaBrandEfectivo || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                <p className="text-[10px] text-orange-600">Ventas presenciales · pendiente depositar</p>
              </div>
            </div>

            {/* Stock Brand Potencial */}
            {(() => {
              const sv = brandData?.stockValuation;
              const stockValue = sv?.retailValue ?? 0;
              const stockCost = sv?.costValue ?? 0;
              const margen = sv?.potentialProfit ?? 0;
              const productsWithoutCost = sv?.productsWithoutCost ?? 0;
              const productsWithCost = sv?.productsWithCost ?? 0;
              return (
                <div className="rounded-2xl border-2 mb-8 overflow-hidden" style={{ borderColor: '#bfdbfe' }}>
                  <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5"><Package size={14} /> Inventario Brand · Ingresos potenciales</p>
                    <p className="text-[11px] text-blue-100">Valor de venta del stock disponible · {sv?.units || 0} unidades en {productsWithCost + productsWithoutCost} productos</p>
                  </div>
                  <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100" style={{ background: '#f8fafc' }}>
                    <div className="p-4">
                      <p className="text-[10px] uppercase font-bold text-blue-700 tracking-wide">Ingresos potenciales (PVP)</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: '#1e40af' }}>{stockValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[10px] text-blue-600 mt-1">Si vendiéramos todo el stock</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] uppercase font-bold text-rose-700 tracking-wide">Coste registrado</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: '#9f1239' }}>{stockCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[10px] text-rose-600 mt-1">solo {productsWithCost} productos con coste</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wide">Margen potencial</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: '#065f46' }}>{margen.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[10px] text-emerald-600 mt-1">si vendemos a precio actual</p>
                    </div>
                  </div>
                  {productsWithoutCost > 0 && (
                    <div className="px-4 py-2.5 border-t flex items-start gap-2" style={{ borderColor: '#dbeafe', background: '#fef9c3' }}>
                      <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 leading-snug">
                        <strong>Nota:</strong> {productsWithoutCost} productos del stock (libros, packs, material legacy) NO tienen coste registrado porque se compraron en años anteriores.
                        Su <strong>coste no se refleja en este informe</strong>, pero podemos beneficiarnos de venderlos hoy. El margen real sería superior al mostrado.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* TRANSFERENCIAS SIN VINCULAR — alerta destacada */}
        {data?.unmatchedBank && data.unmatchedBank.length > 0 && (
          <div className="mb-8 rounded-2xl border-2 page-break-inside-avoid" style={{ borderColor: '#fcd34d', backgroundColor: '#fffbeb' }}>
            <div className="p-4 border-b" style={{ borderColor: '#fde68a' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b' }}>
                  <span className="text-white text-lg font-bold">!</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#92400e' }}>{data.unmatchedBank.length} transferencia(s) bancaria(s) sin vincular</h2>
                  <p className="text-xs" style={{ color: '#b45309' }}>Marcadas como Diezmo pero sin miembro asignado · Pendiente asignar manualmente en /diezmos</p>
                </div>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {data.unmatchedBank.map((tx: any) => (
                <div key={tx.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border" style={{ borderColor: '#fde68a' }}>
                  <span className="text-[11px] font-bold w-16 flex-shrink-0" style={{ color: '#92400e' }}>
                    {new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="flex-1 text-[11px] text-gray-700 break-words leading-snug">{tx.concept}</span>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: '#92400e' }}>
                    {(tx.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              ))}
            </div>
            <p className="px-4 pb-3 text-[10px]" style={{ color: '#b45309' }}>
              💡 Para asignar: ir a economia.semperjovenes.com/diezmos → "Transferencias sin vincular" → click → seleccionar miembro
            </p>
          </div>
        )}

        {/* SECCIONES POR COMUNIDAD */}
        {allCommunities.map((community, idx) => {
          const colors = COMMUNITY_COLORS[community] || DEFAULT_COLOR;
          const list = visibleMembers.filter((m: any) => m.community === community);
          const paying = list.filter((m: any) => m.totalPaid > 0 || m.methods.stripe.subscriptionActive);
          const notPaying = list.filter((m: any) => !(m.totalPaid > 0 || m.methods.stripe.subscriptionActive));
          const recaudado = list.reduce((s: number, m: any) => s + (m.totalPaid || 0), 0);
          const pct = list.length > 0 ? Math.round((paying.length / list.length) * 100) : 0;
          const isLastCommunity = idx === allCommunities.length - 1;

          return (
            <div key={community} className={`mb-8 ${!isLastCommunity ? 'page-break-inside-avoid' : ''}`}>
              {/* Header comunidad */}
              <div className="rounded-2xl p-5 mb-4 text-white shadow-md" style={{ background: colors.gradient }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)' }}>
                      <Church size={22} color="white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{community}</h2>
                      <p className="text-sm text-white/80">{list.length} {list.length === 1 ? 'miembro' : 'miembros'} · {formatCurrency(recaudado)} recaudado</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{pct}%</p>
                    <p className="text-xs text-white/80">{paying.length} de {list.length} pagan</p>
                  </div>
                </div>
                {/* Barra de progreso */}
                <div className="h-2 mt-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
                  <div className="h-full bg-white rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
              </div>

              {/* Grid de miembros — 1 col en mobile, 2 en sm+ y print */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:grid-cols-2">
                {list.sort((a: any, b: any) => b.totalPaid - a.totalPaid).map((m: any) => {
                  const paga = m.totalPaid > 0 || m.methods.stripe.subscriptionActive;
                  const method = paga ? (m.methods.stripe.subscriptionActive || m.methods.stripe.count > 0 ? 'stripe' : m.methodPrimary) : 'sin pagos';
                  const bday = findBirthday(m.name, m.nickname, m.community);
                  // Meses pagados
                  const paidMonths = new Set<string>();
                  for (const h of m.history || []) paidMonths.add(h.date.slice(0, 7));

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border p-3 break-inside-avoid"
                      style={{
                        borderColor: paga ? '#a7f3d0' : '#fecaca',
                        backgroundColor: paga ? '#ecfdf5' : '#fef2f2',
                      }}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold print:w-9 print:h-9" style={{ background: colors.gradient }}>
                          {m._isPair ? `${getInitials(m.apodo || m.name)[0]}↔${getInitials(m._partner.apodo || m._partner.name)[0]}` : getInitials(m.apodo || m.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-xs print:text-xs font-bold text-gray-900 leading-tight break-words">
                            {m._isPair ? `${m.apodo || m.name} ↔ ${m._partner.apodo || m._partner.name}` : (m.apodo || m.name)}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {m.methods.stripe.subscriptionActive && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] print:text-[8px] font-bold rounded">
                                <Repeat size={8} /> SUB {m.methods.stripe.subscriptionAmount ? `${m.methods.stripe.subscriptionAmount}€` : ''}
                              </span>
                            )}
                            {bday && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] print:text-[8px] font-bold rounded">
                                <Cake size={8} /> {bday.day} {MONTHS_FULL[bday.month - 1].slice(0, 3)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-base sm:text-sm print:text-sm font-bold whitespace-nowrap" style={{ color: paga ? '#065f46' : '#991b1b' }}>
                            {paga ? formatCurrency(m.totalPaid) : '—'}
                          </p>
                          {paga && m.paymentCount > 0 && <p className="text-[10px] print:text-[8px] text-gray-500 whitespace-nowrap">{m.paymentCount} pagos</p>}
                        </div>
                      </div>

                      {/* Tags 12 meses con icono check/X — heatmap legible */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 12 }, (_, i) => {
                          const mk = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                          const monthPaid = paidMonths.has(mk);
                          const isPast = mk < currentMonthKey;
                          const isCurrent = mk === currentMonthKey;
                          let bg = '#f3f4f6';
                          let color = '#9ca3af';
                          if (monthPaid) { bg = '#10b981'; color = 'white'; }
                          else if (isPast) { bg = '#fecaca'; color = '#991b1b'; }
                          else if (isCurrent) { bg = '#fef3c7'; color = '#92400e'; }
                          return (
                            <span key={i} className="flex-1 flex flex-col items-center justify-center rounded py-1 print:py-0.5"
                                  style={{ background: bg, color }}>
                              <span className="flex items-center justify-center" style={{ minHeight: 10 }}>
                                {monthPaid && <Check size={9} strokeWidth={3.5} />}
                                {!monthPaid && isPast && <X size={9} strokeWidth={3} />}
                              </span>
                              <span className="text-[8px] print:text-[7px] font-bold leading-none mt-0.5">{MONTH_LABELS_SHORT[i]}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer comunidad: lista compacta de no-pagadores */}
              {notPaying.length > 0 && (
                <div className="mt-3 p-3 rounded-xl border" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#991b1b' }}>
                    Sin pagar este año ({notPaying.length})
                  </p>
                  <p className="text-[10px] text-rose-700 leading-relaxed">
                    {notPaying.map((m: any) => m.apodo || m.name).join(' · ')}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* === P&L POR ÁREA (consolidado) === */}
        {reportType === 'completo' && dashboardData?.macroGroups && (
          <PnLAreaSummary macroGroups={dashboardData.macroGroups} />
        )}

        {/* === COMUNIDAD: BREAK-EVEN === */}
        {reportType === 'completo' && dashboardData?.macroGroups?.diezmos && rangeStart && rangeEnd && (
          <ComunidadBreakeven
            macroGroup={dashboardData.macroGroups.diezmos}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        )}

        {/* === DESGLOSE INGRESOS / GASTOS BRAND === */}
        {reportType === 'completo' && brandData && (
          <BrandBreakdown brand={brandData} />
        )}

        {/* === BRAND · TRAZABILIDAD POR COLECCIÓN === */}
        {reportType === 'completo' && brandData && dashboardData && (
          <BrandTrazabilidad brand={brandData} dashboard={dashboardData} />
        )}

        {/* === DESGLOSE DETALLADO POR ÁREA === */}
        {reportType === 'completo' && dashboardData && (
          <DesgloseSection
            title="Comunidad — detalle"
            color="#8b5cf6"
            macroGroup={dashboardData.macroGroups?.diezmos}
          />
        )}
        {reportType === 'completo' && dashboardData && (
          <DesgloseSection
            title="Semper Brand — detalle"
            color="#3b82f6"
            macroGroup={dashboardData.macroGroups?.brand}
            extra={brandData}
          />
        )}
        {reportType === 'completo' && dashboardData && (
          <DesgloseSection
            title="Otros — detalle"
            color="#64748b"
            macroGroup={dashboardData.macroGroups?.otros}
          />
        )}

        {/* Leyenda final */}
        <div className="mt-8 pt-4 border-t border-gray-200 grid grid-cols-2 gap-3 text-[10px] text-gray-600">
          <div>
            <p className="font-bold mb-1 text-gray-700 uppercase tracking-wide">Estado por mes</p>
            <div className="flex items-center gap-1.5 mb-0.5"><span className="w-3 h-3 rounded" style={{ background: '#10b981' }} /> Pagó</div>
            <div className="flex items-center gap-1.5 mb-0.5"><span className="w-3 h-3 rounded" style={{ background: '#fecaca' }} /> Mes pasado sin pagar</div>
            <div className="flex items-center gap-1.5 mb-0.5"><span className="w-3 h-3 rounded" style={{ background: '#fef3c7' }} /> Mes actual</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#f3f4f6' }} /> Mes futuro</div>
          </div>
          <div>
            <p className="font-bold mb-1 text-gray-700 uppercase tracking-wide">Datos</p>
            <p>Stripe API: cargos individuales y suscripciones activas</p>
            <p>Bank: bizums y transferencias marcadas como Diezmo</p>
            <p>Corte: enero {currentYear} en adelante</p>
          </div>
        </div>

        <p className="mt-6 text-center text-[9px] text-gray-400 italic">
          Generado automáticamente por economia.semperjovenes.com · {fechaImpresion}
        </p>
      </div>

      <style jsx global>{`
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 12mm; }
          .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
          .section-break { page-break-before: always; break-before: page; }
          .section-header-h2 { page-break-after: avoid; break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

function DesgloseSection({ title, color, macroGroup }: { title: string; color: string; macroGroup: any; extra?: any }) {
  if (!macroGroup) return null;
  const ingresos = macroGroup.income || 0;
  const gastos = macroGroup.expenses || 0;
  const tags = macroGroup.tags || [];

  // Separar por ingresos / gastos como en el dashboard expandido
  const incomeTags = tags.filter((t: any) => t.income > 0).sort((a: any, b: any) => b.income - a.income);
  const expenseTags = tags.filter((t: any) => t.expenses > 0).sort((a: any, b: any) => b.expenses - a.expenses);

  return (
    <div className="mt-6 mb-2">
      {/* Header sección */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-6 rounded-full" style={{ background: color }} />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>

      <div className="border border-gray-200 rounded-2xl p-4 space-y-4 bg-white">
        {/* INGRESOS */}
        {incomeTags.length > 0 && (
          <div className="page-break-inside-avoid">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-100">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">↑ Ingresos</p>
              <p className="text-sm font-bold text-emerald-700">+{ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="space-y-1">
              {incomeTags.map((t: any) => {
                const incomeTxs = (t.transactions || []).filter((tx: any) => tx.amount > 0).sort((a: any, b: any) => b.date.localeCompare(a.date));
                return (
                  <div key={t.tag}>
                    <div className="flex items-center justify-between text-xs py-1.5 px-2 -mx-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: tagColor(t.tag) }} />
                        <span className="text-gray-700 font-medium">{t.tag}</span>
                        <span className="text-gray-400 text-[10px]">({incomeTxs.length})</span>
                      </div>
                      <span className="font-semibold text-emerald-600">+{t.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    {incomeTxs.length > 0 && (
                      <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                        {incomeTxs.map((tx: any, i: number) => (
                          <div key={i} className="flex items-start justify-between text-[11px] text-gray-500 gap-2">
                            <div className="flex items-baseline gap-2 min-w-0 flex-1">
                              <span className="text-gray-400 flex-shrink-0 font-medium">{new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                              <span className="break-words leading-snug">{tx.description || '—'}</span>
                            </div>
                            <span className="font-medium flex-shrink-0 text-emerald-600">+{tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GASTOS */}
        {expenseTags.length > 0 && (
          <div className="page-break-inside-avoid">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100">
              <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">↓ Gastos</p>
              <p className="text-sm font-bold text-rose-700">-{gastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="space-y-1">
              {expenseTags.map((t: any) => {
                const expenseTxs = (t.transactions || []).filter((tx: any) => tx.amount < 0).sort((a: any, b: any) => b.date.localeCompare(a.date));
                return (
                  <div key={t.tag}>
                    <div className="flex items-center justify-between text-xs py-1.5 px-2 -mx-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: tagColor(t.tag) }} />
                        <span className="text-gray-700 font-medium">{t.tag}</span>
                        <span className="text-gray-400 text-[10px]">({expenseTxs.length})</span>
                      </div>
                      <span className="font-semibold text-rose-600">-{t.expenses.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    {expenseTxs.length > 0 && (
                      <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-rose-100 pl-3">
                        {expenseTxs.map((tx: any, i: number) => (
                          <div key={i} className="flex items-start justify-between text-[11px] text-gray-500 gap-2">
                            <div className="flex items-baseline gap-2 min-w-0 flex-1">
                              <span className="text-gray-400 flex-shrink-0 font-medium">{new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                              <span className="break-words leading-snug">{tx.description || '—'}</span>
                            </div>
                            <span className="font-medium flex-shrink-0 text-rose-600">{tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TAG_COLORS_INFORME: Record<string, string> = {
  'Diezmo': '#8b5cf6', 'Donativo': '#ec4899', 'Brand': '#6366f1',
  'Shopify': '#22c55e', 'Stripe': '#3b82f6', 'Bizum': '#06b6d4',
  'Transferencia': '#14b8a6', 'Misa/Tabor': '#f59e0b', 'Misa/Tabor/Comida': '#f59e0b',
  'Retiros': '#f97316', 'Viajes': '#f43f5e', 'Música': '#d946ef',
  'Nómina': '#ef4444', 'Material': '#eab308', 'Comisión bancaria': '#9ca3af',
  'BAC': '#10b981', 'Gasto operativo': '#64748b', 'Venta presencial': '#84cc16',
  'Semper CD': '#a855f7', 'Proveedor': '#71717a', 'Alquiler': '#78716c', 'Otro': '#94a3b8',
};
const tagColor = (tag: string) => TAG_COLORS_INFORME[tag] || '#9ca3af';

const AREA_CONFIG: Record<string, { label: string; bg: string; iconBg: string; iconColor: string; border: string; barBg: string; barFill: string }> = {
  diezmos: { label: 'Comunidad', bg: '#f5f3ff', iconBg: '#ddd6fe', iconColor: '#7c3aed', border: '#ddd6fe', barBg: '#ddd6fe', barFill: '#8b5cf6' },
  brand:   { label: 'Semper Brand', bg: '#eef2ff', iconBg: '#c7d2fe', iconColor: '#4338ca', border: '#c7d2fe', barBg: '#c7d2fe', barFill: '#6366f1' },
  otros:   { label: 'Otros', bg: '#fffbeb', iconBg: '#fde68a', iconColor: '#b45309', border: '#fde68a', barBg: '#fde68a', barFill: '#f59e0b' },
};

function PnLAreaSummary({ macroGroups }: { macroGroups: any }) {
  const order = ['diezmos', 'brand', 'otros'];
  return (
    <div className="mt-10 mb-8 section-break">
      <SectionHeader number={6} title="P&L por Área" subtitle="Resumen de ingresos y gastos por categoría macro" color="#7c3aed" />
      <div className="grid grid-cols-3 gap-3">
        {order.map(key => {
          const g = macroGroups[key];
          const cfg = AREA_CONFIG[key];
          if (!g || !cfg) return null;
          const ingresos = g.income || 0;
          const gastos = g.expenses || 0;
          const neto = ingresos - gastos;
          const tags = (g.tags || []).slice()
            .sort((a: any, b: any) => Math.max(b.income, b.expenses) - Math.max(a.income, a.expenses))
            .slice(0, 5);
          return (
            <div key={key} className="rounded-2xl overflow-hidden border bg-white page-break-inside-avoid" style={{ borderColor: cfg.border }}>
              {/* Header */}
              <div className="px-4 py-3" style={{ background: cfg.bg }}>
                <p className="text-[11px] uppercase font-bold tracking-widest" style={{ color: cfg.iconColor }}>{cfg.label}</p>
                <p className={`text-2xl font-bold mt-1`} style={{ color: neto >= 0 ? '#065f46' : '#991b1b' }}>
                  {neto >= 0 ? '+' : ''}{neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <span className="text-gray-500">Ingreso</span>
                  <span className="font-semibold text-emerald-700">{ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500">Gasto</span>
                  <span className="font-semibold text-rose-700">{gastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>
              {/* Top categorías */}
              {tags.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top categorías</p>
                  <div className="space-y-1">
                    {tags.map((t: any) => (
                      <div key={t.tag} className="flex items-center justify-between text-[11px] py-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tagColor(t.tag) }} />
                          <span className="text-gray-700 truncate">{t.tag}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {t.income > 0 && <span className="text-emerald-600 font-semibold">+{t.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>}
                          {t.expenses > 0 && <span className="text-rose-500 font-semibold">-{t.expenses.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>}
                        </div>
                      </div>
                    ))}
                    {(g.tags || []).length > 5 && (
                      <p className="text-[10px] text-gray-400 italic pt-1">+ {(g.tags || []).length - 5} categorías más en detalle</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandBreakdown({ brand }: { brand: any }) {
  const ingresoTotal = brand?.income?.total || 0;
  const gastoTotal = brand?.expenses?.total || 0;
  if (ingresoTotal === 0 && gastoTotal === 0) return null;

  // Desglose ingresos: Brand (banco), Ventas Presenciales, Shopify
  const ingresoItems: { label: string; value: number; meta?: string }[] = [];
  const brandBank = brand?.income?.bankIncome?.Brand || brand?.income?.totalBankIncome || 0;
  if (brandBank > 0) ingresoItems.push({ label: 'Brand (banco)', value: brandBank, meta: 'transferencias/bizums Brand' });
  if (brand?.income?.ventasPresenciales > 0) ingresoItems.push({ label: 'Ventas Presenciales', value: brand.income.ventasPresenciales, meta: `${brand.income.ventasCount || 0} ventas` });
  if (brand?.income?.shopify > 0) ingresoItems.push({ label: 'Shopify', value: brand.income.shopify, meta: `${brand.income.shopifyOrders || 0} pedidos` });

  // Desglose gastos
  const gastoItems: { label: string; value: number }[] = [];
  const brandExp = brand?.expenses?.byTag?.Brand || 0;
  if (brandExp > 0) gastoItems.push({ label: 'Brand (gastos producción)', value: brandExp });
  if (brand?.giftLoss > 0) gastoItems.push({ label: 'Regalos (coste prod.)', value: brand.giftLoss });
  if (brand?.expenses?.shopifyRefunds > 0) gastoItems.push({ label: `Devoluciones Shopify (${brand.expenses.shopifyRefundCount || 0})`, value: brand.expenses.shopifyRefunds });
  if (brand?.expenses?.stripeFees > 0) gastoItems.push({ label: 'Comisión Stripe', value: brand.expenses.stripeFees });

  const renderBar = (items: { label: string; value: number; meta?: string }[], total: number, color: string) => {
    if (items.length === 0) return null;
    return items
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(i => {
        const pct = total > 0 ? (i.value / total) * 100 : 0;
        return (
          <div key={i.label} className="mb-2">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[11px] font-semibold text-gray-800">{i.label} {i.meta && <span className="text-[9px] text-gray-500 font-normal">{i.meta}</span>}</span>
              <span className="text-[11px] font-bold" style={{ color }}>{i.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} <span className="text-[9px] text-gray-500 font-normal">({pct.toFixed(1)}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
              <div className="h-full rounded-full" style={{ background: color, width: `${Math.max(pct, 2)}%` }} />
            </div>
          </div>
        );
      });
  };

  return (
    <div className="mt-10 mb-8 section-break">
      <SectionHeader number={8} title="Desglose Brand" subtitle="Ingresos y gastos detallados con porcentajes" color="#3b82f6" />
      <div className="grid grid-cols-2 gap-4">
        {/* Ingresos */}
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Desglose Ingresos</p>
            <p className="text-lg font-bold text-emerald-700">{ingresoTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div>{renderBar(ingresoItems, ingresoTotal, '#10b981')}</div>
        </div>

        {/* Gastos */}
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-bold text-rose-700 uppercase tracking-wide">Desglose Gastos</p>
            <p className="text-lg font-bold text-rose-700">{gastoTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div>{renderBar(gastoItems, gastoTotal, '#ef4444')}</div>
        </div>
      </div>
    </div>
  );
}

function ComunidadBreakeven({ macroGroup, rangeStart, rangeEnd }: { macroGroup: any; rangeStart: Date; rangeEnd: Date }) {
  const ingresos = macroGroup.income || 0;
  const gastos = macroGroup.expenses || 0;
  const neto = ingresos - gastos;
  const tags = (macroGroup.tags || []);

  // Calcular meses CALENDARIO completos del rango (ene-abr = 4 meses)
  const startY = rangeStart.getFullYear();
  const startM = rangeStart.getMonth();
  const endY = rangeEnd.getFullYear();
  const endM = rangeEnd.getMonth();
  const dayEnd = rangeEnd.getDate();
  let meses = (endY - startY) * 12 + (endM - startM);
  // Si el último mes está a >= 28 del mes, contar también ese mes
  if (dayEnd >= 28) meses += 1;
  meses = Math.max(1, meses);
  const netoMensual = neto / meses;
  const gastoMensual = gastos / meses;
  const ingresoMensual = ingresos / meses;
  const DIEZMO_BASE = 5;

  const diezmosFaltantesMensuales = neto < 0 ? Math.ceil(Math.abs(netoMensual) / DIEZMO_BASE) : 0;
  const diezmosCubrirDeficit = neto < 0 ? Math.ceil(Math.abs(neto) / DIEZMO_BASE) : 0;

  // Top categorías ingresos
  const incomeTags = tags.filter((t: any) => t.income > 0).sort((a: any, b: any) => b.income - a.income);
  const expenseTags = tags.filter((t: any) => t.expenses > 0).sort((a: any, b: any) => b.expenses - a.expenses);

  return (
    <div className="mt-10 mb-8 section-break">
      <SectionHeader number={7} title="Comunidad · Análisis" subtitle="Diezmos vs gastos comunitarios · cálculo break-even" color="#8b5cf6" />

      {/* KPI principal con neto + meses */}
      <div className="rounded-2xl border-2 mb-4 overflow-hidden" style={{ borderColor: neto < 0 ? '#fecaca' : '#bbf7d0' }}>
        <div className="px-5 py-4" style={{ background: neto < 0 ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: neto < 0 ? '#991b1b' : '#065f46' }}>Resultado neto · {meses} {meses === 1 ? 'mes' : 'meses'}</p>
              <p className="text-3xl font-bold" style={{ color: neto < 0 ? '#991b1b' : '#065f46' }}>
                {neto >= 0 ? '+' : ''}{neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Promedio mensual</p>
              <p className="text-lg font-bold" style={{ color: neto < 0 ? '#991b1b' : '#065f46' }}>
                {netoMensual >= 0 ? '+' : ''}{netoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/mes
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg">
              ↑ Ingreso {ingresoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/mes
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg">
              ↓ Gasto {gastoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/mes
            </span>
          </div>
        </div>
      </div>

      {/* CÁLCULO BREAK-EVEN */}
      {(() => {
        // Para calcular break-even consideramos solo el GASTO mensual a cubrir,
        // independientemente del estado actual (positivo o negativo).
        const diezmos5 = Math.ceil(gastoMensual / 5);
        const diezmos10 = Math.ceil(gastoMensual / 10);
        const isPositivo = neto >= 0;
        return (
          <div className="rounded-2xl border-2 mb-4 overflow-hidden" style={{ borderColor: isPositivo ? '#a7f3d0' : '#fde68a', background: isPositivo ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: isPositivo ? '#10b981' : '#f59e0b' }}>
                  <Scale size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: isPositivo ? '#065f46' : '#92400e' }}>Break-even mensual de gastos</p>
                  <p className="text-[11px]" style={{ color: isPositivo ? '#047857' : '#b45309' }}>
                    Cuántos diezmos hacen falta para cubrir los gastos comunitarios (misas, jóvenes, etc.)
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 border" style={{ borderColor: isPositivo ? '#a7f3d0' : '#fde68a' }}>
                  <p className="text-[10px] uppercase font-bold tracking-wide mb-1" style={{ color: isPositivo ? '#065f46' : '#92400e' }}>Si diezman 10€/mes</p>
                  <p className="text-3xl font-bold" style={{ color: isPositivo ? '#065f46' : '#92400e' }}>{diezmos10} diezmos</p>
                  <p className="text-[10px] text-gray-600 mt-1">cubrirían el gasto mensual de {gastoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border" style={{ borderColor: isPositivo ? '#a7f3d0' : '#fde68a' }}>
                  <p className="text-[10px] uppercase font-bold tracking-wide mb-1" style={{ color: isPositivo ? '#065f46' : '#92400e' }}>Si diezman 5€/mes</p>
                  <p className="text-3xl font-bold" style={{ color: isPositivo ? '#065f46' : '#92400e' }}>{diezmos5} diezmos</p>
                  <p className="text-[10px] text-gray-600 mt-1">cubrirían el gasto mensual de {gastoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                </div>
              </div>
              {isPositivo && (
                <p className="text-[11px] font-semibold mt-3" style={{ color: '#065f46' }}>
                  ✓ Actualmente la comunidad cubre sus gastos ({neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} de superávit en {meses} {meses === 1 ? 'mes' : 'meses'}).
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Desglose Ingresos / Gastos con barras de % (estilo Brand) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Desglose Ingresos</p>
            <p className="text-lg font-bold text-emerald-700">{ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          {incomeTags.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin ingresos</p>
          ) : incomeTags.map((t: any) => {
            const pct = ingresos > 0 ? (t.income / ingresos) * 100 : 0;
            return (
              <div key={t.tag} className="mb-2">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-800">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tagColor(t.tag) }} />
                    {t.tag}
                    <span className="text-[9px] text-gray-500 font-normal">({(t.transactions || []).filter((tx: any) => tx.amount > 0).length})</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">{t.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} <span className="text-[9px] text-gray-500 font-normal">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#dcfce7' }}>
                  <div className="h-full rounded-full" style={{ background: '#10b981', width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border-2 p-4" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-bold text-rose-700 uppercase tracking-wide">Desglose Gastos</p>
            <p className="text-lg font-bold text-rose-700">{gastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          {expenseTags.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin gastos</p>
          ) : expenseTags.map((t: any) => {
            const pct = gastos > 0 ? (t.expenses / gastos) * 100 : 0;
            return (
              <div key={t.tag} className="mb-2">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-800">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tagColor(t.tag) }} />
                    {t.tag}
                    <span className="text-[9px] text-gray-500 font-normal">({(t.transactions || []).filter((tx: any) => tx.amount < 0).length})</span>
                  </span>
                  <span className="text-[11px] font-bold text-rose-700">{t.expenses.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} <span className="text-[9px] text-gray-500 font-normal">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#fee2e2' }}>
                  <div className="h-full rounded-full" style={{ background: '#ef4444', width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ number, title, subtitle, color }: { number: number; title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2 section-header-h2">
      <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-[0.25em] text-gray-400 font-bold">Sección {String(number).padStart(2, '0')}</p>
        <h2 className="text-xl font-black text-gray-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <span className="text-5xl font-black opacity-10 leading-none" style={{ color }}>{String(number).padStart(2, '0')}</span>
    </div>
  );
}

function BrandTrazabilidad({ brand, dashboard }: { brand: any; dashboard: any }) {
  const sv = brand?.stockValuation;
  if (!sv?.topByValue) return null;

  // Identificar las 2 colecciones con trazabilidad completa (BAC 26)
  const matchPinguino = (t: string) => /ping[üu]ino/i.test(t || '');
  const matchGodLuck = (t: string) => /god\s*luck|good\s*luck/i.test(t || '');

  // Buscar revenue ya generado por producto desde topProducts
  const revenueByTitle: Record<string, number> = {};
  for (const p of (dashboard?.topProducts || [])) {
    revenueByTitle[(p.title || '').toLowerCase().trim()] = p.revenue || 0;
  }
  const findRevenue = (title: string) => {
    const norm = title.toLowerCase().trim();
    let total = 0;
    for (const [k, v] of Object.entries(revenueByTitle)) {
      if (matchPinguino(title) && matchPinguino(k)) total += v;
      else if (matchGodLuck(title) && matchGodLuck(k)) total += v;
      else if (k === norm) total += v;
    }
    return total;
  };

  const pinguino = sv.topByValue.find((p: any) => matchPinguino(p.title));
  const godLuck = sv.topByValue.find((p: any) => matchGodLuck(p.title));
  const trazables = [pinguino, godLuck].filter(Boolean);
  const otrosConCoste = sv.topByValue.filter((p: any) => !matchPinguino(p.title) && !matchGodLuck(p.title) && p.cost > 0);
  const sinCoste = sv.topByValue.filter((p: any) => p.cost === 0);

  return (
    <div className="mt-10 mb-8 section-break">
      <SectionHeader number={9} title="Brand · Trazabilidad por colección" subtitle="Inversión, retorno y break-even por producto" color="#3b82f6" />

      {/* Cards de trazabilidad completa (BAC 26) */}
      {trazables.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
              ✓ Trazabilidad completa BAC 26
            </span>
            <p className="text-[11px] text-gray-500">Producción registrada · seguimiento de inversión y retorno</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {trazables.map((p: any) => {
              const stockActual = p.units;
              const costUnit = stockActual > 0 ? p.cost / stockActual : 0;
              // Asumimos PVP unitario
              const pvpUnit = stockActual > 0 ? p.retail / stockActual : 0;
              const margenUnit = pvpUnit - costUnit;
              const inversionStockActual = p.cost; // capital atrapado
              const ingresoYaGenerado = findRevenue(p.title);
              // Break-even: cuántas más vender al margen actual para cubrir inversión inicial
              // Inversión inicial estimada = cost actual (capital atrapado) — cifra conservadora
              // Si ya generó ingreso, restar
              const yaCubierto = ingresoYaGenerado;
              const faltaCubrir = Math.max(0, inversionStockActual - yaCubierto);
              const unidadesBE = margenUnit > 0 ? Math.ceil(faltaCubrir / margenUnit) : 0;
              const isPinguino = matchPinguino(p.title);

              return (
                <div key={p.title} className="rounded-2xl overflow-hidden border-2 page-break-inside-avoid" style={{ borderColor: isPinguino ? '#fbcfe8' : '#fde68a' }}>
                  <div className="px-4 py-3" style={{ background: isPinguino ? 'linear-gradient(135deg, #f9a8d4 0%, #ec4899 100%)' : 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)' }}>
                    <p className="text-sm font-bold text-white">{p.title}</p>
                    <p className="text-[10px] text-white/80">{stockActual} uds en stock · PVP {pvpUnit.toFixed(2)}€/u · coste {costUnit.toFixed(2)}€/u</p>
                  </div>
                  <div className="bg-white p-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-rose-50 rounded-lg p-2">
                      <p className="text-[9px] uppercase font-bold text-rose-700 tracking-wider">Capital atrapado</p>
                      <p className="text-base font-bold text-rose-700">{inversionStockActual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[9px] text-gray-500">{stockActual} × {costUnit.toFixed(2)}€</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <p className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider">Ingreso ya generado</p>
                      <p className="text-base font-bold text-emerald-700">{ingresoYaGenerado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[9px] text-gray-500">ventas Shopify {currentYearVar()}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-[9px] uppercase font-bold text-blue-700 tracking-wider">Si vendemos todo</p>
                      <p className="text-base font-bold text-blue-700">+{p.retail.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      <p className="text-[9px] text-gray-500">{p.retail.toLocaleString('es-ES')}€ retail total</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-2">
                      <p className="text-[9px] uppercase font-bold text-violet-700 tracking-wider">Para break-even</p>
                      <p className="text-base font-bold text-violet-700">+{unidadesBE} uds</p>
                      <p className="text-[9px] text-gray-500">a {margenUnit.toFixed(2)}€ margen/u</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-3 py-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-600">
                      Margen potencial total: <strong className="text-emerald-700">{p.potentialProfit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong> ({((p.potentialProfit / p.retail) * 100).toFixed(1)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resto inventario con coste */}
      {otrosConCoste.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
              · Otros productos con coste
            </span>
            <p className="text-[11px] text-gray-500">Coste unitario calculado · sin trazabilidad de inversión inicial</p>
          </div>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <table className="w-full text-[11px]">
              <thead style={{ background: '#f8fafc' }}>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-bold text-gray-600">Producto</th>
                  <th className="text-right px-2 py-2 font-bold text-gray-600">Stock</th>
                  <th className="text-right px-2 py-2 font-bold text-gray-600">PVP total</th>
                  <th className="text-right px-2 py-2 font-bold text-gray-600">Coste total</th>
                  <th className="text-right px-2 py-2 font-bold text-gray-600">Margen pot.</th>
                </tr>
              </thead>
              <tbody>
                {otrosConCoste.map((p: any) => (
                  <tr key={p.title} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-gray-800">{p.title}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{p.units}</td>
                    <td className="px-2 py-2 text-right font-semibold text-blue-700">{p.retail.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                    <td className="px-2 py-2 text-right font-semibold text-rose-700">{p.cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                    <td className="px-2 py-2 text-right font-bold text-emerald-700">{p.potentialProfit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productos sin coste registrado */}
      {sinCoste.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
              ⚠ Sin coste registrado (legacy)
            </span>
            <p className="text-[11px] text-gray-500">Stock comprado en años anteriores · 100% margen al venderse hoy</p>
          </div>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <table className="w-full text-[11px]">
              <thead style={{ background: '#fffbeb' }}>
                <tr className="border-b border-amber-100">
                  <th className="text-left px-3 py-2 font-bold text-amber-800">Producto</th>
                  <th className="text-right px-2 py-2 font-bold text-amber-800">Stock</th>
                  <th className="text-right px-2 py-2 font-bold text-amber-800">PVP unitario</th>
                  <th className="text-right px-2 py-2 font-bold text-amber-800">Ingreso potencial</th>
                </tr>
              </thead>
              <tbody>
                {sinCoste.map((p: any) => (
                  <tr key={p.title} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-gray-800">{p.title}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{p.units}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{p.units > 0 ? (p.retail / p.units).toFixed(2) : 0}€</td>
                    <td className="px-2 py-2 text-right font-bold text-amber-700">{p.retail.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-amber-50">
                  <td className="px-3 py-2 text-amber-900">TOTAL</td>
                  <td className="px-2 py-2 text-right text-amber-900">{sinCoste.reduce((s: number, p: any) => s + p.units, 0)}</td>
                  <td></td>
                  <td className="px-2 py-2 text-right text-amber-900">{sinCoste.reduce((s: number, p: any) => s + p.retail, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 italic mt-2">
            💡 Estos productos no tienen coste registrado porque se compraron en ejercicios anteriores. Al venderlos hoy, todo el ingreso es ganancia neta para el ejercicio actual.
          </p>
        </div>
      )}

      <p className="text-[10px] text-gray-400 italic mt-4">
        Datos actualizados en tiempo real desde Shopify Admin API + Supabase. Cada vez que descargues este informe se recalcularán los valores.
      </p>
    </div>
  );
}
function currentYearVar() { return new Date().getFullYear(); }
