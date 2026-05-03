'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Users, Loader2, CreditCard, Smartphone, Landmark, Repeat,
  Search, Mail, Link2, AlertCircle, Church, Check, X, ChevronRight, Filter,
  Zap, ArrowDownUp,
} from 'lucide-react';

const METHOD_ICON: Record<string, any> = {
  stripe: CreditCard,
  bizum: Smartphone,
  transferencia: Landmark,
  otro: Landmark,
};
const METHOD_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  bizum: 'Bizum',
  transferencia: 'Transfer.',
  otro: 'Otro',
  'sin pagos': 'Sin pagos',
};
const METHOD_COLORS: Record<string, { bg: string; text: string; border: string; ring: string; soft: string }> = {
  stripe:        { bg: 'bg-purple-500',  text: 'text-purple-700',  border: 'border-purple-500', ring: 'ring-purple-200', soft: 'bg-purple-50'  },
  bizum:         { bg: 'bg-sky-500',     text: 'text-sky-700',     border: 'border-sky-500',    ring: 'ring-sky-200',    soft: 'bg-sky-50'     },
  transferencia: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-500',ring: 'ring-emerald-200',soft: 'bg-emerald-50' },
  otro:          { bg: 'bg-slate-400',   text: 'text-slate-600',   border: 'border-slate-400',  ring: 'ring-slate-200',  soft: 'bg-slate-50'   },
  'sin pagos':   { bg: 'bg-rose-500',    text: 'text-rose-600',    border: 'border-rose-300',   ring: 'ring-rose-200',   soft: 'bg-rose-50'    },
};

const COMMUNITY_STYLES: Record<string, { bg: string; text: string; border: string; soft: string; tab: string }> = {
  'San Pablo':     { bg: 'bg-blue-500',    text: 'text-blue-700',    border: 'border-blue-500',    soft: 'bg-blue-50',    tab: 'data-[active=true]:bg-blue-500 data-[active=true]:text-white data-[active=true]:border-blue-500' },
  'San Ignacio':   { bg: 'bg-green-500',   text: 'text-green-700',   border: 'border-green-500',   soft: 'bg-green-50',   tab: 'data-[active=true]:bg-green-500 data-[active=true]:text-white data-[active=true]:border-green-500' },
  'San Martín':    { bg: 'bg-orange-500',  text: 'text-orange-700',  border: 'border-orange-500',  soft: 'bg-orange-50',  tab: 'data-[active=true]:bg-orange-500 data-[active=true]:text-white data-[active=true]:border-orange-500' },
  'Colaboradores': { bg: 'bg-violet-500',  text: 'text-violet-700',  border: 'border-violet-500',  soft: 'bg-violet-50',  tab: 'data-[active=true]:bg-violet-500 data-[active=true]:text-white data-[active=true]:border-violet-500' },
};
const DEFAULT_COMMUNITY_STYLE = COMMUNITY_STYLES['Colaboradores'];

const COMMUNITY_ORDER = ['San Pablo', 'San Ignacio', 'San Martín', 'Colaboradores'];

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ConciliacionMiembrosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [communityTab, setCommunityTab] = useState<string>('San Pablo');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pagan' | 'no-pagan'>('todos');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'amount'>('amount');

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

  // Comunidades dinámicas (basadas en miembros existentes)
  const allCommunities = useMemo(() => {
    if (!data?.members) return [];
    const set = new Set<string>(data.members.map((m: any) => m.community).filter(Boolean));
    const arr = Array.from(set);
    arr.sort((a, b) => COMMUNITY_ORDER.indexOf(a) - COMMUNITY_ORDER.indexOf(b));
    return arr;
  }, [data]);

  // Asegurar tab default sea válida
  useEffect(() => {
    if (allCommunities.length > 0 && !allCommunities.includes(communityTab)) {
      setCommunityTab(allCommunities[0]);
    }
  }, [allCommunities, communityTab]);

  // Estadísticas por comunidad para los tabs grandes
  const communityStats = useMemo(() => {
    if (!data?.members) return [];
    return allCommunities.map(c => {
      const list = data.members.filter((m: any) => m.community === c);
      const pagan = list.filter((m: any) => m.totalPaid > 0 || m.methods.stripe.subscriptionActive);
      const total = list.reduce((s: number, m: any) => s + (m.totalPaid || 0), 0);
      return {
        community: c,
        total: list.length,
        paying: pagan.length,
        recaudado: total,
        pct: list.length > 0 ? Math.round((pagan.length / list.length) * 100) : 0,
      };
    });
  }, [data, allCommunities]);

  // Miembros filtrados por comunidad seleccionada + búsqueda + estado + método
  const visibleMembers = useMemo(() => {
    if (!data?.members) return [];
    let arr: any[] = data.members.filter((m: any) => m.community === communityTab);

    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((m: any) =>
        m.name.toLowerCase().includes(s) ||
        (m.apodo || '').toLowerCase().includes(s) ||
        (m.email || '').toLowerCase().includes(s)
      );
    }

    if (statusFilter === 'pagan') {
      arr = arr.filter((m: any) => m.totalPaid > 0 || m.methods.stripe.subscriptionActive);
    } else if (statusFilter === 'no-pagan') {
      arr = arr.filter((m: any) => m.totalPaid === 0 && !m.methods.stripe.subscriptionActive);
    }

    if (methodFilter !== 'all') {
      arr = arr.filter((m: any) => m.methodPrimary === methodFilter);
    }

    // Sort
    if (sortBy === 'amount') {
      arr.sort((a, b) => b.totalPaid - a.totalPaid);
    } else {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return arr;
  }, [data, communityTab, search, statusFilter, methodFilter, sortBy]);

  // Resolver pareja para mostrar
  const memberById = useMemo(() => {
    const map = new Map<string, any>();
    if (data?.members) for (const m of data.members) map.set(m.id, m);
    return map;
  }, [data]);

  const currentTabStats = communityStats.find(s => s.community === communityTab);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
            <ArrowDownUp size={22} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Conciliación · Miembros y Pagos</h1>
            <p className="text-sm text-gray-500">Vistazo claro: quién paga, cómo, y cuánto · cruzado con banco + Stripe</p>
          </div>
          <a href="/miembros" className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">← Vista comunidad</a>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
        ) : !data ? (
          <Card><p className="text-center py-8 text-gray-400">Sin datos</p></Card>
        ) : (
          <>
            {/* KPIs globales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="!p-4">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Miembros</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.totals.members}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Total comunidad</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-emerald-500">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1"><Check size={10} /> Pagan</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{data.totals.paying}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{Math.round((data.totals.paying / Math.max(data.totals.members, 1)) * 100)}% participación</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-purple-500">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide flex items-center gap-1"><Repeat size={10} /> Stripe activo</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{data.totals.stripeActive}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Suscripciones recurrentes</p>
              </Card>
              <Card className="!p-4 border-l-4 border-l-violet-500">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total recaudado</p>
                <p className="text-2xl font-bold text-violet-700 mt-1">{formatCurrency(data.totals.totalRecaudado)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Período seleccionado</p>
              </Card>
            </div>

            {/* Stripe sin matchear (alerta) */}
            {data.unmatchedSubs?.length > 0 && (
              <Card className="border-2 border-amber-300 bg-amber-50/50">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">{data.unmatchedSubs.length} suscripción(es) Stripe sin vincular</p>
                    <p className="text-[11px] text-amber-700">Vincúlalas en <a href="/miembros" className="underline">/miembros</a></p>
                  </div>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.unmatchedSubs.slice(0, 5).map((s: any) => (
                    <div key={s.subscriptionId || s.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-white rounded">
                      <Mail size={11} className="text-amber-600" />
                      <span className="font-medium truncate">{s.customerName}</span>
                      <span className="text-gray-400 truncate">{s.customerEmail}</span>
                      <span className="ml-auto font-semibold text-purple-700 whitespace-nowrap">{formatCurrency(s.amount)}/{s.interval}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Tabs de comunidad - GRANDES y visuales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {communityStats.map(({ community, total, paying, pct, recaudado }) => {
                const style = COMMUNITY_STYLES[community] || DEFAULT_COMMUNITY_STYLE;
                const active = communityTab === community;
                return (
                  <button
                    key={community}
                    onClick={() => setCommunityTab(community)}
                    data-active={active}
                    className={`relative p-3 sm:p-4 rounded-2xl border-2 text-left transition-all overflow-hidden
                      ${active
                        ? `${style.bg} text-white border-transparent shadow-md scale-[1.02]`
                        : `bg-white border-gray-200 hover:border-gray-300 text-gray-700`}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-white/25' : style.soft}`}>
                        <Church size={15} className={active ? 'text-white' : style.text} />
                      </div>
                      <p className={`text-sm font-bold truncate ${active ? 'text-white' : 'text-gray-900'}`}>{community}</p>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <p className={`text-xl sm:text-2xl font-bold ${active ? 'text-white' : style.text}`}>{paying}</p>
                      <p className={`text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>de {total} pagan</p>
                    </div>
                    <div className={`h-1.5 rounded-full mt-2 overflow-hidden ${active ? 'bg-white/25' : 'bg-gray-100'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${active ? 'bg-white' : style.bg}`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <p className={`text-[10px] mt-1.5 font-semibold ${active ? 'text-white/85' : 'text-gray-500'}`}>
                      {pct}% · {formatCurrency(recaudado)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Filtros sutiles */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar en ${communityTab}...`}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setStatusFilter(statusFilter === 'pagan' ? 'todos' : 'pagan')}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border-2 transition-all flex items-center gap-1.5
                    ${statusFilter === 'pagan' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                >
                  <Check size={12} /> Pagan
                </button>
                <button
                  onClick={() => setStatusFilter(statusFilter === 'no-pagan' ? 'todos' : 'no-pagan')}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border-2 transition-all flex items-center gap-1.5
                    ${statusFilter === 'no-pagan' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'}`}
                >
                  <X size={12} /> Sin pagar
                </button>
                <div className="w-px bg-gray-200 mx-0.5" />
                {[
                  { k: 'stripe', l: 'Stripe', icon: CreditCard, color: METHOD_COLORS.stripe },
                  { k: 'bizum', l: 'Bizum', icon: Smartphone, color: METHOD_COLORS.bizum },
                  { k: 'transferencia', l: 'Transfer.', icon: Landmark, color: METHOD_COLORS.transferencia },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = methodFilter === opt.k;
                  return (
                    <button
                      key={opt.k}
                      onClick={() => setMethodFilter(active ? 'all' : opt.k)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border-2 transition-all flex items-center gap-1.5
                        ${active ? `${opt.color.bg} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}
                    >
                      <Icon size={12} /> {opt.l}
                    </button>
                  );
                })}
                <div className="w-px bg-gray-200 mx-0.5" />
                <button
                  onClick={() => setSortBy(sortBy === 'amount' ? 'name' : 'amount')}
                  className="px-3 py-2 text-xs font-medium rounded-xl border-2 border-gray-200 bg-white text-gray-600 hover:border-violet-300 flex items-center gap-1.5"
                >
                  <Filter size={12} /> {sortBy === 'amount' ? '€' : 'Az'}
                </button>
              </div>
            </div>

            {/* Resumen banner de la comunidad activa */}
            {currentTabStats && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
                <div className={`w-1 h-8 rounded-full ${(COMMUNITY_STYLES[communityTab] || DEFAULT_COMMUNITY_STYLE).bg}`} />
                <p className="text-sm text-gray-600">
                  Mostrando <span className="font-bold text-gray-900">{visibleMembers.length}</span> de{' '}
                  <span className="font-bold">{currentTabStats.total}</span> miembros de{' '}
                  <span className={`font-bold ${(COMMUNITY_STYLES[communityTab] || DEFAULT_COMMUNITY_STYLE).text}`}>{communityTab}</span>
                </p>
                <span className="text-gray-300 hidden sm:inline">·</span>
                <p className="text-sm text-gray-500 hidden sm:block">
                  <span className="font-semibold text-emerald-600">{currentTabStats.paying} pagan</span> ({currentTabStats.pct}%) · {formatCurrency(currentTabStats.recaudado)} recaudado
                </p>
              </div>
            )}

            {/* Grid de miembros */}
            {visibleMembers.length === 0 ? (
              <Card>
                <p className="text-center py-12 text-gray-400 text-sm">Sin miembros con estos filtros</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleMembers.map((m: any) => {
                  const isOpen = expanded === m.id;
                  const paga = m.totalPaid > 0 || m.methods.stripe.subscriptionActive;
                  const method = m.methodPrimary === 'sin pagos' && m.methods.stripe.subscriptionActive ? 'stripe' : m.methodPrimary;
                  const methodColor = METHOD_COLORS[method] || METHOD_COLORS['sin pagos'];
                  const MethodIcon = METHOD_ICON[method] || Landmark;
                  const pair = m.pairedWith ? memberById.get(m.pairedWith) : null;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setExpanded(isOpen ? null : m.id)}
                      className={`relative bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md
                        ${paga ? methodColor.border + ' hover:ring-4 hover:' + methodColor.ring : 'border-rose-200 hover:border-rose-300'}
                        ${isOpen ? 'ring-4 ' + methodColor.ring : ''}`}
                    >
                      {/* Status dot */}
                      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${paga ? 'bg-emerald-500' : 'bg-rose-400'}`} />

                      <div className="flex items-start gap-3 mb-3">
                        {/* Avatar inicial */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0
                          ${paga ? methodColor.soft + ' ' + methodColor.text : 'bg-rose-50 text-rose-500'}`}>
                          {getInitials(m.apodo || m.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">{m.apodo || m.name}</p>
                          {m.apodo && <p className="text-[10px] text-gray-400 truncate">{m.name}</p>}
                          {m.methods.stripe.subscriptionActive && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">
                              <Zap size={8} /> SUB ACTIVA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Método y total */}
                      {paga ? (
                        <div className={`${methodColor.soft} rounded-xl p-3 mb-2`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <MethodIcon size={14} className={methodColor.text} />
                              <span className={`text-[11px] font-bold uppercase ${methodColor.text}`}>{METHOD_LABEL[method] || method}</span>
                            </div>
                            <span className="text-[10px] text-gray-500">{m.paymentCount} pagos</span>
                          </div>
                          <p className={`text-xl font-bold ${methodColor.text}`}>{formatCurrency(m.totalPaid)}</p>
                          {m.methods.stripe.subscriptionActive && m.methods.stripe.subscriptionAmount && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {formatCurrency(m.methods.stripe.subscriptionAmount)}/{m.methods.stripe.subscriptionInterval === 'year' ? 'año' : 'mes'} recurrente
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-rose-50 rounded-xl p-3 mb-2 flex items-center gap-2">
                          <X size={14} className="text-rose-500" />
                          <p className="text-sm font-semibold text-rose-600">Sin pagos registrados</p>
                        </div>
                      )}

                      {/* Pareja */}
                      {pair && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-50 border border-violet-100 rounded-lg">
                          <Link2 size={11} className="text-violet-500 flex-shrink-0" />
                          <p className="text-[11px] text-violet-700 truncate">
                            <span className="text-violet-400">↔</span> {pair.apodo || pair.name}
                          </p>
                        </div>
                      )}

                      {/* Mini badges desglose métodos si hay más de uno */}
                      {(() => {
                        const counts = [
                          m.methods.stripe.count > 0 && { k: 'stripe', n: m.methods.stripe.count, t: m.methods.stripe.total },
                          m.methods.bizum.count > 0 && { k: 'bizum', n: m.methods.bizum.count, t: m.methods.bizum.total },
                          m.methods.transferencia.count > 0 && { k: 'transferencia', n: m.methods.transferencia.count, t: m.methods.transferencia.total },
                        ].filter(Boolean) as { k: string; n: number; t: number }[];
                        if (counts.length <= 1) return null;
                        return (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {counts.map(c => {
                              const cl = METHOD_COLORS[c.k];
                              const Ico = METHOD_ICON[c.k];
                              return (
                                <span key={c.k} className={`inline-flex items-center gap-1 ${cl.soft} ${cl.text} px-1.5 py-0.5 rounded text-[10px] font-medium`}>
                                  <Ico size={9} /> {formatCurrency(c.t)}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Histórico expandible */}
                      {isOpen && m.history.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Histórico ({m.history.length})</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                            {m.history.slice(0, 12).map((h: any, i: number) => {
                              const Ico = METHOD_ICON[h.method] || Landmark;
                              const cl = METHOD_COLORS[h.method] || METHOD_COLORS.otro;
                              return (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] py-1 px-1.5 hover:bg-gray-50 rounded">
                                  <Ico size={10} className={cl.text + ' flex-shrink-0'} />
                                  <span className="text-gray-400 w-16 flex-shrink-0">{new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                  <span className="flex-1 truncate text-gray-500 text-[10px]">{h.concept || '—'}</span>
                                  <span className="font-semibold text-gray-900 ml-auto">{formatCurrency(h.amount)}</span>
                                </div>
                              );
                            })}
                            {m.history.length > 12 && <p className="text-[10px] text-gray-400 italic px-1.5">+{m.history.length - 12} más...</p>}
                          </div>
                        </div>
                      )}

                      {!isOpen && m.history.length > 0 && (
                        <div className="flex items-center justify-center mt-2 text-[10px] text-gray-400 hover:text-violet-600">
                          <ChevronRight size={11} /> ver histórico
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer info */}
            <p className="text-[11px] text-gray-400 text-center px-4 py-2">
              💡 Cruzado con Stripe API + bank_transactions tag Diezmo · Click en una tarjeta para ver el histórico completo
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
