'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Users, UserPlus, Loader2, Trash2, Check, X, Search, Save,
  Cake, Mail, Phone, MessageSquare, Edit3, Plus,
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
  apellidos: string;
  apodo: string;
  community: string;
  email: string;
  phone: string;
  fechaNacimiento: string | null;
  notes: string;
  isActive: boolean;
  totalPayments: number;
  paidCurrentMonth: boolean;
}

export default function MiembrosDatosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [members, setMembers] = useState<Member[]>([]);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCom, setFilterCom] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Member>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState<Partial<Member>>({ community: 'San Pablo', isActive: true });

  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch('/api/miembros');
      const d = await r.json();
      setMembers(d.members || []);
      setCommunities(d.communities || []);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/miembros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...draft }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setEditing(null); setDraft({});
      await fetchAll();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar miembro? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch('/api/miembros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      await fetchAll();
    } catch (e: any) { alert(e.message); }
    finally { setDeletingId(null); }
  }

  async function handleAdd() {
    if (!newMember.name?.trim()) return;
    try {
      const res = await fetch('/api/miembros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...newMember }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setNewMember({ community: 'San Pablo', isActive: true });
      setShowAdd(false);
      await fetchAll();
    } catch (e: any) { alert(e.message); }
  }

  const filtered = members.filter(m => {
    if (filterCom !== 'all' && m.community !== filterCom) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [m.name, m.apellidos, m.apodo, m.email, m.community].some(v => (v || '').toLowerCase().includes(s));
  });

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Users size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Datos de Miembros</h1>
              <p className="text-sm text-gray-500">Edita nombre, apellidos, apodo, email, cumpleaños, comunidad</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/miembros" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">← Vista diezmos</a>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700">
              <UserPlus size={16} /> Nuevo
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, apellidos, apodo, email..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCom('all')} className={`px-3 py-2 text-xs font-medium rounded-xl ${filterCom === 'all' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200'}`}>Todas</button>
            {communities.map(c => (
              <button key={c.id} onClick={() => setFilterCom(c.name)} className={`px-3 py-2 text-xs font-medium rounded-xl ${filterCom === c.name ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <Card className="border-2 border-violet-200 bg-violet-50/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Nuevo miembro</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Nombre*" value={newMember.name || ''} onChange={e => setNewMember({ ...newMember, name: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input placeholder="Apellidos" value={newMember.apellidos || ''} onChange={e => setNewMember({ ...newMember, apellidos: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input placeholder="Apodo" value={newMember.apodo || ''} onChange={e => setNewMember({ ...newMember, apodo: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input placeholder="Email" type="email" value={newMember.email || ''} onChange={e => setNewMember({ ...newMember, email: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input placeholder="Teléfono" value={newMember.phone || ''} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input type="date" placeholder="Cumpleaños" value={newMember.fechaNacimiento || ''} onChange={e => setNewMember({ ...newMember, fechaNacimiento: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <select value={newMember.community || 'San Pablo'} onChange={e => setNewMember({ ...newMember, community: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {communities.map(c => <option key={c.id}>{c.name}</option>)}
              </select>
              <textarea placeholder="Notas" value={newMember.notes || ''} onChange={e => setNewMember({ ...newMember, notes: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg sm:col-span-2" rows={1} />
              <button onClick={handleAdd} disabled={!newMember.name?.trim()} className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50">Guardar</button>
            </div>
          </Card>
        )}

        {/* Tabla editable */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-violet-600" size={24} />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Nombre</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Apellidos</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Apodo</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Teléfono</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Cumpleaños</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Comunidad</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-3">Notas</th>
                    <th className="text-center text-xs font-semibold text-gray-600 px-3 py-3 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const isEd = editing === m.id;
                    const cur = isEd ? { ...m, ...draft } : m;
                    return (
                      <tr key={m.id} className={`border-b border-gray-50 hover:bg-violet-50/20 ${!m.isActive ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input value={cur.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-sm font-medium">{m.name}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input value={cur.apellidos || ''} onChange={e => setDraft({ ...draft, apellidos: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-sm text-gray-600">{m.apellidos || '—'}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input value={cur.apodo || ''} onChange={e => setDraft({ ...draft, apodo: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-sm text-gray-500 italic">{m.apodo || '—'}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input type="email" value={cur.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-xs text-gray-500">{m.email || '—'}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input value={cur.phone || ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-xs text-gray-500">{m.phone || '—'}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input type="date" value={cur.fechaNacimiento || ''} onChange={e => setDraft({ ...draft, fechaNacimiento: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : (m.fechaNacimiento
                                ? <span className="inline-flex items-center gap-1 text-xs"><Cake size={11} className="text-amber-400" />{new Date(m.fechaNacimiento).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                : <span className="text-xs text-gray-300">—</span>)}
                        </td>
                        <td className="px-3 py-2">
                          {isEd ? (
                            <select value={cur.community || ''} onChange={e => setDraft({ ...draft, community: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg bg-white">
                              {communities.map(c => <option key={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              m.community === 'San Pablo' ? 'bg-blue-50 text-blue-700' :
                              m.community === 'San Ignacio' ? 'bg-green-50 text-green-700' :
                              m.community === 'Colaboradores' ? 'bg-purple-50 text-purple-700' :
                              m.community === 'San Martín' ? 'bg-orange-50 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{m.community}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEd
                            ? <input value={cur.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} className="w-full px-2 py-1 text-sm border border-violet-300 rounded-lg" />
                            : <span className="text-xs text-gray-500 truncate block max-w-[200px]" title={m.notes}>{m.notes || '—'}</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEd ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleSave(m.id)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={() => { setEditing(null); setDraft({}); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditing(m.id); setDraft(m); }} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Edit3 size={14} /></button>
                              <button onClick={() => handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={9} className="text-center py-8 text-sm text-gray-400">Sin miembros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs text-gray-400">
            {filtered.length} miembros mostrados · Click en lápiz para editar · Cumpleaños sale en widget de la página principal
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
