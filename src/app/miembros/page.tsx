'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { DateRange } from '@/lib/types';
import { getDefaultRange, formatCurrency } from '@/lib/utils';
import {
  Church, UserPlus, Loader2, Search, Trash2, Edit3, Check, X,
  ChevronLeft, ChevronRight, CreditCard, Landmark, Link2, Unlink,
  TrendingUp, Users, LayoutGrid, Table2, PieChart, Plus, Cake,
} from 'lucide-react';
import { getBirthdaysThisMonth } from '@/lib/birthdays';

type ViewMode = 'grid' | 'list' | 'pertenencia';

const VIEW_TABS: { key: ViewMode; label: string; icon: any; desc: string }[] = [
  { key: 'grid',       label: 'Cuadrícula',    icon: LayoutGrid, desc: 'Matriz mensual' },
  { key: 'list',       label: 'Tabla',          icon: Table2,     desc: 'Tabla de miembros' },
  { key: 'pertenencia',label: 'Pertenencia',    icon: PieChart,   desc: 'Verde / Rojo' },
];

const COMUNIDADES_ORDER = ['San Martín', 'San Ignacio', 'San Pablo', 'Colaboradores'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getMonthsFrom2023(): string[] {
  const months: string[] = [];
  const d = new Date(2023, 0, 1);
  const now = new Date();
  while (d <= now) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months.length > 0 ? months : [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
}

function getMonthsInRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const e = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= e) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function formatMonth(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatMonthFull(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

export default function MiembrosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    label: 'Este año',
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(),
  });
  const [members, setMembers] = useState<any[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [communityStats, setCommunityStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCommunity, setFilterCommunity] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newCommunity, setNewCommunity] = useState('San Pablo');
  const [newEmail, setNewEmail] = useState('');
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [monthOffset, setMonthOffset] = useState(0);
  const [editingPayment, setEditingPayment] = useState<{ memberId: string; month: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [editingCommunity, setEditingCommunity] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  });
  const [unmatchedStripe, setUnmatchedStripe] = useState<any[]>([]);
  const [unmatchedBank, setUnmatchedBank] = useState<any[]>([]);
  const [bankRules, setBankRules] = useState<any[]>([]);
  const [linkingStripe, setLinkingStripe] = useState<string | null>(null);
  const [linkingBank, setLinkingBank] = useState<string | null>(null);
  const [selectedMemberForStripeLink, setSelectedMemberForStripeLink] = useState<string>('');
  const [selectedMemberForBankLink, setSelectedMemberForBankLink] = useState<string>('');
  const [createBankRuleChecked, setCreateBankRuleChecked] = useState(true);
  const [creatingFromStripe, setCreatingFromStripe] = useState<any | null>(null);
  const [newMemberCommunity, setNewMemberCommunity] = useState('San Pablo');

  const birthdaysThisMonth = useMemo(() => getBirthdaysThisMonth(), []);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: new Date(2023, 0, 1).toISOString(),
        end: new Date().toISOString(),
      });
      const res = await fetch(`/api/diezmos?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setCommunities(data.communities || []);
      setCommunityStats(data.communityStats || []);
      setSummary(data.summary || null);
      setUnmatchedStripe(data.unmatchedStripeSubscribers || []);
      setUnmatchedBank(data.unmatchedBankTransfers || []);
      setBankRules(data.bankRules || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch('/api/diezmos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_member', name: newName, nickname: newNickname || null, community: newCommunity, email: newEmail || null }),
    });
    setNewName(''); setNewNickname(''); setNewEmail(''); setShowAddForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_member', id }) });
    setDeletingId(null); fetchData();
  }

  async function handleManualPayment(memberId: string, month: string, amount: number) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'manual_payment', memberId, month, amount }) });
    setEditingPayment(null); setPaymentAmount(''); fetchData();
  }

  async function handleSaveNickname(id: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_member', id, nickname: nicknameValue }) });
    setEditingNickname(null); fetchData();
  }

  async function handleChangeCommunity(id: string, community: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_member', id, community }) });
    setEditingCommunity(null); fetchData();
  }

  async function handleLinkStripe(sub: any, memberId: string) {
    if (!memberId) return;
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link_stripe', memberId, customerId: sub.customerId, customerEmail: sub.customerEmail, subscriptionId: sub.subscriptionId, amount: sub.amount, interval: sub.interval }) });
    setLinkingStripe(null); setSelectedMemberForStripeLink(''); fetchData();
  }

  async function handleCreateFromStripe(sub: any, community: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_from_stripe', name: sub.customerName, email: sub.customerEmail, community, stripeCustomerId: sub.customerId }) });
    setCreatingFromStripe(null); setNewMemberCommunity('San Pablo'); fetchData();
  }

  async function handleLinkBank(txId: string, memberId: string, concept: string, createRule: boolean) {
    if (!memberId) return;
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link_bank_tx', txId, memberId }) });
    if (createRule && concept) {
      await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_bank_rule', pattern: concept.toLowerCase().trim(), memberId }) });
    }
    setLinkingBank(null); setSelectedMemberForBankLink(''); setCreateBankRuleChecked(true); fetchData();
  }

  async function handleDeleteBankRule(ruleId: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_bank_rule', ruleId }) });
    fetchData();
  }

  async function handleUnlinkStripe(memberId: string) {
    await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink_stripe', memberId }) });
    fetchData();
  }

  const allMonths = useMemo(() => getMonthsFrom2023(), []);
  const currentMonth = useMemo(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }, []);
  const prevMonth = useMemo(() => { const prev = new Date(); prev.setMonth(prev.getMonth() - 1); return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`; }, []);
  const rangeMonths = useMemo(() => getMonthsInRange(selectedRange.startDate, selectedRange.endDate), [selectedRange]);

  const visibleMonths = useMemo(() => {
    const start = Math.max(0, allMonths.length - monthsToShow - monthOffset);
    return allMonths.slice(start, start + monthsToShow);
  }, [allMonths, monthsToShow, monthOffset]);

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (filterCommunity !== 'all' && m.community !== filterCommunity) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return m.name.toLowerCase().includes(s) || (m.nickname || '').toLowerCase().includes(s) || (m.email || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [members, filterCommunity, searchTerm]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aPays = a.payments?.[selectedMonth] ? 1 : 0;
      const bPays = b.payments?.[selectedMonth] ? 1 : 0;
      if (aPays !== bPays) return bPays - aPays;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filtered, selectedMonth]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const c of communities) groups[c] = [];
    for (const m of sortedFiltered) {
      const c = m.community || 'Sin comunidad';
      if (!groups[c]) groups[c] = [];
      const totalInRange = rangeMonths.reduce((s: number, month: string) => s + (m.payments?.[month]?.amount || 0), 0);
      const avgMonthly = rangeMonths.length > 0 ? totalInRange / rangeMonths.length : 0;
      groups[c].push({ ...m, avgMonthly });
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a: any, b: any) => b.avgMonthly - a.avgMonthly);
    }
    return groups;
  }, [sortedFiltered, communities, rangeMonths]);

  function displayName(m: any) { return m.nickname || m.name; }

  const kpiData = useMemo(() => {
    const payingMembers = members.filter(m => m.payments?.[selectedMonth]);
    const totalForMonth = payingMembers.reduce((s: number, m: any) => s + (m.payments?.[selectedMonth]?.amount || 0), 0);
    const fromStripe = payingMembers.filter(m => m.payments?.[selectedMonth]?.source === 'stripe').length;
    const fromBanco = payingMembers.filter(m => m.payments?.[selectedMonth]?.source === 'banco').length;
    const rate = members.length > 0 ? Math.round((payingMembers.length / members.length) * 100) : 0;
    return { totalForMonth, fromStripe, fromBanco, payingCount: payingMembers.length, totalMembers: members.length, rate };
  }, [members, selectedMonth]);

  // Pertenencia: green = isActive (pays diezmos), red = not
  const pertenenciaGrouped = useMemo(() => {
    return COMUNIDADES_ORDER.map(comunidad => {
      const list = members.filter(m => m.community === comunidad);
      const paying = list.filter(m => m.isActive);
      const notPaying = list.filter(m => !m.isActive);
      const pct = list.length > 0 ? Math.round((paying.length / list.length) * 100) : 0;
      return { comunidad, list, paying, notPaying, pct };
    }).filter(g => g.list.length > 0);
  }, [members]);

  const COMMUNITY_STYLES: Record<string, { headerBg: string; text: string; bar: string }> = {
    'San Martín':    { headerBg: 'bg-orange-100', text: 'text-orange-600', bar: 'bg-orange-500' },
    'San Ignacio':   { headerBg: 'bg-green-100',  text: 'text-green-600',  bar: 'bg-green-500'  },
    'San Pablo':     { headerBg: 'bg-blue-100',   text: 'text-blue-600',   bar: 'bg-blue-500'   },
    'Colaboradores': { headerBg: 'bg-purple-100', text: 'text-purple-600', bar: 'bg-purple-500' },
  };

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Users size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Miembros</h1>
              <p className="text-sm text-gray-500">Seguimiento de comunidad</p>
            </div>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm">
            <UserPlus size={16} /> Añadir miembro
          </button>
        </div>

        {/* Birthday widget */}
        {birthdaysThisMonth.length > 0 && (
          <Card className="!p-4 border-l-4 border-l-amber-400 bg-amber-50">
            <div className="flex items-center gap-2 mb-3">
              <Cake size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-amber-800">Cumpleaños este mes ({birthdaysThisMonth.length})</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {birthdaysThisMonth.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                  <Cake size={11} className="text-amber-400" />
                  {b.name}
                  <span className="text-amber-400 font-normal">{b.day} {MONTHS_SHORT[b.month - 1]}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* View tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {VIEW_TABS.map(({ key, label, icon: Icon, desc }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${view === key ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${view === key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Icon size={18} />
              </div>
              <div className="text-left min-w-0">
                <p className={`text-sm font-semibold ${view === key ? 'text-violet-700' : 'text-gray-700'}`}>{label}</p>
                <p className="text-[11px] text-gray-400 hidden sm:block">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-4 border-l-4 border-l-green-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Ingresos · {view === 'grid' ? 'Período' : formatMonth(selectedMonth)}</p>
            </div>
            <p className="text-xl font-bold text-green-600">
              {view === 'grid' ? formatCurrency(summary?.totalMensual || 0) : formatCurrency(kpiData.totalForMonth)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-blue-500 font-medium">{view === 'grid' ? (summary?.fromStripe || 0) : kpiData.fromStripe} Stripe</span>
              <span className="text-gray-300">·</span>
              <span className="text-[10px] text-amber-500 font-medium">{view === 'grid' ? (summary?.fromBanco || 0) : kpiData.fromBanco} Banco</span>
            </div>
          </Card>
          <Card className="!p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={14} className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Participación · {view === 'grid' ? 'Período' : formatMonth(selectedMonth)}</p>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-xl font-bold text-blue-600">
                {view === 'grid' ? (summary?.totalMembers > 0 ? Math.round((summary.totalPaying / summary.totalMembers) * 100) : 0) : kpiData.rate}%
              </p>
              <p className="text-xs text-gray-400 mb-0.5">
                {view === 'grid' ? `${summary?.totalPaying || 0}/${summary?.totalMembers || 0}` : `${kpiData.payingCount}/${kpiData.totalMembers}`}
              </p>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${view === 'grid' ? (summary?.totalMembers > 0 ? Math.round((summary.totalPaying / summary.totalMembers) * 100) : 0) : kpiData.rate}%` }} />
            </div>
          </Card>
        </div>

        {/* Add member form */}
        {showAddForm && (
          <Card className="border-2 border-violet-200 bg-violet-50/30">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Añadir Miembro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre completo" className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)}
                placeholder="Apodo (opcional)" className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <select value={newCommunity} onChange={e => setNewCommunity(e.target.value)}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500">
                {communities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="Email (opcional)" className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <button onClick={handleAdd} disabled={!newName.trim()}
                className="px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
                Guardar
              </button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar miembro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCommunity('all')}
              className={`px-3 py-2 text-sm font-medium rounded-xl transition-colors ${filterCommunity === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              Todas
            </button>
            {communities.map(c => (
              <button key={c} onClick={() => setFilterCommunity(c)}
                className={`px-3 py-2 text-sm font-medium rounded-xl transition-colors ${filterCommunity === c ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Month selector for list view */}
        {view === 'list' && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { const [y, m] = selectedMonth.split('-').map(Number); const prev = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`; if (prev >= '2023-01') setSelectedMonth(prev); }}
              className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{formatMonthFull(selectedMonth)}</span>
            <button onClick={() => { const [y, m] = selectedMonth.split('-').map(Number); const next = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`; if (next <= currentMonth) setSelectedMonth(next); }}
              disabled={selectedMonth >= currentMonth}
              className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-violet-600" size={28} />
            <span className="text-gray-500 text-sm">Cargando miembros...</span>
          </div>
        ) : view === 'pertenencia' ? (
          /* ══ PERTENENCIA ══ */
          <div className="space-y-4">
            <p className="text-xs text-gray-400 text-right">
              Verde = da diezmo · Rojo = no da diezmo
            </p>
            {pertenenciaGrouped.map(({ comunidad, list, paying, notPaying, pct }) => {
              const style = COMMUNITY_STYLES[comunidad] || COMMUNITY_STYLES['Colaboradores'];
              return (
                <Card key={comunidad} className="!p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.headerBg}`}>
                        <Church size={15} className={style.text} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{comunidad}</h3>
                        <p className="text-[10px] text-gray-400">{list.length} miembros</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {paying.length}/{list.length}
                      </p>
                      <p className="text-[10px] text-gray-400">{pct}% dan diezmo</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {paying.map(m => {
                      const hasBday = birthdaysThisMonth.some(b => b.name === (m.nickname || m.name) || b.name === m.name);
                      return (
                        <span key={m.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 ${hasBday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                          {hasBday && <Cake size={10} className="text-amber-400 flex-shrink-0" />}
                          {displayName(m)}
                        </span>
                      );
                    })}
                    {notPaying.map(m => {
                      const hasBday = birthdaysThisMonth.some(b => b.name === (m.nickname || m.name) || b.name === m.name);
                      return (
                        <span key={m.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 ${hasBday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                          {hasBday && <Cake size={10} className="text-amber-400 flex-shrink-0" />}
                          {displayName(m)}
                        </span>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : view === 'list' ? (
          /* ══ TABLA DE MIEMBROS ══ */
          <div className="space-y-4">
            <Card>
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Miembro</th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Comunidad</th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Vinculación</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Media/mes</th>
                      <th className="text-right text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">{formatMonth(selectedMonth)}</th>
                      <th className="text-center text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3 w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiltered.map(m => {
                      const payment = m.payments?.[selectedMonth];
                      const memberBankRules = bankRules.filter((r: any) => r.member_id === m.id);
                      const totalInRange = rangeMonths.reduce((s: number, month: string) => s + (m.payments?.[month]?.amount || 0), 0);
                      const avgMonthly = rangeMonths.length > 0 ? totalInRange / rangeMonths.length : 0;
                      return (
                        <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!m.isActive ? 'opacity-50' : ''}`}>
                          <td className="px-4 sm:px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <span className={`text-xs font-bold ${m.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                  {displayName(m).split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{displayName(m)}</p>
                                {m.nickname && <p className="text-xs text-gray-400">{m.name}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3">
                            {editingCommunity === m.id ? (
                              <select defaultValue={m.community} onChange={e => handleChangeCommunity(m.id, e.target.value)} onBlur={() => setEditingCommunity(null)} autoFocus
                                className="text-xs font-medium px-2 py-1 rounded-lg border border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                                {communities.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <button onClick={() => setEditingCommunity(m.id)}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all ${
                                  m.community === 'San Pablo' ? 'bg-blue-50 text-blue-700' :
                                  m.community === 'San Ignacio' ? 'bg-green-50 text-green-700' :
                                  m.community === 'Colaboradores' ? 'bg-purple-50 text-purple-700' :
                                  'bg-orange-50 text-orange-700'
                                }`} title="Clic para cambiar comunidad">
                                {m.community}
                              </button>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {m.stripeCustomerId && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 group">
                                  <CreditCard size={9} />
                                  {m.stripeCustomerEmail ? m.stripeCustomerEmail.split('@')[0] : 'Stripe'}
                                  {m.stripeSubscriptionId && ` · ${formatCurrency(m.stripeAmount || 0)}/mes`}
                                  <button onClick={() => handleUnlinkStripe(m.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ml-0.5 text-red-400 hover:text-red-600 transition-all">
                                    <X size={8} />
                                  </button>
                                </span>
                              )}
                              {memberBankRules.map((rule: any) => (
                                <span key={rule.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100 group">
                                  <Landmark size={9} />
                                  &quot;{rule.pattern.length > 20 ? rule.pattern.substring(0, 20) + '…' : rule.pattern}&quot;
                                  <button onClick={() => handleDeleteBankRule(rule.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ml-0.5 text-red-400 hover:text-red-600 transition-all">
                                    <X size={8} />
                                  </button>
                                </span>
                              ))}
                              {!m.stripeCustomerId && memberBankRules.length === 0 && <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-right">
                            {avgMonthly > 0 ? <span className="text-xs font-medium text-violet-600">{formatCurrency(avgMonthly)}</span> : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-right">
                            {payment ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  payment.source === 'stripe' ? 'bg-blue-50 text-blue-600' :
                                  payment.source === 'banco' ? 'bg-amber-50 text-amber-600' :
                                  'bg-violet-50 text-violet-600'}`}>
                                  {payment.source === 'stripe' ? <CreditCard size={9} /> : payment.source === 'banco' ? <Landmark size={9} /> : <Edit3 size={9} />}
                                </span>
                                <span className="text-sm font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                              </div>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 sm:px-6 py-3">
                            {deletingId === m.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
                                <button onClick={() => setDeletingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setEditingNickname(m.id); setNicknameValue(m.nickname || ''); }}
                                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Editar apodo">
                                  <Edit3 size={14} />
                                </button>
                                <button onClick={() => setDeletingId(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {editingNickname && (
                <div className="mt-3 p-3 bg-violet-50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="text-sm text-violet-700 font-medium">Apodo:</span>
                  <input type="text" value={nicknameValue} onChange={e => setNicknameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(editingNickname); if (e.key === 'Escape') setEditingNickname(null); }}
                    placeholder="Ej: Stef, Manu..." autoFocus
                    className="flex-1 w-full sm:w-auto px-3 py-1.5 text-sm border border-violet-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveNickname(editingNickname)} className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700">Guardar</button>
                    <button onClick={() => setEditingNickname(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>
                </div>
              )}
            </Card>

            {/* Stripe sin vincular */}
            {unmatchedStripe.length > 0 && (
              <Card className="border-2 border-blue-200 bg-blue-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Unlink size={16} className="text-blue-600" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-800">Stripe sin vincular ({unmatchedStripe.length})</h3>
                    <p className="text-[11px] text-blue-500">Suscriptores activos sin asignar a ningún miembro</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {unmatchedStripe.map((sub: any) => (
                    <div key={sub.subscriptionId} className="p-3 bg-white rounded-xl border border-blue-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><CreditCard size={14} className="text-blue-500" /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{sub.customerName}</p>
                            <p className="text-xs text-gray-500">{sub.customerEmail} · {formatCurrency(sub.amount)}/mes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {linkingStripe === sub.subscriptionId ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <select value={selectedMemberForStripeLink} onChange={e => setSelectedMemberForStripeLink(e.target.value)}
                                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Seleccionar miembro...</option>
                                {members.map((m: any) => <option key={m.id} value={m.id}>{displayName(m)} ({m.community})</option>)}
                              </select>
                              <div className="flex gap-1">
                                <button onClick={() => handleLinkStripe(sub, selectedMemberForStripeLink)} disabled={!selectedMemberForStripeLink}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                  <Link2 size={12} className="inline mr-1" />Vincular
                                </button>
                                <button onClick={() => { setLinkingStripe(null); setSelectedMemberForStripeLink(''); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={14} /></button>
                              </div>
                            </div>
                          ) : creatingFromStripe?.subscriptionId === sub.subscriptionId ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <select value={newMemberCommunity} onChange={e => setNewMemberCommunity(e.target.value)}
                                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {communities.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <div className="flex gap-1">
                                <button onClick={() => handleCreateFromStripe(sub, newMemberCommunity)}
                                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">
                                  <UserPlus size={12} className="inline mr-1" />Crear
                                </button>
                                <button onClick={() => setCreatingFromStripe(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={14} /></button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => { setLinkingStripe(sub.subscriptionId); setSelectedMemberForStripeLink(''); }}
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                <Link2 size={12} className="inline mr-1" />Vincular
                              </button>
                              <button onClick={() => setCreatingFromStripe(sub)}
                                className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                                <UserPlus size={12} className="inline mr-1" />Crear nuevo
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Banco sin vincular */}
            {unmatchedBank.length > 0 && (
              <Card className="border-2 border-amber-200 bg-amber-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Unlink size={16} className="text-amber-600" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-800">Transferencias sin vincular ({unmatchedBank.length})</h3>
                    <p className="text-[11px] text-amber-500">Transferencias bancarias marcadas como diezmo sin miembro asignado</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {unmatchedBank.map((tx: any) => (
                    <div key={tx.id} className="p-3 bg-white rounded-xl border border-amber-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><Landmark size={14} className="text-amber-500" /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{tx.concept}</p>
                            <p className="text-xs text-gray-500">{tx.date} · {formatCurrency(tx.amount)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {linkingBank === tx.id ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <select value={selectedMemberForBankLink} onChange={e => setSelectedMemberForBankLink(e.target.value)}
                                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                                <option value="">Seleccionar miembro...</option>
                                {members.map((m: any) => <option key={m.id} value={m.id}>{displayName(m)} ({m.community})</option>)}
                              </select>
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={createBankRuleChecked} onChange={e => setCreateBankRuleChecked(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                Crear regla
                              </label>
                              <div className="flex gap-1">
                                <button onClick={() => handleLinkBank(tx.id, selectedMemberForBankLink, tx.concept, createBankRuleChecked)}
                                  disabled={!selectedMemberForBankLink}
                                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
                                  <Link2 size={12} className="inline mr-1" />Vincular
                                </button>
                                <button onClick={() => { setLinkingBank(null); setSelectedMemberForBankLink(''); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={14} /></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setLinkingBank(tx.id); setSelectedMemberForBankLink(''); setCreateBankRuleChecked(true); }}
                              className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                              <Link2 size={12} className="inline mr-1" />Vincular a miembro
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {unmatchedStripe.length === 0 && unmatchedBank.length === 0 && !loading && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                <Check size={16} className="text-green-600" />
                <p className="text-sm text-green-700 font-medium">Todas las suscripciones Stripe y transferencias bancarias están vinculadas</p>
              </div>
            )}
          </div>
        ) : (
          /* ══ CUADRÍCULA ══ */
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setMonthOffset(o => o + monthsToShow)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 font-medium px-2">
                  {formatMonth(visibleMonths[0])} — {formatMonth(visibleMonths[visibleMonths.length - 1])}
                </span>
                <button onClick={() => setMonthOffset(o => Math.max(0, o - monthsToShow))} disabled={monthOffset === 0} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[3, 6, 12].map(n => (
                  <button key={n} onClick={() => { setMonthsToShow(n); setMonthOffset(0); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${monthsToShow === n ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                    {n} meses
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full" style={{ minWidth: `${160 + visibleMonths.length * 52}px` }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2.5 sticky left-0 bg-white z-10 min-w-[150px]">Miembro</th>
                    {visibleMonths.map(m => (
                      <th key={m} className={`text-center text-[10px] font-semibold px-0.5 py-2.5 min-w-[48px] ${m === currentMonth ? 'text-violet-600 bg-violet-50/50' : 'text-gray-500'}`}>
                        {formatMonth(m)}
                        {m === currentMonth && <div className="w-1 h-1 rounded-full bg-violet-500 mx-auto mt-0.5" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([community, mems]) => {
                    if (mems.length === 0) return null;
                    const communityTotal = visibleMonths.map(month => (mems as any[]).reduce((s: number, m: any) => s + (m.payments?.[month]?.amount || 0), 0));
                    const payingCount = (mems as any[]).filter((m: any) => m.payments?.[currentMonth]).length;
                    const commBg = community === 'San Pablo' ? 'bg-blue-50/50' : community === 'San Ignacio' ? 'bg-green-50/50' : community === 'Colaboradores' ? 'bg-purple-50/50' : 'bg-orange-50/50';
                    const commStickyBg = community === 'San Pablo' ? 'bg-blue-50/80' : community === 'San Ignacio' ? 'bg-green-50/80' : community === 'Colaboradores' ? 'bg-purple-50/80' : 'bg-orange-50/80';
                    const commText = community === 'San Pablo' ? 'text-blue-700' : community === 'San Ignacio' ? 'text-green-700' : community === 'Colaboradores' ? 'text-purple-700' : 'text-orange-700';
                    return (
                      <React.Fragment key={community}>
                        <tr className={commBg}>
                          <td className={`px-3 py-2 sticky left-0 z-10 ${commStickyBg}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${commText}`}>{community}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{payingCount}/{(mems as any[]).length}</span>
                            </div>
                          </td>
                          {communityTotal.map((t, i) => (
                            <td key={i} className="text-center py-2">
                              <span className={`text-[10px] font-bold ${t > 0 ? 'text-violet-600' : 'text-gray-300'}`}>{t > 0 ? `${Math.round(t)}€` : '—'}</span>
                            </td>
                          ))}
                        </tr>
                        {(mems as any[]).map((m: any) => (
                          <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 group ${!m.isActive ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5 sticky left-0 bg-white z-10 group-hover:bg-gray-50/50">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${m.isActive ? 'bg-green-100' : 'bg-gray-50'}`}>
                                  <span className={`text-[9px] font-bold ${m.isActive ? 'text-green-600' : 'text-gray-400'}`}>{displayName(m).substring(0, 2).toUpperCase()}</span>
                                </div>
                                <span className={`text-xs truncate max-w-[100px] ${m.isActive ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{displayName(m)}</span>
                                {m.stripeSubscriptionId && <CreditCard size={9} className="text-blue-400 flex-shrink-0" />}
                              </div>
                            </td>
                            {visibleMonths.map(month => {
                              const p = m.payments?.[month];
                              const isEditing = editingPayment?.memberId === m.id && editingPayment?.month === month;
                              return (
                                <td key={month} className={`text-center py-1 px-0.5 ${month === currentMonth ? 'bg-violet-50/30' : ''}`}>
                                  {isEditing ? (
                                    <div className="flex items-center gap-0.5 justify-center">
                                      <input type="number" autoFocus value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0); if (e.key === 'Escape') setEditingPayment(null); }}
                                        className="w-12 text-[10px] text-center border border-violet-300 rounded-lg px-1 py-0.5" />
                                      <button onClick={() => handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0)} className="text-green-600"><Check size={10} /></button>
                                    </div>
                                  ) : p ? (
                                    <button onClick={() => { setEditingPayment({ memberId: m.id, month }); setPaymentAmount(String(p.amount)); }}
                                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg cursor-pointer transition-colors ${p.source === 'stripe' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : p.source === 'banco' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
                                      {p.amount}€
                                    </button>
                                  ) : (
                                    <button onClick={() => { setEditingPayment({ memberId: m.id, month }); setPaymentAmount(''); }}
                                      className="w-6 h-6 mx-auto text-[10px] text-gray-200 hover:text-violet-500 hover:bg-violet-50 rounded-lg cursor-pointer flex items-center justify-center transition-colors">
                                      <Plus size={10} />
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-5 mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded-md" /><span className="text-xs text-gray-500">Stripe</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-amber-50 border border-amber-200 rounded-md" /><span className="text-xs text-gray-500">Banco</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-violet-50 border border-violet-200 rounded-md" /><span className="text-xs text-gray-500">Manual</span></div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
