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
  const [pairingFor, setPairingFor] = useState<string | null>(null);
  const [pairSearch, setPairSearch] = useState('');
  const [showMatching, setShowMatching] = useState(false);

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
  useEffect(() => { load(); }, [selectedRange]);

  async function handlePair(memberA: string, memberB: string) {
    const res = await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pair_members', memberA, memberB }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert('Error al vincular: ' + (e.error || res.statusText)); return; }
    setPairingFor(null); setPairSearch('');
    await load();
  }
  async function handleUnpair(memberId: string) {
    if (!confirm('¿Desvincular esta pareja?')) return;
    const res = await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpair_members', memberId }) });
    if (!res.ok) { alert('Error al desvincular'); return; }
    await load();
  }

  async function handleLinkStripe(memberId: string, sub: any) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link_stripe', memberId, customerId: sub.customerId, customerEmail: sub.customerEmail, subscriptionId: sub.subscriptionId || sub.subscriptionId, amount: sub.amount, interval: sub.interval }) });
    await load();
  }
  async function handleUnlinkStripe(memberId: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unlink_stripe', memberId }) });
    await load();
  }
  async function handleAddBankRule(memberId: string, pattern: string) {
    if (!pattern.trim()) return;
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_bank_rule', memberId, pattern: pattern.toLowerCase().trim() }) });
    await load();
  }
  async function handleDeleteBankRule(ruleId: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_bank_rule', ruleId }) });
    await load();
  }

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
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <Church size={22} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Diezmos</h1>
            <p className="text-sm text-gray-500">Quién paga, cómo y cuánto · cruzado con banco + Stripe</p>
          </div>
          <a href="/miembros" className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">← Miembros</a>
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

            {/* Transferencias bancarias sin vincular */}
            {data.unmatchedBank?.length > 0 && (
              <Card className="border-2 border-amber-300 bg-amber-50/50">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">{data.unmatchedBank.length} transferencia(s) bancaria(s) sin vincular</p>
                    <p className="text-[11px] text-amber-700">Marcadas como diezmo pero sin miembro asignado · Click para asignar manualmente</p>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {data.unmatchedBank.slice(0, 30).map((tx: any) => (
                    <UnmatchedBankRow key={tx.id} tx={tx} members={data.members} onLinked={load} />
                  ))}
                </div>
              </Card>
            )}

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

            {/* TABLA DE MATCHING — Stripe ↔ Comunidad ↔ Banco */}
            <Card className="!p-0 overflow-hidden">
              <button
                onClick={() => setShowMatching(!showMatching)}
                className="w-full flex items-center gap-3 p-4 hover:bg-violet-50/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <ArrowDownUp size={18} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Tabla de Matching</p>
                  <p className="text-[11px] text-gray-500">Asocia manualmente: Stripe ↔ Miembro comunidad ↔ Concepto banco</p>
                </div>
                <ChevronRight size={18} className={`text-gray-400 transition-transform ${showMatching ? 'rotate-90' : ''}`} />
              </button>
              {showMatching && (
                <MatchingTable
                  members={data.members || []}
                  bankRules={data.bankRules || []}
                  bankNames={data.bankNamesList || []}
                  stripeCustomers={data.stripeCustomersList || []}
                  unmatchedSubs={data.unmatchedSubs || []}
                  onLinkStripe={handleLinkStripe}
                  onUnlinkStripe={handleUnlinkStripe}
                  onAddBankRule={handleAddBankRule}
                  onDeleteBankRule={handleDeleteBankRule}
                />
              )}
            </Card>

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
                      {pair ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-50 border border-violet-100 rounded-lg">
                          <Link2 size={11} className="text-violet-500 flex-shrink-0" />
                          <p className="text-[11px] text-violet-700 truncate flex-1">
                            <span className="text-violet-400">↔</span> {pair.apodo || pair.name}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnpair(m.id); }}
                            className="text-violet-400 hover:text-rose-500 flex-shrink-0"
                            title="Desvincular"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPairingFor(m.id); setPairSearch(''); }}
                          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-gray-50 hover:bg-violet-50 border border-dashed border-gray-200 hover:border-violet-300 rounded-lg text-[11px] text-gray-500 hover:text-violet-600 transition-colors"
                        >
                          <Link2 size={11} /> Vincular pareja
                        </button>
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

        {/* Modal vincular pareja */}
        {pairingFor && data?.members && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setPairingFor(null); setPairSearch(''); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 size={18} className="text-violet-600" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Vincular pareja</h3>
                    <p className="text-[11px] text-gray-500">
                      {(() => { const m = data.members.find((x: any) => x.id === pairingFor); return m ? (m.apodo || m.name) : ''; })()}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setPairingFor(null); setPairSearch(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={pairSearch}
                    onChange={(e) => setPairSearch(e.target.value)}
                    placeholder="Buscar miembro..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {data.members
                  .filter((m: any) => m.id !== pairingFor && !m.pairedWith)
                  .filter((m: any) => {
                    if (!pairSearch) return true;
                    const s = pairSearch.toLowerCase();
                    return m.name.toLowerCase().includes(s) || (m.apodo || '').toLowerCase().includes(s);
                  })
                  .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                  .map((candidate: any) => {
                    const cs = COMMUNITY_STYLES[candidate.community] || DEFAULT_COMMUNITY_STYLE;
                    return (
                      <button
                        key={candidate.id}
                        onClick={() => handlePair(pairingFor, candidate.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 border-b border-gray-50 transition-colors text-left"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cs.soft} ${cs.text} font-bold text-sm flex-shrink-0`}>
                          {getInitials(candidate.apodo || candidate.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{candidate.apodo || candidate.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{candidate.community}</p>
                        </div>
                        <Link2 size={14} className="text-violet-400" />
                      </button>
                    );
                  })}
                {data.members.filter((m: any) => m.id !== pairingFor && !m.pairedWith).length === 0 && (
                  <p className="p-8 text-center text-sm text-gray-400">No hay miembros sin pareja disponibles</p>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-500">
                  La vinculación es bidireccional. Cuando una persona paga, se marca como pago para los dos.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function UnmatchedBankRow({ tx, members, onLinked }: { tx: any; members: any[]; onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createRule, setCreateRule] = useState(true);

  async function link(memberId: string) {
    await fetch('/api/diezmos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link_bank_tx', memberId, amount: tx.amount, date: tx.date }),
    });
    if (createRule) {
      const pattern = (tx.memberName || tx.concept || '').toLowerCase().split(' ').slice(0, 3).join(' ');
      if (pattern) {
        await fetch('/api/diezmos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_bank_rule', pattern, memberId }),
        });
      }
    }
    setOpen(false); setSearch(''); onLinked();
  }

  const candidates = members
    .filter((m: any) => !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.apodo || '').toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30);

  return (
    <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-50 text-left">
        <Landmark size={12} className="text-amber-500 flex-shrink-0" />
        <span className="text-[11px] text-gray-500 w-16 flex-shrink-0">{new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
        <span className="flex-1 text-xs text-gray-700 truncate">{tx.concept}</span>
        <span className="text-xs font-bold text-amber-700 ml-2">{formatCurrency(tx.amount)}</span>
        <ChevronRight size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-amber-100 p-2 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-2">
            <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
              placeholder="Buscar miembro..." className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-400" />
            <label className="flex items-center gap-1 text-[10px] text-gray-600">
              <input type="checkbox" checked={createRule} onChange={e => setCreateRule(e.target.checked)} />
              regla auto
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
            {candidates.map((m: any) => (
              <button key={m.id} onClick={() => link(m.id)}
                className="text-left px-2 py-1 text-xs bg-white hover:bg-violet-50 border border-gray-100 rounded flex items-center gap-1.5">
                <Link2 size={10} className="text-violet-500 flex-shrink-0" />
                <span className="truncate">{m.apodo || m.name}</span>
                <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{m.community}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchingTable({ members, bankRules, bankNames, stripeCustomers, unmatchedSubs, onLinkStripe, onUnlinkStripe, onAddBankRule, onDeleteBankRule }: any) {
  const [search, setSearch] = useState('');
  const [editingStripeFor, setEditingStripeFor] = useState<string | null>(null);
  const [editingBankFor, setEditingBankFor] = useState<string | null>(null);
  const [bankPattern, setBankPattern] = useState('');

  // Index bank rules por miembro
  const rulesByMember: Record<string, any[]> = {};
  for (const r of bankRules) {
    if (!rulesByMember[r.member_id]) rulesByMember[r.member_id] = [];
    rulesByMember[r.member_id].push(r);
  }

  const filteredMembers = members.filter((m: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.name.toLowerCase().includes(s) || (m.apodo || '').toLowerCase().includes(s);
  });

  // Subs/customers Stripe libres (sin vincular a miembro)
  const linkedCustomerIds = new Set(members.filter((m: any) => m.methods?.stripe?.subscriptionActive).map((m: any) => (m.methods.stripe.email || '').toLowerCase()));
  const availableStripe = [
    ...unmatchedSubs.map((s: any) => ({ ...s, kind: 'sub' })),
    ...stripeCustomers.filter((c: any) => !c.isSubscription && c.customerEmail && !linkedCustomerIds.has(c.customerEmail.toLowerCase())).map((c: any) => ({ ...c, kind: 'charge' })),
  ];

  return (
    <div className="border-t border-gray-200 bg-gray-50/50">
      <div className="p-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar miembro..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Cada miembro puede tener: <span className="text-purple-600 font-semibold">1 Stripe</span> + <span className="text-emerald-600 font-semibold">N patrones bancarios</span>. Los patrones bancarios son texto que debe aparecer en el concepto del banco para asignar el pago a este miembro.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-3 py-2.5">Miembro</th>
              <th className="text-left text-[10px] font-bold text-purple-700 uppercase tracking-wide px-3 py-2.5 bg-purple-50">💳 Stripe vinculado</th>
              <th className="text-left text-[10px] font-bold text-emerald-700 uppercase tracking-wide px-3 py-2.5 bg-emerald-50">🏦 Patrones bancarios</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m: any) => {
              const memberRules = rulesByMember[m.id] || [];
              const stripeLinked = m.methods?.stripe?.subscriptionActive || (m.methods?.stripe?.count > 0);
              return (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-white">
                  <td className="px-3 py-2.5 align-top w-1/4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {getInitials(m.apodo || m.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{m.apodo || m.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{m.community}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top w-2/5 bg-purple-50/30">
                    {stripeLinked ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded">
                          <CreditCard size={9} />
                          {m.methods.stripe.email || 'vinculado'}
                          <button onClick={() => onUnlinkStripe(m.id)} className="ml-1 hover:text-rose-600" title="Desvincular">
                            <X size={9} />
                          </button>
                        </span>
                      </div>
                    ) : editingStripeFor === m.id ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {availableStripe.length === 0 ? (
                          <p className="text-[10px] text-gray-400 italic">No hay Stripe libres</p>
                        ) : (
                          availableStripe.slice(0, 8).map((s: any, i: number) => (
                            <button
                              key={s.subscriptionId || s.customerId || i}
                              onClick={() => { onLinkStripe(m.id, s); setEditingStripeFor(null); }}
                              className="w-full text-left flex items-center gap-1 px-2 py-1 text-[10px] bg-white hover:bg-purple-50 border border-purple-100 rounded"
                            >
                              <Link2 size={9} className="text-purple-500" />
                              <span className="font-medium truncate">{s.customerName}</span>
                              <span className="text-gray-400 truncate">{s.customerEmail}</span>
                            </button>
                          ))
                        )}
                        <button onClick={() => setEditingStripeFor(null)} className="text-[10px] text-gray-500 hover:text-gray-700 px-2">cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingStripeFor(m.id)} className="text-[10px] text-purple-600 hover:bg-purple-50 px-2 py-0.5 rounded border border-dashed border-purple-300">
                        + Vincular Stripe
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-emerald-50/30">
                    <div className="flex items-center gap-1 flex-wrap">
                      {memberRules.map((r: any) => (
                        <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                          <Landmark size={9} />
                          {r.pattern}
                          <button onClick={() => onDeleteBankRule(r.id)} className="ml-1 hover:text-rose-600" title="Borrar regla">
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      {editingBankFor === m.id ? (
                        <div className="flex items-center gap-1 w-full mt-1">
                          <input
                            autoFocus
                            value={bankPattern}
                            onChange={(e) => setBankPattern(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { onAddBankRule(m.id, bankPattern); setBankPattern(''); setEditingBankFor(null); } if (e.key === 'Escape') { setEditingBankFor(null); setBankPattern(''); } }}
                            placeholder="Texto del concepto banco..."
                            className="flex-1 text-[10px] border border-emerald-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                          <button onClick={() => { onAddBankRule(m.id, bankPattern); setBankPattern(''); setEditingBankFor(null); }} className="text-emerald-600 hover:bg-emerald-50 p-0.5 rounded"><Check size={11} /></button>
                          <button onClick={() => { setEditingBankFor(null); setBankPattern(''); }} className="text-gray-400 p-0.5"><X size={11} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingBankFor(m.id)} className="text-[10px] text-emerald-600 hover:bg-emerald-50 px-2 py-0.5 rounded border border-dashed border-emerald-300">
                          + Patrón
                        </button>
                      )}
                    </div>
                    {bankNames.length > 0 && editingBankFor === m.id && (
                      <div className="mt-1.5 max-h-24 overflow-y-auto">
                        <p className="text-[9px] text-gray-400 px-1 mb-0.5">Sugerencias del banco:</p>
                        <div className="flex flex-wrap gap-1">
                          {bankNames.slice(0, 8).map((bn: any) => (
                            <button key={bn.name}
                              onClick={() => { onAddBankRule(m.id, bn.name); setEditingBankFor(null); setBankPattern(''); }}
                              className="text-[9px] px-1.5 py-0.5 bg-white hover:bg-emerald-50 border border-emerald-100 rounded flex items-center gap-1">
                              {bn.name} <span className="text-emerald-400">({bn.count})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
