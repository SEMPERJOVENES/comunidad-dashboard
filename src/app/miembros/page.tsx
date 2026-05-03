'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Users, Loader2, UserPlus, Search, Cake, Church, Check, X,
  CreditCard, Smartphone, Landmark, Edit3, Trash2, Mail, Link2,
  ChevronRight, AlertCircle, Save,
} from 'lucide-react';
import { getBirthdaysThisMonth } from '@/lib/birthdays';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const COMMUNITY_ORDER = ['San Pablo', 'San Ignacio', 'San Martín', 'Colaboradores'];

const COMMUNITY_STYLES: Record<string, { bg: string; text: string; soft: string }> = {
  'San Pablo':     { bg: 'bg-blue-500',    text: 'text-blue-700',    soft: 'bg-blue-50' },
  'San Ignacio':   { bg: 'bg-green-500',   text: 'text-green-700',   soft: 'bg-green-50' },
  'San Martín':    { bg: 'bg-orange-500',  text: 'text-orange-700',  soft: 'bg-orange-50' },
  'Colaboradores': { bg: 'bg-violet-500',  text: 'text-violet-700',  soft: 'bg-violet-50' },
};
const DEFAULT_STYLE = COMMUNITY_STYLES['Colaboradores'];

const SOURCE_ICON: Record<string, any> = {
  stripe: CreditCard, banco: Landmark, manual: Edit3, ambos: CreditCard,
  pareja: Link2, 'stripe-anual': CreditCard,
};
const SOURCE_LABEL: Record<string, string> = {
  stripe: 'Stripe', banco: 'Transfer/Bizum', manual: 'Manual', ambos: 'Mixto',
  pareja: 'Vía pareja', 'stripe-anual': 'Stripe anual',
};
const SOURCE_COLOR: Record<string, string> = {
  stripe: 'text-purple-600 bg-purple-50',
  banco: 'text-emerald-600 bg-emerald-50',
  manual: 'text-violet-600 bg-violet-50',
  ambos: 'text-blue-600 bg-blue-50',
  pareja: 'text-violet-600 bg-violet-50',
  'stripe-anual': 'text-purple-600 bg-purple-50',
};

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(key: string) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y.slice(2)}`;
}

export default function MiembrosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    label: 'Este año',
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(),
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [communityTab, setCommunityTab] = useState<string>('San Pablo');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pagan' | 'no-pagan'>('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newCommunity, setNewCommunity] = useState('San Pablo');
  const [newEmail, setNewEmail] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const birthdays = useMemo(() => getBirthdaysThisMonth(), []);
  const currentMonth = useMemo(() => getMonthKey(), []);

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
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    const res = await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_member', name: newName, nickname: newNickname || null, community: newCommunity, email: newEmail || null }) });
    if (!res.ok) { alert('Error al añadir'); return; }
    setNewName(''); setNewNickname(''); setNewEmail(''); setShowAddForm(false); await load();
  }

  async function handleSave(id: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_member', id, ...editForm }) });
    setEditingId(null); setEditForm({}); await load();
  }

  async function handleDelete(id: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_member', id }) });
    setDeletingId(null); await load();
  }

  // Comunidades visibles (en BD existentes)
  const allCommunities = useMemo(() => {
    if (!data?.members) return [];
    const set = new Set<string>(data.members.map((m: any) => m.community).filter(Boolean));
    const arr = Array.from(set);
    arr.sort((a, b) => COMMUNITY_ORDER.indexOf(a) - COMMUNITY_ORDER.indexOf(b));
    return arr;
  }, [data]);

  useEffect(() => {
    if (allCommunities.length > 0 && !allCommunities.includes(communityTab)) {
      setCommunityTab(allCommunities[0]);
    }
  }, [allCommunities, communityTab]);

  // Estadísticas por comunidad
  const communityStats = useMemo(() => {
    if (!data?.members) return [];
    return allCommunities.map(c => {
      const list = data.members.filter((m: any) => m.community === c);
      const pagan = list.filter((m: any) => m.payments?.[currentMonth] || m.isActive);
      return { community: c, total: list.length, paying: pagan.length, pct: list.length ? Math.round((pagan.length / list.length) * 100) : 0 };
    });
  }, [data, allCommunities, currentMonth]);

  // Lookup por id para resolver pareja
  const memberById = useMemo(() => {
    const map = new Map<string, any>();
    if (data?.members) for (const m of data.members) map.set(m.id, m);
    return map;
  }, [data]);

  // Miembros visibles (filtrados)
  const visibleMembers = useMemo(() => {
    if (!data?.members) return [];
    let arr = data.members.filter((m: any) => m.community === communityTab);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((m: any) =>
        m.name.toLowerCase().includes(s) ||
        (m.nickname || '').toLowerCase().includes(s) ||
        (m.email || '').toLowerCase().includes(s)
      );
    }
    if (statusFilter === 'pagan') arr = arr.filter((m: any) => m.payments?.[currentMonth] || m.isActive);
    else if (statusFilter === 'no-pagan') arr = arr.filter((m: any) => !m.payments?.[currentMonth] && !m.isActive);
    arr.sort((a: any, b: any) => {
      const aPays = a.payments?.[currentMonth] ? 1 : 0;
      const bPays = b.payments?.[currentMonth] ? 1 : 0;
      if (aPays !== bPays) return bPays - aPays;
      return (a.name || '').localeCompare(b.name || '');
    });
    return arr;
  }, [data, communityTab, search, statusFilter, currentMonth]);

  // Sin pagar (todas las comunidades, mes actual)
  const sinPagar = useMemo(() => {
    if (!data?.members) return [];
    return data.members.filter((m: any) => !m.payments?.[currentMonth] && !m.isActive);
  }, [data, currentMonth]);

  const currentTabStats = communityStats.find(s => s.community === communityTab);

  function displayName(m: any) { return m.nickname || m.name; }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users size={22} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Miembros</h1>
            <p className="text-sm text-gray-500">Vista por comunidad · cumpleaños · gestión sencilla</p>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700">
            <UserPlus size={14} /> Añadir
          </button>
        </div>

        {/* Banner cumpleaños */}
        {birthdays.length > 0 && (
          <Card className="!p-3.5 border-l-4 border-l-amber-400 bg-amber-50/70">
            <div className="flex items-center gap-2 mb-2">
              <Cake size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-amber-800">Cumpleaños este mes ({birthdays.length})</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {birthdays.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                  <Cake size={10} className="text-amber-400" />
                  {b.name}
                  <span className="text-amber-400 font-normal">{b.day} {MONTHS_SHORT[b.month - 1]}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Add form */}
        {showAddForm && (
          <Card className="border-2 border-violet-200 bg-violet-50/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Añadir miembro</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo *"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              <input value={newNickname} onChange={e => setNewNickname(e.target.value)} placeholder="Apodo"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              <select value={newCommunity} onChange={e => setNewCommunity(e.target.value)}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white">
                {allCommunities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
            </div>
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="w-full mt-3 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50">
              Guardar
            </button>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
        ) : !data ? (
          <Card><p className="text-center py-8 text-gray-400">Sin datos</p></Card>
        ) : (
          <>
            {/* Tabs comunidad */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {communityStats.map(({ community, total, paying, pct }) => {
                const style = COMMUNITY_STYLES[community] || DEFAULT_STYLE;
                const active = communityTab === community;
                return (
                  <button key={community} onClick={() => setCommunityTab(community)}
                    className={`relative p-3 sm:p-4 rounded-2xl border-2 text-left transition-all
                      ${active ? `${style.bg} text-white border-transparent shadow-md scale-[1.02]` : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'}`}>
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
                      <div className={`h-full rounded-full ${active ? 'bg-white' : style.bg}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar en ${communityTab}...`}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div className="flex gap-1.5">
                {[
                  { k: 'todos', l: 'Todos' },
                  { k: 'pagan', l: 'Pagan' },
                  { k: 'no-pagan', l: 'Sin pagar' },
                ].map(o => (
                  <button key={o.k} onClick={() => setStatusFilter(o.k as any)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border-2 transition-all ${statusFilter === o.k ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen banner */}
            {currentTabStats && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
                <div className={`w-1 h-8 rounded-full ${(COMMUNITY_STYLES[communityTab] || DEFAULT_STYLE).bg}`} />
                <p className="text-sm text-gray-600">
                  Mostrando <span className="font-bold text-gray-900">{visibleMembers.length}</span> de <span className="font-bold">{currentTabStats.total}</span>
                  <span className={`font-bold ml-1 ${(COMMUNITY_STYLES[communityTab] || DEFAULT_STYLE).text}`}>{communityTab}</span>
                </p>
                <span className="text-gray-300 hidden sm:inline">·</span>
                <p className="text-sm text-gray-500 hidden sm:block">
                  <span className="font-semibold text-emerald-600">{currentTabStats.paying} pagan</span> ({currentTabStats.pct}%)
                </p>
              </div>
            )}

            {/* Grid miembros */}
            {visibleMembers.length === 0 ? (
              <Card><p className="text-center py-12 text-gray-400 text-sm">Sin miembros con estos filtros</p></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleMembers.map((m: any) => {
                  const isEditing = editingId === m.id;
                  const isExpanded = expandedHistory === m.id;
                  const isDeleting = deletingId === m.id;
                  const monthPayment = m.payments?.[currentMonth];
                  const paga = !!monthPayment || m.isActive;
                  const pair = m.pairedWith ? memberById.get(m.pairedWith) : null;
                  const hasBday = birthdays.some(b => b.name === displayName(m) || b.name === m.name);

                  // Histórico ordenado descendente
                  const history = Object.entries(m.payments || {})
                    .map(([month, p]: [string, any]) => ({ month, ...p }))
                    .sort((a, b) => b.month.localeCompare(a.month));

                  return (
                    <div key={m.id}
                      className={`relative bg-white rounded-2xl border-2 p-4 transition-all ${paga ? 'border-emerald-200 hover:border-emerald-400' : 'border-rose-200 hover:border-rose-400'} ${isExpanded ? 'shadow-lg' : ''}`}>
                      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${paga ? 'bg-emerald-500' : 'bg-rose-400'}`} />

                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 ${paga ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-500'} ${hasBday ? 'ring-2 ring-amber-300' : ''}`}>
                          {hasBday ? <Cake size={20} className="text-amber-500" /> : getInitials(displayName(m))}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input value={editForm.name ?? m.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                                className="w-full text-sm font-bold border border-gray-200 rounded px-2 py-1" placeholder="Nombre" />
                              <input value={editForm.nickname ?? (m.nickname || '')} onChange={e => setEditForm({...editForm, nickname: e.target.value})}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="Apodo" />
                              <input value={editForm.email ?? (m.email || '')} onChange={e => setEditForm({...editForm, email: e.target.value})}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="Email" />
                              <select value={editForm.community ?? m.community} onChange={e => setEditForm({...editForm, community: e.target.value})}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                                {allCommunities.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-gray-900 truncate">{displayName(m)}</p>
                              {m.nickname && <p className="text-[10px] text-gray-400 truncate">{m.name}</p>}
                              {m.email && <p className="text-[10px] text-gray-400 truncate flex items-center gap-1"><Mail size={9} /> {m.email}</p>}
                              {m.stripeSubscriptionId && (
                                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">
                                  <CreditCard size={8} /> SUB {m.stripeAmount ? `${m.stripeAmount}€/${m.stripeInterval === 'year' ? 'año' : 'mes'}` : ''}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingId(m.id); setEditForm({}); }}
                              className="p-1 text-gray-400 hover:text-violet-600" title="Editar">
                              <Edit3 size={13} />
                            </button>
                            {isDeleting ? (
                              <div className="flex gap-0.5">
                                <button onClick={() => handleDelete(m.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Check size={12} /></button>
                                <button onClick={() => setDeletingId(null)} className="p-1 text-gray-400"><X size={12} /></button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingId(m.id)} className="p-1 text-gray-400 hover:text-rose-600" title="Eliminar">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Pago del mes actual */}
                      {monthPayment ? (
                        <div className={`rounded-xl p-2.5 mb-2 ${SOURCE_COLOR[monthPayment.source] || SOURCE_COLOR.banco}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase">{formatMonth(currentMonth)} · {SOURCE_LABEL[monthPayment.source] || monthPayment.source}</span>
                            <span className="text-base font-bold">{formatCurrency(monthPayment.amount)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-2.5 mb-2 bg-rose-50 flex items-center gap-2">
                          <X size={12} className="text-rose-500" />
                          <span className="text-xs font-medium text-rose-600">No ha pagado {formatMonth(currentMonth)}</span>
                        </div>
                      )}

                      {/* Pareja */}
                      {pair && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-50 border border-violet-100 rounded-lg mb-2">
                          <Link2 size={11} className="text-violet-500" />
                          <p className="text-[11px] text-violet-700 truncate">↔ {pair.nickname || pair.name}</p>
                        </div>
                      )}

                      {/* Acciones edit */}
                      {isEditing && (
                        <div className="flex gap-1.5 mb-2">
                          <button onClick={() => handleSave(m.id)} className="flex-1 px-2 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 flex items-center justify-center gap-1">
                            <Save size={11} /> Guardar
                          </button>
                          <button onClick={() => { setEditingId(null); setEditForm({}); }} className="px-2 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Histórico */}
                      {!isEditing && history.length > 0 && (
                        <button onClick={() => setExpandedHistory(isExpanded ? null : m.id)}
                          className="w-full text-[10px] text-gray-400 hover:text-violet-600 flex items-center justify-center gap-1 py-1">
                          <ChevronRight size={10} className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
                          {isExpanded ? 'Ocultar' : `Ver histórico (${history.length})`}
                        </button>
                      )}

                      {isExpanded && history.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 max-h-40 overflow-y-auto">
                          {history.slice(0, 18).map((h, i) => {
                            const Icon = SOURCE_ICON[h.source] || Landmark;
                            const cl = SOURCE_COLOR[h.source] || SOURCE_COLOR.banco;
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-[11px] py-0.5 px-1.5 hover:bg-gray-50 rounded">
                                <Icon size={10} className={cl.split(' ')[0]} />
                                <span className="text-gray-400 w-12 flex-shrink-0">{formatMonth(h.month)}</span>
                                <span className="flex-1 text-gray-500 text-[10px] truncate">{SOURCE_LABEL[h.source] || h.source}</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(h.amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sin pagar (tabla simple, todas comunidades) */}
            {sinPagar.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-rose-500" />
                  <h3 className="text-sm font-bold text-gray-900">Sin pagar este mes ({sinPagar.length})</h3>
                  <span className="ml-auto text-[10px] text-gray-400">Datos reales · ningún pago en {formatMonth(currentMonth)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sinPagar.map((m: any) => {
                    const cs = COMMUNITY_STYLES[m.community] || DEFAULT_STYLE;
                    const lastPayment = Object.entries(m.payments || {}).sort(([a], [b]) => b.localeCompare(a))[0];
                    return (
                      <div key={m.id} className="flex items-center gap-2 p-2 bg-rose-50/50 border border-rose-100 rounded-lg">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${cs.soft} ${cs.text}`}>
                          {getInitials(displayName(m))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{displayName(m)}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {m.community} · {lastPayment ? `Último: ${formatMonth(lastPayment[0])}` : 'Nunca pagó'}
                          </p>
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
