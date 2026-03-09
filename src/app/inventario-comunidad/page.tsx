'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  Box, Plus, Trash2, Search, Loader2, Edit3, Check, X, Settings,
  Music, Monitor, Camera, Mic, Speaker, Guitar, Package, Landmark,
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Música', 'Sonido', 'Iluminación', 'Audiovisual', 'Mobiliario',
  'Decoración', 'Cocina', 'Transporte', 'Tecnología', 'Material', 'Otro',
];

const CATEGORY_ICONS: Record<string, any> = {
  'Música': Guitar,
  'Sonido': Speaker,
  'Audiovisual': Camera,
  'Tecnología': Monitor,
  'Iluminación': Mic,
  'Material': Package,
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
  source: 'manual' | 'bank';
}

export default function InventarioComunidadPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [manualItems, setManualItems] = useState<InventoryItem[]>([]);
  const [bankItems, setBankItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'bank'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Custom categories from localStorage
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inventory_custom_categories');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const allCategories = useMemo(() => {
    const fromItems = [...manualItems, ...bankItems].map(i => i.category);
    const merged = new Set([...DEFAULT_CATEGORIES, ...customCategories, ...fromItems]);
    return Array.from(merged).sort();
  }, [customCategories, manualItems, bankItems]);

  const [form, setForm] = useState({
    name: '', category: 'Música', quantity: 1, unitCost: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    fundedBy: 'Diezmo', notes: '',
  });

  const [editForm, setEditForm] = useState({
    name: '', category: '', quantity: 1, unitCost: 0,
    purchaseDate: '', fundedBy: '', notes: '',
  });

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/inventario-comunidad');
      const data = await res.json();
      setManualItems((data.items || []).map((i: any) => ({ ...i, source: i.source || 'manual' })));
      setBankItems((data.bankItems || []).map((i: any) => ({ ...i, source: 'bank' })));
    } catch {
      setManualItems([]);
      setBankItems([]);
    } finally {
      setLoading(false);
    }
  }

  const allItems = useMemo(() => {
    return [...manualItems, ...bankItems].sort((a, b) =>
      (b.purchaseDate || '').localeCompare(a.purchaseDate || '')
    );
  }, [manualItems, bankItems]);

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

  async function handleUpdate() {
    if (!editingId || !editForm.name.trim()) return;
    const res = await fetch('/api/inventario-comunidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        id: editingId,
        ...editForm,
        totalCost: editForm.quantity * editForm.unitCost,
      }),
    });
    if (res.ok) {
      await fetchItems();
      setEditingId(null);
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

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      purchaseDate: item.purchaseDate,
      fundedBy: item.fundedBy,
      notes: item.notes,
    });
  }

  function addCategory() {
    const cat = newCategory.trim();
    if (!cat || allCategories.includes(cat)) return;
    const updated = [...customCategories, cat];
    setCustomCategories(updated);
    localStorage.setItem('inventory_custom_categories', JSON.stringify(updated));
    setNewCategory('');
  }

  function removeCategory(cat: string) {
    if (DEFAULT_CATEGORIES.includes(cat)) return;
    const updated = customCategories.filter(c => c !== cat);
    setCustomCategories(updated);
    localStorage.setItem('inventory_custom_categories', JSON.stringify(updated));
  }

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterSource !== 'all' && item.source !== filterSource) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(s) || item.category.toLowerCase().includes(s) || item.notes.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allItems, filterCategory, filterSource, searchTerm]);

  const totalValue = allItems.reduce((s, i) => s + i.totalCost, 0);
  const totalItems = allItems.reduce((s, i) => s + i.quantity, 0);
  const manualValue = manualItems.reduce((s, i) => s + i.totalCost, 0);
  const bankValue = bankItems.reduce((s, i) => s + i.totalCost, 0);

  const byCategory = useMemo(() => {
    const groups: Record<string, { count: number; value: number }> = {};
    for (const item of allItems) {
      if (!groups[item.category]) groups[item.category] = { count: 0, value: 0 };
      groups[item.category].count += item.quantity;
      groups[item.category].value += item.totalCost;
    }
    return Object.entries(groups).sort((a, b) => b[1].value - a[1].value);
  }, [allItems]);

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Categorías</span>
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus size={16} />
              Añadir elemento
            </button>
          </div>
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
            <p className="text-xs text-gray-500 font-medium">Manual</p>
            <p className="text-xl font-bold text-violet-600 mt-1">{formatCurrency(manualValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{manualItems.length} elementos</p>
          </Card>
          <Card>
            <div className="flex items-center gap-1.5">
              <Landmark size={14} className="text-blue-500" />
              <p className="text-xs text-gray-500 font-medium">Del banco</p>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(bankValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{bankItems.length} movimientos</p>
          </Card>
        </div>

        {/* Category Manager */}
        {showCategoryManager && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Gestionar categorías</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {allCategories.map(cat => {
                const isDefault = DEFAULT_CATEGORIES.includes(cat);
                return (
                  <span key={cat} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                    isDefault ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}>
                    {cat}
                    {!isDefault && (
                      <button onClick={() => removeCategory(cat)} className="hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="Nueva categoría..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button onClick={addCategory} disabled={!newCategory.trim()}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors">
                Añadir
              </button>
            </div>
          </Card>
        )}

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
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
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

        {/* Source Tabs + Filters */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-2 py-1 flex gap-1">
            <button onClick={() => setFilterSource('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterSource === 'all' ? 'bg-orange-50 text-orange-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              Todos ({allItems.length})
            </button>
            <button onClick={() => setFilterSource('manual')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterSource === 'manual' ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Package size={14} />
              Manual ({manualItems.length})
            </button>
            <button onClick={() => setFilterSource('bank')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterSource === 'bank' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Landmark size={14} />
              Banco ({bankItems.length})
            </button>
          </div>

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
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-28">Origen</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isEditing = editingId === item.id;
                    const isBank = item.source === 'bank';

                    if (isEditing && !isBank) {
                      return (
                        <tr key={item.id} className="border-b border-orange-100 bg-orange-50/30">
                          <td className="px-4 sm:px-6 py-2">
                            <input type="text" value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
                            <input type="text" value={editForm.notes}
                              onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                              placeholder="Notas..."
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded mt-1 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          </td>
                          <td className="px-4 sm:px-6 py-2">
                            <select value={editForm.category}
                              onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500">
                              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-4 sm:px-6 py-2 text-center">
                            <input type="number" min={1} value={editForm.quantity}
                              onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                              className="w-14 px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          </td>
                          <td className="px-4 sm:px-6 py-2 text-right">
                            <input type="number" min={0} step={0.01} value={editForm.unitCost}
                              onChange={e => setEditForm({ ...editForm, unitCost: parseFloat(e.target.value) || 0 })}
                              className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          </td>
                          <td className="px-4 sm:px-6 py-2 text-center">
                            <select value={editForm.fundedBy}
                              onChange={e => setEditForm({ ...editForm, fundedBy: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500">
                              <option value="Diezmo">Diezmo</option>
                              <option value="Donativo">Donativo</option>
                              <option value="Brand">Brand</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </td>
                          <td className="px-4 sm:px-6 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={handleUpdate} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors">
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
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
                          {isBank ? (
                            <Badge variant="default">
                              <span className="flex items-center gap-1">
                                <Landmark size={10} />
                                Banco
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="purple">{item.fundedBy}</Badge>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {!isBank && (
                            <div className="flex items-center justify-center gap-0.5">
                              <button onClick={() => startEdit(item)} className="p-1 text-gray-400 hover:text-orange-500 transition-colors">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        {allItems.length === 0 ? 'Añade el primer elemento al inventario' : 'Sin resultados para este filtro'}
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
