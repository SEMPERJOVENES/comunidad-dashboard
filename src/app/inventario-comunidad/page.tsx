'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Box, Plus, Trash2, Search, Loader2, Edit3, Check, X,
  Music, Monitor, Camera, Mic, Speaker, Guitar, Package,
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  'Música', 'Sonido', 'Iluminación', 'Audiovisual', 'Mobiliario',
  'Decoración', 'Cocina', 'Transporte', 'Tecnología', 'Otro',
];

const CATEGORY_ICONS: Record<string, any> = {
  'Música': Guitar,
  'Sonido': Speaker,
  'Audiovisual': Camera,
  'Tecnología': Monitor,
  'Iluminación': Mic,
};

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  fundedBy: string;
  notes: string;
}

export default function InventarioComunidadPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', category: 'Música', quantity: 1, unitCost: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    fundedBy: 'Diezmo', notes: '',
  });

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/inventario-comunidad');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    const res = await fetch('/api/inventario-comunidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...form, totalCost: form.quantity * form.unitCost }),
    });
    if (res.ok) {
      await fetchItems();
      setForm({ name: '', category: 'Música', quantity: 1, unitCost: 0, purchaseDate: new Date().toISOString().split('T')[0], fundedBy: 'Diezmo', notes: '' });
      setShowAddForm(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este elemento del inventario?')) return;
    const res = await fetch('/api/inventario-comunidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (res.ok) await fetchItems();
  }

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(s) || item.category.toLowerCase().includes(s) || item.notes.toLowerCase().includes(s);
      }
      return true;
    });
  }, [items, filterCategory, searchTerm]);

  const totalValue = items.reduce((s, i) => s + i.totalCost, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const fromDiezmo = items.filter(i => i.fundedBy === 'Diezmo').reduce((s, i) => s + i.totalCost, 0);

  const byCategory = useMemo(() => {
    const groups: Record<string, { count: number; value: number }> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = { count: 0, value: 0 };
      groups[item.category].count += item.quantity;
      groups[item.category].value += item.totalCost;
    }
    return Object.entries(groups).sort((a, b) => b[1].value - a[1].value);
  }, [items]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Box size={24} className="text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Inventario Material</h1>
              <p className="text-sm text-gray-500">Equipos y material de la comunidad</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus size={16} />
            Añadir elemento
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Elementos</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalItems}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Valor total</p>
            <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(totalValue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Financiado (Diezmo)</p>
            <p className="text-xl font-bold text-violet-600 mt-1">{formatCurrency(fromDiezmo)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Categorías</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{byCategory.length}</p>
          </Card>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Nuevo elemento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Piano Yamaha P-125"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
                <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Coste unitario</label>
                <input type="number" min={0} step={0.01} value={form.unitCost} onChange={e => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fecha compra</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Financiado por</label>
                <select value={form.fundedBy} onChange={e => setForm({ ...form, fundedBy: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="Diezmo">Diezmo</option>
                  <option value="Donativo">Donativo</option>
                  <option value="Brand">Brand</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs text-gray-500 mb-1 block">Notas</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Opcional: ubicación, estado, etc."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAdd} disabled={!form.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
                <Plus size={16} /> Añadir
              </button>
              <button onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar elemento..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="all">Todas las categorías</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Category Summary */}
        {byCategory.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, data]) => {
              const Icon = CATEGORY_ICONS[cat] || Package;
              return (
                <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    filterCategory === cat ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Icon size={14} />
                  {cat} ({data.count}) · {formatCurrency(data.value)}
                </button>
              );
            })}
          </div>
        )}

        {/* Items Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-orange-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando inventario...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Elemento</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-28">Categoría</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-16">Uds</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-24">Coste</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-28">Financiado</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        <p className="text-xs text-gray-400">{item.purchaseDate}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <Badge variant="info">{item.category}</Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center text-sm text-gray-700 font-medium">{item.quantity}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(item.totalCost)}</td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <Badge variant={item.fundedBy === 'Diezmo' ? 'purple' : 'default'}>{item.fundedBy}</Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        {items.length === 0 ? 'Añade el primer elemento al inventario' : 'Sin resultados para este filtro'}
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
