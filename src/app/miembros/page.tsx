'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { DateRange } from '@/lib/types';
import {
  Users, Loader2, UserPlus, Search, Cake, Church, X, Edit3, Trash2,
  Mail, Phone, Save, Calendar, MapPin, Heart,
} from 'lucide-react';
import { getBirthdaysThisMonth } from '@/lib/birthdays';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const COMMUNITY_ORDER = ['San Pablo', 'San Ignacio', 'San Martín', 'Colaboradores'];

const COMMUNITY_STYLES: Record<string, { bg: string; text: string; soft: string; ring: string; gradient: string }> = {
  'San Pablo':     { bg: 'bg-blue-500',    text: 'text-blue-700',    soft: 'bg-blue-50',    ring: 'ring-blue-200',    gradient: 'from-blue-500 to-blue-600' },
  'San Ignacio':   { bg: 'bg-green-500',   text: 'text-green-700',   soft: 'bg-green-50',   ring: 'ring-green-200',   gradient: 'from-green-500 to-green-600' },
  'San Martín':    { bg: 'bg-orange-500',  text: 'text-orange-700',  soft: 'bg-orange-50',  ring: 'ring-orange-200',  gradient: 'from-orange-500 to-orange-600' },
  'Colaboradores': { bg: 'bg-violet-500',  text: 'text-violet-700',  soft: 'bg-violet-50',  ring: 'ring-violet-200',  gradient: 'from-violet-500 to-violet-600' },
};
const DEFAULT_STYLE = COMMUNITY_STYLES['Colaboradores'];

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Color de avatar consistente por nombre
const AVATAR_COLORS = [
  'from-pink-400 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-cyan-400 to-blue-500',
  'from-indigo-400 to-purple-500',
  'from-fuchsia-400 to-pink-500',
  'from-lime-400 to-emerald-500',
  'from-sky-400 to-indigo-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function MiembrosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    label: 'Este año',
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(),
  });
  const [members, setMembers] = useState<any[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [communityTab, setCommunityTab] = useState<string>('San Pablo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newApodo, setNewApodo] = useState('');
  const [newCommunity, setNewCommunity] = useState('San Pablo');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const birthdays = useMemo(() => getBirthdaysThisMonth(), []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: new Date(2026, 0, 1).toISOString(), end: new Date().toISOString() });
      const res = await fetch(`/api/diezmos?${params}`);
      if (res.ok) {
        const d = await res.json();
        setMembers(d.members || []);
        setCommunities(d.communities || []);
      }
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    const res = await fetch('/api/diezmos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_member', name: newName, nickname: newApodo || null, community: newCommunity, email: newEmail || null, phone: newPhone || null }) });
    if (!res.ok) { alert('Error al añadir'); return; }
    setNewName(''); setNewApodo(''); setNewEmail(''); setNewPhone(''); setShowAddForm(false); await load();
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

  // Comunidades dinámicas
  const allCommunities = useMemo(() => {
    if (!members.length) return [];
    const set = new Set<string>(members.map((m: any) => m.community).filter(Boolean));
    const arr = Array.from(set);
    arr.sort((a, b) => COMMUNITY_ORDER.indexOf(a) - COMMUNITY_ORDER.indexOf(b));
    return arr;
  }, [members]);

  useEffect(() => {
    if (allCommunities.length > 0 && !allCommunities.includes(communityTab)) {
      setCommunityTab(allCommunities[0]);
    }
  }, [allCommunities, communityTab]);

  // Stats por comunidad
  const communityStats = useMemo(() => {
    return allCommunities.map(c => ({
      community: c,
      count: members.filter((m: any) => m.community === c).length,
    }));
  }, [members, allCommunities]);

  // Miembros visibles
  const visibleMembers = useMemo(() => {
    let arr = members.filter((m: any) => m.community === communityTab);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((m: any) =>
        m.name.toLowerCase().includes(s) ||
        (m.nickname || '').toLowerCase().includes(s) ||
        (m.email || '').toLowerCase().includes(s)
      );
    }
    arr.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    return arr;
  }, [members, communityTab, search]);

  function displayName(m: any) { return m.nickname || m.name; }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Users size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Miembros</h1>
            <p className="text-sm text-gray-500">Comunidad · cumpleaños · contacto</p>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm">
            <UserPlus size={14} /> Añadir
          </button>
        </div>

        {/* 4 círculos de KPIs por comunidad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {communityStats.map(({ community, count }) => {
            const style = COMMUNITY_STYLES[community] || DEFAULT_STYLE;
            const active = communityTab === community;
            return (
              <button
                key={community}
                onClick={() => setCommunityTab(community)}
                className={`relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-3xl border-2 transition-all overflow-hidden
                  ${active
                    ? `bg-gradient-to-br ${style.gradient} text-white border-transparent shadow-lg scale-[1.03]`
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:shadow-md'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${active ? 'bg-white/25' : style.soft}`}>
                  <Church size={26} className={active ? 'text-white' : style.text} />
                </div>
                <p className={`text-3xl font-bold ${active ? 'text-white' : style.text}`}>{count}</p>
                <p className={`text-xs font-semibold mt-0.5 ${active ? 'text-white/85' : 'text-gray-700'}`}>{community}</p>
              </button>
            );
          })}
        </div>

        {/* Cumpleaños */}
        {birthdays.length > 0 && (
          <Card className="!p-4 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm">
                <Cake size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">Cumpleaños este mes</h3>
                <p className="text-[11px] text-amber-700">{birthdays.length} miembro(s) cumplen en {MONTHS_SHORT[new Date().getMonth()]}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {birthdays.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1.5 rounded-full shadow-sm">
                  <Cake size={11} className="text-amber-500" />
                  {b.name}
                  <span className="text-amber-400 font-normal">{b.day}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Add form */}
        {showAddForm && (
          <Card className="border-2 border-violet-200 bg-violet-50/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><UserPlus size={14} /> Nuevo miembro</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo *"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              <input value={newApodo} onChange={e => setNewApodo(e.target.value)} placeholder="Apodo"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              <select value={newCommunity} onChange={e => setNewCommunity(e.target.value)}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white">
                {(allCommunities.length > 0 ? allCommunities : communities).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Teléfono"
                className="sm:col-span-2 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" />
            </div>
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="w-full mt-3 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50">
              Guardar miembro
            </button>
          </Card>
        )}

        {/* Búsqueda */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Buscar en ${communityTab}...`}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
        ) : visibleMembers.length === 0 ? (
          <Card><p className="text-center py-12 text-gray-400 text-sm">Sin miembros en {communityTab}</p></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visibleMembers.map((m: any) => {
              const isEditing = editingId === m.id;
              const isDeleting = deletingId === m.id;
              const hasBday = birthdays.some(b => b.name === displayName(m) || b.name === m.name);
              const initials = getInitials(displayName(m));
              const colorClass = avatarColor(m.name);

              if (isEditing) {
                return (
                  <Card key={m.id} className="!p-3 border-2 border-violet-300 bg-violet-50/40">
                    <div className="space-y-1.5">
                      <input value={editForm.name ?? m.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                        className="w-full text-sm font-bold border border-gray-200 rounded px-2 py-1" placeholder="Nombre" />
                      <input value={editForm.nickname ?? (m.nickname || '')} onChange={e => setEditForm({...editForm, nickname: e.target.value})}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="Apodo" />
                      <input value={editForm.email ?? (m.email || '')} onChange={e => setEditForm({...editForm, email: e.target.value})}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="Email" />
                      <select value={editForm.community ?? m.community} onChange={e => setEditForm({...editForm, community: e.target.value})}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                        {(allCommunities.length > 0 ? allCommunities : communities).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => handleSave(m.id)} className="flex-1 px-2 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 flex items-center justify-center gap-1">
                          <Save size={10} /> Guardar
                        </button>
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="px-2 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg">
                          ✕
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              }

              return (
                <div key={m.id} className="relative bg-white rounded-2xl border border-gray-200 p-3 hover:shadow-lg hover:border-violet-300 transition-all group">
                  {/* Acciones flotantes */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(m.id); setEditForm({}); }}
                      className="p-1.5 bg-white/90 backdrop-blur shadow-sm hover:bg-violet-100 rounded-lg" title="Editar">
                      <Edit3 size={11} className="text-gray-600" />
                    </button>
                    {isDeleting ? (
                      <div className="flex gap-0.5">
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 bg-rose-500 text-white rounded-lg" title="Confirmar borrar"><Trash2 size={11} /></button>
                        <button onClick={() => setDeletingId(null)} className="p-1.5 bg-white/90 backdrop-blur shadow-sm rounded-lg"><X size={11} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(m.id)}
                        className="p-1.5 bg-white/90 backdrop-blur shadow-sm hover:bg-rose-100 rounded-lg" title="Eliminar">
                        <Trash2 size={11} className="text-rose-500" />
                      </button>
                    )}
                  </div>

                  {/* Avatar grande con gradiente */}
                  <div className="flex flex-col items-center text-center">
                    <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-xl shadow-md mb-2 ${hasBday ? 'ring-4 ring-amber-300' : ''}`}>
                      {initials}
                      {hasBday && (
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-sm border-2 border-white">
                          <Cake size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 leading-tight truncate w-full" title={m.name}>{displayName(m)}</p>
                    {m.nickname && <p className="text-[10px] text-gray-400 truncate w-full" title={m.name}>{m.name}</p>}

                    {/* Info contacto */}
                    <div className="w-full mt-2 space-y-1">
                      {m.email && (
                        <a href={`mailto:${m.email}`} onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-violet-600 truncate">
                          <Mail size={9} className="flex-shrink-0" />
                          <span className="truncate">{m.email}</span>
                        </a>
                      )}
                      {m.phone && (
                        <a href={`tel:${m.phone}`} onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-violet-600">
                          <Phone size={9} />
                          <span className="truncate">{m.phone}</span>
                        </a>
                      )}
                    </div>

                    {hasBday && (
                      <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-full">
                        <Cake size={9} /> Cumple este mes
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        <p className="text-[11px] text-gray-400 text-center py-2">
          💡 Para gestionar diezmos, Stripe y conciliación de pagos: ir a <a href="/diezmos" className="text-violet-600 underline">/diezmos</a>
        </p>
      </div>
    </DashboardLayout>
  );
}
