'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Church, UserPlus, Loader2, Search, Trash2, Edit3, Check, X,
  Grid3X3, List, BarChart3, ChevronLeft, ChevronRight, CreditCard, Landmark
} from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'summary';

function getMonthsFrom2026(): string[] {
  const months: string[] = [];
  const start = new Date(2026, 0, 1);
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

export default function DiezmosPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
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

  useEffect(() => { fetchDiezmos(); }, []);

  async function fetchDiezmos() {
    setLoading(true);
    try {
      const res = await fetch('/api/diezmos');
      const data = await res.json();
      setMembers(data.members || []);
      setCommunities(data.communities || []);
      setCommunityStats(data.communityStats || []);
      setSummary(data.summary || null);
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

  const allMonths = useMemo(() => getMonthsFrom2026(), []);
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

  // Sort: payers first for current month
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

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Church size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Diezmos</h1>
              <p className="text-sm text-gray-500">Seguimiento por comunidad · Stripe + Banco</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {([['grid', Grid3X3], ['list', List], ['summary', BarChart3]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v as ViewMode)}
                  className={`p-2 rounded-md transition-colors ${view === v ? 'bg-white shadow text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
              <UserPlus size={16} /> Añadir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Este Mes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.totalMensual || 0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Dando Diezmo</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary?.totalPaying || 0}</p>
            <p className="text-xs text-gray-400">de {summary?.totalMembers || 0} miembros</p>
          </Card>
          <Card>
            <div className="flex items-center gap-1.5">
              <CreditCard size={12} className="text-blue-500" />
              <p className="text-xs text-gray-500 font-medium">Vía Stripe</p>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary?.fromStripe || 0}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-1.5">
              <Landmark size={12} className="text-amber-500" />
              <p className="text-xs text-gray-500 font-medium">Vía Banco</p>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary?.fromBanco || 0}</p>
          </Card>
        </div>

        {showAddForm && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Añadir Miembro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre completo" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)}
                placeholder="Apodo (ej: Stef)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <select value={newCommunity} onChange={e => setNewCommunity(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                {communities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="Email (opcional)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <button onClick={handleAdd} disabled={!newName.trim()}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">Guardar</button>
            </div>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar miembro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCommunity('all')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${filterCommunity === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              Todas
            </button>
            {communities.map(c => (
              <button key={c} onClick={() => setFilterCommunity(c)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${filterCommunity === c ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-violet-600" size={24} />
            <span className="ml-2 text-gray-500 text-sm">Cargando diezmos...</span>
          </div>
        ) : view === 'summary' ? (
          <div className="space-y-4">
            {communityStats.map((cs: any) => (
              <Card key={cs.community}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">{cs.community}</h3>
                  <span className="text-xs text-gray-500">{cs.payingMembers}/{cs.totalMembers} miembros dando</span>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-2xl font-bold text-violet-600">{formatCurrency(cs.monthlyTotal)}</p>
                    <p className="text-xs text-gray-400">este mes</p>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div className="bg-violet-500 h-4 rounded-full transition-all"
                      style={{ width: `${Math.max(cs.totalMembers > 0 ? (cs.payingMembers / cs.totalMembers) * 100 : 0, 8)}%` }} />
                  </div>
                  <span className="text-lg font-bold text-gray-700">
                    {cs.totalMembers > 0 ? Math.round((cs.payingMembers / cs.totalMembers) * 100) : 0}%
                  </span>
                </div>
              </Card>
            ))}
            <Card className="bg-violet-50 border-violet-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-800">Total Comunidad</p>
                  <p className="text-3xl font-bold text-violet-700 mt-1">{formatCurrency(summary?.totalMensual || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-violet-600 font-medium">{summary?.totalPaying || 0} de {summary?.totalMembers || 0}</p>
                  <p className="text-2xl font-bold text-violet-700">
                    {summary?.totalMembers > 0 ? Math.round((summary.totalPaying / summary.totalMembers) * 100) : 0}%
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : view === 'list' ? (
          <Card>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Miembro</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Comunidad</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fuente</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Este Mes</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map(m => {
                    const payment = m.payments?.[currentMonth];
                    return (
                      <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!payment ? 'opacity-50' : ''}`}>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${payment ? 'bg-green-100' : 'bg-gray-100'}`}>
                              <span className={`text-xs font-bold ${payment ? 'text-green-600' : 'text-gray-400'}`}>
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
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            m.community === 'San Pablo' ? 'bg-blue-50 text-blue-700' :
                            m.community === 'San Ignacio' ? 'bg-green-50 text-green-700' :
                            'bg-orange-50 text-orange-700'
                          }`}>{m.community}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {payment ? (
                            <span className="text-xs">{payment.source === 'stripe' ? '💳' : payment.source === 'banco' ? '🏦' : '✏️'}</span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right text-sm font-semibold ${payment ? 'text-green-600' : 'text-gray-300'}`}>
                          {payment ? formatCurrency(payment.amount) : '—'}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {deletingId === m.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDelete(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Check size={14} /></button>
                              <button onClick={() => setDeletingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditingNickname(m.id); setNicknameValue(m.nickname || ''); }}
                                className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg" title="Editar apodo">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => setDeletingId(m.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
              <div className="mt-3 p-3 bg-violet-50 rounded-lg flex items-center gap-3">
                <span className="text-sm text-violet-700 font-medium">Apodo:</span>
                <input type="text" value={nicknameValue} onChange={e => setNicknameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(editingNickname); if (e.key === 'Escape') setEditingNickname(null); }}
                  placeholder="Ej: Stef, Manu..." autoFocus
                  className="flex-1 px-3 py-1.5 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <button onClick={() => handleSaveNickname(editingNickname)} className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">Guardar</button>
                <button onClick={() => setEditingNickname(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setMonthOffset(o => o + monthsToShow)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  {formatMonth(visibleMonths[0])} — {formatMonth(visibleMonths[visibleMonths.length - 1])}
                </span>
                <button onClick={() => setMonthOffset(o => Math.max(0, o - monthsToShow))} disabled={monthOffset === 0}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex gap-1">
                {[3, 6, 12].map(n => (
                  <button key={n} onClick={() => { setMonthsToShow(n); setMonthOffset(0); }}
                    className={`px-2 py-1 text-xs rounded ${monthsToShow === n ? 'bg-violet-100 text-violet-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {n}m
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full" style={{ minWidth: `${160 + visibleMonths.length * 48}px` }}>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 sticky left-0 bg-white z-10 min-w-[140px]">Miembro</th>
                    {visibleMonths.map(m => (
                      <th key={m} className="text-center text-[10px] font-medium text-gray-500 px-0.5 py-2 min-w-[44px]">{formatMonth(m)}</th>
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
                        <tr className="bg-gray-50">
                          <td className="px-3 py-1.5 sticky left-0 bg-gray-50 z-10">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${
                                community === 'San Pablo' ? 'text-blue-700' :
                                community === 'San Ignacio' ? 'text-green-700' : 'text-orange-700'
                              }`}>{community}</span>
                              <span className="text-[10px] text-gray-400">{payingCount}/{mems.length}</span>
                            </div>
                          </td>
                          {communityTotal.map((t, i) => (
                            <td key={i} className="text-center py-1.5">
                              <span className={`text-[10px] font-bold ${t > 0 ? 'text-violet-600' : 'text-gray-300'}`}>
                                {t > 0 ? `${t}€` : '—'}
                              </span>
                            </td>
                          ))}
                        </tr>
                        {mems.map((m: any) => {
                          const hasCurrent = !!m.payments?.[currentMonth];
                          return (
                            <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 group ${!hasCurrent ? 'opacity-40' : ''}`}>
                              <td className="px-3 py-1 sticky left-0 bg-white z-10 group-hover:bg-gray-50/50">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs truncate max-w-[120px] ${hasCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {displayName(m)}
                                  </span>
                                  {m.stripeSubscriptionId && <CreditCard size={9} className="text-blue-400 flex-shrink-0" />}
                                </div>
                              </td>
                              {visibleMonths.map(month => {
                                const p = m.payments?.[month];
                                const isEditing = editingPayment?.memberId === m.id && editingPayment?.month === month;
                                return (
                                  <td key={month} className="text-center py-1 px-0.5">
                                    {isEditing ? (
                                      <div className="flex items-center gap-0.5 justify-center">
                                        <input type="number" autoFocus value={paymentAmount}
                                          onChange={e => setPaymentAmount(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0);
                                            if (e.key === 'Escape') setEditingPayment(null);
                                          }}
                                          className="w-10 text-[10px] text-center border border-violet-300 rounded px-0.5 py-0.5" />
                                        <button onClick={() => handleManualPayment(m.id, month, parseFloat(paymentAmount) || 0)}
                                          className="text-green-600"><Check size={9} /></button>
                                      </div>
                                    ) : p ? (
                                      <button onClick={() => { setEditingPayment({ memberId: m.id, month }); setPaymentAmount(String(p.amount)); }}
                                        className={`text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer ${
                                          p.source === 'stripe' ? 'bg-blue-50 text-blue-700' :
                                          p.source === 'banco' ? 'bg-amber-50 text-amber-700' :
                                          'bg-violet-50 text-violet-700'
                                        }`}>
                                        {p.amount}€
                                      </button>
                                    ) : (
                                      <button onClick={() => { setEditingPayment({ memberId: m.id, month }); setPaymentAmount(''); }}
                                        className="w-full h-full text-[10px] text-gray-200 hover:text-violet-400 hover:bg-violet-50 rounded py-0.5 cursor-pointer">
                                        +
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

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded" /><span className="text-xs text-gray-500">Stripe</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded" /><span className="text-xs text-gray-500">Banco</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-violet-50 border border-violet-200 rounded" /><span className="text-xs text-gray-500">Manual</span></div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
