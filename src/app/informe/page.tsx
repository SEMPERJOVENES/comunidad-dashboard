'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Printer, Loader2, ArrowLeft, CreditCard, Smartphone, Landmark, Check, X, Cake, Church, Repeat } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const start = new Date(2026, 0, 1).toISOString();
        const end = new Date().toISOString();
        const res = await fetch(`/api/miembros-pagos?start=${start}&end=${end}`);
        if (res.ok) setData(await res.json());
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
        {/* Portada */}
        <div className="mb-8 pb-6 border-b-2 border-violet-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <Church size={28} color="white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Informe de Diezmos</h1>
              <p className="text-sm text-gray-500">Semper Jóvenes · {fechaImpresion}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Período: enero {currentYear} → {MONTHS_FULL[currentMonth - 1]} {currentYear}</p>
        </div>

        {/* KPIs globales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 print:grid-cols-4">
          <div className="rounded-2xl p-4 border-2" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}>
            <p className="text-[10px] uppercase font-bold text-blue-700 tracking-wide">Miembros</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{totalMembers}</p>
            <p className="text-[10px] text-blue-600">Total comunidad</p>
          </div>
          <div className="rounded-2xl p-4 border-2" style={{ borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }}>
            <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wide">Pagan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalPaying}</p>
            <p className="text-[10px] text-emerald-600">{totalMembers > 0 ? Math.round((totalPaying / totalMembers) * 100) : 0}% participación</p>
          </div>
          <div className="rounded-2xl p-4 border-2" style={{ borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' }}>
            <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wide">Stripe activos</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{stripeActive}</p>
            <p className="text-[10px] text-purple-600">Suscripciones</p>
          </div>
          <div className="rounded-2xl p-4 border-2" style={{ borderColor: '#fde68a', backgroundColor: '#fef3c7' }}>
            <p className="text-[10px] uppercase font-bold text-amber-700 tracking-wide">Recaudado</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(totalRecaudado)}</p>
            <p className="text-[10px] text-amber-600">Total {currentYear}</p>
          </div>
        </div>

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

              {/* Grid de miembros — 2 columnas, formato compacto print-friendly */}
              <div className="grid grid-cols-2 gap-2">
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
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: colors.gradient }}>
                          {m._isPair ? `${getInitials(m.apodo || m.name)[0]}↔${getInitials(m._partner.apodo || m._partner.name)[0]}` : getInitials(m.apodo || m.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 leading-tight truncate">
                            {m._isPair ? `${m.apodo || m.name} ↔ ${m._partner.apodo || m._partner.name}` : (m.apodo || m.name)}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {m.methods.stripe.subscriptionActive && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0 bg-purple-100 text-purple-700 text-[8px] font-bold rounded">
                                <Repeat size={7} /> SUB {m.methods.stripe.subscriptionAmount ? `${m.methods.stripe.subscriptionAmount}€` : ''}
                              </span>
                            )}
                            {bday && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0 bg-amber-100 text-amber-700 text-[8px] font-bold rounded">
                                <Cake size={7} /> {bday.day} {MONTHS_FULL[bday.month - 1].slice(0, 3)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold" style={{ color: paga ? '#065f46' : '#991b1b' }}>
                            {paga ? formatCurrency(m.totalPaid) : '—'}
                          </p>
                          {paga && m.paymentCount > 0 && <p className="text-[8px] text-gray-500">{m.paymentCount} pagos</p>}
                        </div>
                      </div>

                      {/* Tags 12 meses (verde si pagado, rojo si pasado sin pagar, gris futuro/actual sin pagar) */}
                      <div className="flex gap-px">
                        {Array.from({ length: 12 }, (_, i) => {
                          const mk = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                          const monthPaid = paidMonths.has(mk);
                          const isPast = mk < currentMonthKey;
                          const isCurrent = mk === currentMonthKey;
                          let bg = '#f3f4f6'; // gris futuro
                          let color = '#9ca3af';
                          if (monthPaid) { bg = '#10b981'; color = 'white'; }
                          else if (isPast) { bg = '#fecaca'; color = '#991b1b'; }
                          else if (isCurrent) { bg = '#fef3c7'; color = '#92400e'; }
                          return (
                            <span key={i} className="flex-1 text-center text-[7px] font-bold py-0.5 rounded" style={{ background: bg, color }}>
                              {MONTH_LABELS_SHORT[i]}
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
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
