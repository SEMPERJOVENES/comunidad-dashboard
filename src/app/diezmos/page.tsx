'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, TitheMember } from '@/lib/types';
import { Church, UserPlus, Loader2, CreditCard, Landmark, CheckCircle2, XCircle, Search } from 'lucide-react';

export default function DiezmosPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [members, setMembers] = useState<TitheMember[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'stripe' | 'banco' | 'ambos'>('all');

  useEffect(() => {
    fetchDiezmos();
  }, []);

  async function fetchDiezmos() {
    setLoading(true);
    try {
      const res = await fetch('/api/diezmos');
      const data = await res.json();
      setMembers(data.members || []);
      setSummary(data.summary || null);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!newName.trim()) return;
    try {
      await fetch('/api/diezmos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_member', name: newName.trim(), email: newEmail.trim() || null }),
      });
      setNewName('');
      setNewEmail('');
      setShowAddForm(false);
      fetchDiezmos();
    } catch {}
  }

  const filtered = members.filter(m => {
    if (filterSource !== 'all' && m.source !== filterSource && m.source !== 'ambos') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return m.name.toLowerCase().includes(s) || (m.email || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Church size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Diezmos</h1>
              <p className="text-sm text-gray-500">Gestión de diezmos: Stripe + extracto bancario</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            <UserPlus size={16} />
            Añadir Miembro
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Total Diezmos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.totalDiezmos || 0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Miembros Activos</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary?.activeMembers || 0}</p>
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

        {/* Add member form */}
        {showAddForm && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Añadir Miembro</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre completo"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email (opcional)"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleAddMember}
                disabled={!newName.trim()}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar miembro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'stripe', 'banco'] as const).map(source => (
              <button
                key={source}
                onClick={() => setFilterSource(source)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filterSource === source
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {source === 'all' ? 'Todos' : source === 'stripe' ? 'Stripe' : 'Banco'}
              </button>
            ))}
          </div>
        </div>

        {/* Members list */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando diezmos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Miembro</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fuente</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Total Pagado</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Pagos</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Último Pago</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member, i) => (
                    <tr key={`${member.name}-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-violet-600">
                              {member.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            {member.email && <p className="text-xs text-gray-400">{member.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(member.source === 'stripe' || member.source === 'ambos') && (
                            <CreditCard size={14} className="text-blue-500" />
                          )}
                          {(member.source === 'banco' || member.source === 'ambos') && (
                            <Landmark size={14} className="text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(member.totalPaid)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center text-sm text-gray-500">
                        {member.payments?.length || 0}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">
                        {member.lastPayment ? formatDate(member.lastPayment) : '—'}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        {member.isActive ? (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-medium">Activo</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-gray-400">
                            <XCircle size={14} />
                            <span className="text-xs font-medium">Inactivo</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        {members.length === 0
                          ? 'Importa un extracto bancario o conecta Stripe para ver diezmos'
                          : 'Sin resultados para este filtro'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
