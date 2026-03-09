'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Church, UserPlus, Loader2, Search, Trash2, Edit3, Check, X,
  ChevronLeft, ChevronRight, CreditCard, Landmark,
  TrendingUp, TrendingDown, Wallet, AlertTriangle, ChevronDown, ChevronUp,
  Users, LayoutGrid, Table2, PieChart, Plus, Minus,
} from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'summary';

const VIEW_TABS: { key: ViewMode; label: string; icon: any; desc: string }[] = [
  { key: 'grid', label: 'Cuadrícula', icon: LayoutGrid, desc: 'Matriz mensual' },
  { key: 'list', label: 'Miembros', icon: Table2, desc: 'Tabla de miembros' },
  { key: 'summary', label: 'Resumen', icon: PieChart, desc: 'Por comunidad' },
];

function getMonthsFrom2023(): string[] {
  const months: string[] = [];
  const start = new Date(2023, 0, 1);
  const now = new Date();
  const d = new Date(start);
  while (d <= now) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months.length > 0 ? months : [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
}

function formatMonth(key: string) {
  const [y, m] = key.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

const TAG_ICONS: Record<string, string> = {
  'Música': '🎵',
  'Misa/Tabor': '⛪',
  'Retiros': '🏔️',
  'Donativo': '🎁',
  'BAC': '🏦',
  'Diezmo (gasto)': '📤',
};

export default function DiezmosPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [members, setMembers] = useState<any[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [communityStats, setCommunityStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [opExpenses, setOpExpenses] = useState<any>(null);
  const [stripeDebug, setStripeDebug] = useState<any>(null);
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
  const [showStripeDebug, setShowStripeDebug] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  useEffect(() => { fetchDiezmos(); }, [selectedRange]);

  async function fetchDiezmos() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: selectedRange.startDate.toISOString(),
        end: selectedRange.endDate.toISOString(),
      });
      const res = await fetch(`/api/diezmos?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setCommunities(data.communities || []);
      setCommunityStats(data.communityStats || []);
      setSummary(data.summary || null);
      setOpExpenses(data.operationalExpenses || null);
      setStripeDebug(data.stripeDebug || null);
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
    fetchDiezmos();
  }

  async function handleDelete(id: string) {
    await fetch('/api/diezmos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_member', id }),
    });
    setDeletingId(null);
    fetchDiezmos();
  }

  async function handleManualPayment(memberId: string, month: string, amount: number) {
    await fetch('/api/diezmos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'manual_payment', memberId, month, amount }),
    });
    setEditingPayment(null); setPaymentAmount('');
    fetchDiezmos();
  }

  async function handleSaveNickname(id: string) {
    await fetch('/api/diezmos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_member', id, nickname: nicknameValue }),
    });
    setEditingNickname(null);
    fetchDiezmos();
  }

  const allMonths = useMemo(() => getMonthsFrom2023(), []);
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

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
      const aPays = a.payments?.[currentMonth] ? 1 : 0;
      const bPays = b.payments?.[currentMonth] ? 1 : 0;
      if (aPays !== bPays) return bPays - aPays;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filtered, currentMonth]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const c of communities) groups[c] = [];
    for (const m of sortedFiltered) {
      const c = m.community || 'Sin comunidad';
      if (!groups[c]) groups[c] = [];
      groups[c].push(m);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a: any, b: any) => {
        const aPays = a.payments?.[currentMonth] ? 1 : 0;
        const bPays = b.payments?.[currentMonth] ? 1 : 0;
        if (aPays !== bPays) return bPays - aPays;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return groups;
  }, [sortedFiltered, communities, currentMonth]);

  function displayName(m: any) {
    return m.nickname || m.name;
  }

  // Participation rate
  const participationRate = summary?.totalMembers > 0
    ? Math.round((summary.totalPaying / summary.totalMembers) * 100)
    : 0;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header + View Selector */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Church size={20} className="text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Diezmos</h1>
                <p className="text-sm text-gray-500">Seguimiento por comunidad · Stripe + Banco</p>
              </div>
            </div>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm">
              <UserPlus size={16} /> Añadir miembro
            </button>
          </div>

          {/* View Tabs - grandes y visuales */}
          <div className="grid grid-cols-3 gap-2">
            {VIEW_TABS.map(({ key, label, icon: Icon, desc }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                  view === key
                    ? 'border-violet-500 bg-violet-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  view === key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="text-left min-w-0">
                  <p className={`text-sm font-semibold ${view === key ? 'text-violet-700' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-[11px] text-gray-400 hidden sm:block">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* KPIs - Diseño más limpio */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="!p-4 border-l-4 border-l-green-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Ingresos Diezmo</p>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(opExpenses?.totalIncome || 0)}</p>
          </Card>
          <Card className="!p-4 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown size={14} className="text-red-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Gastos Operativos</p>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(opExpenses?.totalExpenses || 0)}</p>
          </Card>
          <Card className="!p-4 border-l-4 border-l-violet-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Wallet size={14} className="text-violet-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Balance Neto</p>
            </div>
            <p className={`text-xl font-bold ${(opExpenses?.net || 0) >= 0 ? 'text-violet-600' : 'text-red-600'}`}>
              {formatCurrency(opExpenses?.net || 0)}
            </p>
          </Card>
          <Card className="!p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={14} className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Participación</p>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-xl font-bold text-blue-600">{participationRate}%</p>
              <p className="text-xs text-gray-400 mb-0.5">{summary?.totalPaying || 0}/{summary?.totalMembers || 0}</p>
            </div>
            {/* Mini progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${participationRate}%` }} />
            </div>
          </Card>
        </div>

        {/* Stripe + Banco breakdown compacto */}
        <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <CreditCard size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Stripe</p>
              <p className="text-sm font-bold text-blue-600">{formatCurrency(summary?.totalStripeCollected || 0)}</p>
            </div>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Landmark size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Banco</p>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(summary?.totalMensual || 0)}</p>
            </div>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500">Este mes</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 font-medium">{summary?.fromStripe || 0} Stripe</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-amber-500 font-medium">{summary?.fromBanco || 0} Banco</span>
            </div>
          </div>
        </div>

        {/* Gastos Operativos Breakdown */}
        {opExpenses && opExpenses.byTag && opExpenses.byTag.length > 0 && (
          <Card>
            <button onClick={() => setShowExpenseDetail(!showExpenseDetail)}
              className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrendingDown size={16} className="text-red-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Gastos Operativos</h3>
              </div>
              {showExpenseDetail ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
              {opExpenses.byTag.map((t: any) => (
                <div key={t.tag} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-lg">{TAG_ICONS[t.tag] || '💰'}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 truncate">{t.tag}</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(t.amount)}</p>
                  </div>
                </div>
              ))}
            </div>

            {showExpenseDetail && opExpenses.monthlyChart && (
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Evolución Mensual</h4>
                <div className="space-y-2">
                  {opExpenses.monthlyChart.map((m: any) => {
                    const maxVal = Math.max(...opExpenses.monthlyChart.map((x: any) => Math.max(x.income, x.expenses)));
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-medium w-16">{formatMonth(m.month)}</span>
                        <div className="flex-1 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="h-3 bg-green-400 rounded-full transition-all" style={{ width: `${maxVal > 0 ? (m.income / maxVal) * 100 : 0}%` }} />
                            <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">{formatCurrency(m.income)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 bg-red-400 rounded-full transition-all" style={{ width: `${maxVal > 0 ? (m.expenses / maxVal) * 100 : 0}%` }} />
                            <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">{formatCurrency(m.expenses)}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-bold w-16 text-right ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.net >= 0 ? '+' : ''}{formatCurrency(m.net)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {opExpenses.recentExpenses && opExpenses.recentExpenses.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Últimos Gastos</h4>
                    <div className="overflow-x-auto -mx-4 sm:-mx-6">
                      <table className="w-full min-w-[400px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-[10px] font-medium text-gray-500 px-4 py-2">Mes</th>
                            <th className="text-left text-[10px] font-medium text-gray-500 px-4 py-2">Categoría</th>
                            <th className="text-left text-[10px] font-medium text-gray-500 px-4 py-2">Concepto</th>
                            <th className="text-right text-[10px] font-medium text-gray-500 px-4 py-2">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opExpenses.recentExpenses.map((e: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="px-4 py-1.5 text-xs text-gray-600">{formatMonth(e.month)}</td>
                              <td className="px-4 py-1.5 text-xs">
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{TAG_ICONS[e.tag] || ''} {e.tag}</span>
                              </td>
                              <td className="px-4 py-1.5 text-xs text-gray-600 max-w-[200px] truncate">{e.concept}</td>
                              <td className="px-4 py-1.5 text-xs text-right font-medium text-red-600">{formatCurrency(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Stripe Debug (collapsible) */}
        {stripeDebug && (
          <button onClick={() => setShowStripeDebug(!showStripeDebug)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <AlertTriangle size={12} />
            <span>Debug Stripe: {stripeDebug.totalSubsFetched} subs, {stripeDebug.matchedToMembers} vinculadas</span>
            {showStripeDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {showStripeDebug && stripeDebug && (
          <Card className="bg-yellow-50 border-yellow-200">
            <h3 className="text-sm font-bold text-yellow-800 mb-2">Debug Stripe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-yellow-700 mb-1">Suscripciones NO vinculadas ({stripeDebug.unmatchedSubs?.length || 0}):</p>
                {stripeDebug.unmatchedSubs?.length > 0 ? (
                  <ul className="space-y-1">
                    {stripeDebug.unmatchedSubs.map((s: any, i: number) => (
                      <li key={i} className="p-1.5 bg-white rounded border border-yellow-200">
                        <span className="font-medium">{s.name}</span> · {s.email} · {formatCurrency(s.amount)} · {s.product || 'Sin producto'}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-yellow-600">Todas vinculadas</p>}
              </div>
              <div>
                <p className="font-semibold text-yellow-700 mb-1">Muestra de Facturas ({stripeDebug.totalInvoicesFetched}):</p>
                {stripeDebug.invoicesSample?.length > 0 ? (
                  <ul className="space-y-1">
                    {stripeDebug.invoicesSample.map((i: any, idx: number) => (
                      <li key={idx} className="p-1.5 bg-white rounded border border-yellow-200">
                        <span className="font-medium">{i.name}</span> · {formatCurrency(i.amount)} · {i.period ? formatMonth(i.period.substring(0, 7)) : 'N/A'}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-yellow-600">Sin facturas recientes</p>}
              </div>
            </div>
          </Card>
        )}

        {/* Add member form */}
        {showAddForm && (
          <Card className="border-2 border-violet-200 bg-violet-50/30">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Añadir Miembro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre completo" className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)}
                placeholder="Apodo (ej: Stef)" className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
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

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-violet-600" size={28} />
            <span className="text-gray-500 text-sm">Cargando diezmos...</span>
          </div>
        ) : view === 'summary' ? (
          /* ===================== SUMMARY VIEW ===================== */
          <div className="space-y-4">
            {communityStats.map((cs: any) => {
              const nonPaying = members.filter(m => m.community === cs.community && !m.payments?.[currentMonth]);
              const paying = members.filter(m => m.community === cs.community && m.payments?.[currentMonth]);
              const pctPaying = cs.totalMembers > 0 ? Math.round((cs.payingMembers / cs.totalMembers) * 100) : 0;
              return (
                <Card key={cs.community} className="!p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        cs.community === 'San Pablo' ? 'bg-blue-100' :
                        cs.community === 'San Ignacio' ? 'bg-green-100' : 'bg-orange-100'
                      }`}>
                        <Church size={18} className={
                          cs.community === 'San Pablo' ? 'text-blue-600' :
                          cs.community === 'San Ignacio' ? 'text-green-600' : 'text-orange-600'
                        } />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{cs.community}</h3>
                        <p className="text-xs text-gray-400">{cs.totalMembers} miembros</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-violet-600">{formatCurrency(cs.monthlyTotal)}</p>
                      <p className="text-xs text-gray-400">este mes</p>
                    </div>
                  </div>

                  {/* Progress bar con porcentaje */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${
                        pctPaying >= 80 ? 'bg-green-500' : pctPaying >= 50 ? 'bg-amber-500' : 'bg-red-400'
                      }`} style={{ width: `${Math.max(pctPaying, 4)}%` }} />
                    </div>
                    <span className={`text-sm font-bold min-w-[40px] text-right ${
                      pctPaying >= 80 ? 'text-green-600' : pctPaying >= 50 ? 'text-amber-600' : 'text-red-500'
                    }`}>{pctPaying}%</span>
                  </div>

                  {/* Quién ha dado / quién no */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paying.length > 0 && (
                      <div className="bg-green-50/50 rounded-xl p-3">
                        <p className="text-[10px] text-green-600 font-semibold uppercase mb-2 flex items-center gap-1">
                          <Check size={10} /> Han dado ({paying.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {paying.map((m: any) => (
                            <span key={m.id} className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                              {displayName(m)} · {formatCurrency(m.payments[currentMonth]?.amount || 0)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {nonPaying.length > 0 && (
                      <div className="bg-red-50/50 rounded-xl p-3">
                        <p className="text-[10px] text-red-600 font-semibold uppercase mb-2 flex items-center gap-1">
                          <X size={10} /> No han dado ({nonPaying.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {nonPaying.map((m: any) => (
                            <span key={m.id} className="text-[11px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                              {displayName(m)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Total Card */}
            <Card className="bg-gradient-to-r from-violet-500 to-violet-600 text-white !p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet-200">Total Comunidad — Este Mes</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(summary?.totalMensual || 0)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-violet-200 flex items-center gap-1">
                      <CreditCard size={12} /> Stripe: {formatCurrency(summary?.totalStripeCollected || 0)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold">{participationRate}%</p>
                  <p className="text-xs text-violet-200">{summary?.totalPaying || 0} de {summary?.totalMembers || 0} dando</p>
                </div>
              </div>
            </Card>
          </div>
        ) : view === 'list' ? (
          /* ===================== LIST VIEW ===================== */
          <Card>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Miembro</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Comunidad</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Fuente</th>
                    <th className="text-right text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3">Este Mes</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-4 sm:px-6 py-3 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map(m => {
                    const payment = m.payments?.[currentMonth];
                    return (
                      <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!payment ? 'opacity-50' : ''}`}>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${payment ? 'bg-green-100' : 'bg-gray-100'}`}>
                              <span className={`text-xs font-bold ${payment ? 'text-green-600' : 'text-gray-400'}`}>
                                {displayName(m).split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{displayName(m)}</p>
                              {m.nickname && <p className="text-xs text-gray-400">{m.name}</p>}
                              {m.stripeSubscriptionId && (
                                <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5">
                                  <CreditCard size={9} /> Stripe activo
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            m.community === 'San Pablo' ? 'bg-blue-50 text-blue-700' :
                            m.community === 'San Ignacio' ? 'bg-green-50 text-green-700' :
                            'bg-orange-50 text-orange-700'
                          }`}>{m.community}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {payment ? (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              payment.source === 'stripe' ? 'bg-blue-50 text-blue-600' :
                              payment.source === 'banco' ? 'bg-amber-50 text-amber-600' :
                              'bg-violet-50 text-violet-600'
                            }`}>
                              {payment.source === 'stripe' ? <CreditCard size={10} /> :
                               payment.source === 'banco' ? <Landmark size={10} /> :
                               <Edit3 size={10} />}
                              {payment.source === 'stripe' ? 'Stripe' :
                               payment.source === 'banco' ? 'Banco' : 'Manual'}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right text-sm font-semibold ${payment ? 'text-green-600' : 'text-gray-300'}`}>
                          {payment ? formatCurrency(payment.amount) : '—'}
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
                              <button onClick={() => setDeletingId(m.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
              <div className="mt-3 p-3 bg-violet-50 rounded-xl flex items-center gap-3">
                <span className="text-sm text-violet-700 font-medium">Apodo:</span>
                <input type="text" value={nicknameValue} onChange={e => setNicknameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(editingNickname); if (e.key === 'Escape') setEditingNickname(null); }}
                  placeholder="Ej: Stef, Manu..." autoFocus
                  className="flex-1 px-3 py-1.5 text-sm border border-violet-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <button onClick={() => handleSaveNickname(editingNickname)} className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700">Guardar</button>
                <button onClick={() => setEditingNickname(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            )}
          </Card>
        ) : (
          /* ===================== GRID VIEW ===================== */
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setMonthOffset(o => o + monthsToShow)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 font-medium px-2">
                  {formatMonth(visibleMonths[0])} — {formatMonth(visibleMonths[visibleMonths.length - 1])}
                </span>
                <button onClick={() => setMonthOffset(o => Math.max(0, o - monthsToShow))} disabled={monthOffset === 0}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors">
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
                      <th key={m} className={`text-center text-[10px] font-semibold px-0.5 py-2.5 min-w-[48px] ${
                        m === currentMonth ? 'text-violet-600 bg-violet-50/50' : 'text-gray-500'
                      }`}>
                        {formatMonth(m)}
                        {m === currentMonth && <div className="w-1 h-1 rounded-full bg-violet-500 mx-auto mt-0.5" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([community, mems]) => {
                    if (mems.length === 0) return null;
                    const communityTotal = visibleMonths.map(month =>
                      mems.reduce((s: number, m: any) => s + (m.payments?.[month]?.amount || 0), 0)
                    );
                    const payingCount = mems.filter((m: any) => m.payments?.[currentMonth]).length;
                    return (
                      <React.Fragment key={community}>
                        <tr className={`${
                          community === 'San Pablo' ? 'bg-blue-50/50' :
                          community === 'San Ignacio' ? 'bg-green-50/50' : 'bg-orange-50/50'
                        }`}>
                          <td className={`px-3 py-2 sticky left-0 z-10 ${
                            community === 'San Pablo' ? 'bg-blue-50/80' :
                            community === 'San Ignacio' ? 'bg-green-50/80' : 'bg-orange-50/80'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${
                                community === 'San Pablo' ? 'text-blue-700' :
                                community === 'San Ignacio' ? 'text-green-700' : 'text-orange-700'
                              }`}>{community}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{payingCount}/{mems.length}</span>
                            </div>
                          </td>
                          {communityTotal.map((t, i) => (
                            <td key={i} className="text-center py-2">
                              <span className={`text-[10px] font-bold ${t > 0 ? 'text-violet-600' : 'text-gray-300'}`}>
                                {t > 0 ? `${Math.round(t)}€` : '—'}
                              </span>
                            </td>
                          ))}
                        </tr>
                        {mems.map((m: any) => {
                          const hasCurrent = !!m.payments?.[currentMonth];
                          return (
                            <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 group ${!hasCurrent ? 'opacity-40' : ''}`}>
                              <td className="px-3 py-1.5 sticky left-0 bg-white z-10 group-hover:bg-gray-50/50">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${hasCurrent ? 'bg-green-100' : 'bg-gray-50'}`}>
                                    <span className={`text-[9px] font-bold ${hasCurrent ? 'text-green-600' : 'text-gray-400'}`}>
                                      {displayName(m).substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className={`text-xs truncate max-w-[100px] ${hasCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {displayName(m)}
                                  </span>
                                  {m.stripeSubscriptionId && <CreditCard size={9} className="text-blue-400 flex-shrink-0" />}
                                </div>
                              </td>
                              {visibleMonths.map(month => {
                                const p = m.payments?.[month];
                                const isEditing = editingPayment?.memberId === m.id && editingPayment?.month === month;
                                const isCurrentMonth = month === currentMonth;
                                return (
                                  <td key={month} className={`text-center py-1 px-0.5 ${isCurrentMonth ? 'bg-violet-50/30' : ''}`}>
                                    {isEditing ? (
                                      <div className="flex items-center gap-0.5 justify-center">
                                        <input type="number" autoFocus value={paymentAmount}
                                          onChange={e => setPaymentAmount(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0);
                                            if (e.key === 'Escape') setEditingPayment(null);
                                          }}
                                          className="w-12 text-[10px] text-center border border-violet-300 rounded-lg px-1 py-0.5" />
                                        <button onClick={() => handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0)}
                                          className="text-green-600"><Check size={10} /></button>
                                      </div>
                                    ) : p ? (
                                      <button onClick={() => { setEditingPayment({ memberId: m.id, month }); setPaymentAmount(String(p.amount)); }}
                                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg cursor-pointer transition-colors ${
                                          p.source === 'stripe' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' :
                                          p.source === 'banco' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                          'bg-violet-50 text-violet-700 hover:bg-violet-100'
                                        }`}>
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
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-5 mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded-md" />
                <span className="text-xs text-gray-500">Stripe</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-50 border border-amber-200 rounded-md" />
                <span className="text-xs text-gray-500">Banco</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-violet-50 border border-violet-200 rounded-md" />
                <span className="text-xs text-gray-500">Manual</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
