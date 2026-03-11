'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import {
  TrendingUp, TrendingDown, Tag, Loader2, ArrowUpRight, ArrowDownRight,
  AlertCircle, Settings2, Plus, Pencil, Trash2, X, Check,
} from 'lucide-react';

interface Category {
  tag: string;
  income: number;
  expenses: number;
  net: number;
  incomeCount: number;
  expensesCount: number;
  totalOps: number;
}

interface TagCategory {
  id: string;
  name: string;
  color: string;
  macroGroup: string;
}

interface CategoriesData {
  categories: Category[];
  tagCategories: TagCategory[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
  totalTransactions: number;
  uncategorized: number;
}

const AVAILABLE_COLORS = [
  { name: 'violet', label: 'Violeta' },
  { name: 'pink', label: 'Rosa' },
  { name: 'indigo', label: 'Índigo' },
  { name: 'blue', label: 'Azul' },
  { name: 'cyan', label: 'Cian' },
  { name: 'teal', label: 'Teal' },
  { name: 'green', label: 'Verde' },
  { name: 'lime', label: 'Lima' },
  { name: 'emerald', label: 'Esmeralda' },
  { name: 'amber', label: 'Ámbar' },
  { name: 'orange', label: 'Naranja' },
  { name: 'red', label: 'Rojo' },
  { name: 'rose', label: 'Rosado' },
  { name: 'fuchsia', label: 'Fucsia' },
  { name: 'purple', label: 'Púrpura' },
  { name: 'yellow', label: 'Amarillo' },
  { name: 'gray', label: 'Gris' },
  { name: 'slate', label: 'Pizarra' },
  { name: 'zinc', label: 'Zinc' },
  { name: 'stone', label: 'Piedra' },
];

const MACRO_GROUPS = [
  { value: 'diezmos', label: 'Comunidad (Diezmos)' },
  { value: 'brand', label: 'Semper Brand' },
  { value: 'otros', label: 'Otros' },
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; dot: string }> = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  green: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  lime: { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
  zinc: { bg: 'bg-zinc-50', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  stone: { bg: 'bg-stone-50', text: 'text-stone-700', dot: 'bg-stone-500' },
};

export default function CategoriasPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Desde siempre'));
  const [data, setData] = useState<CategoriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'analysis' | 'manage'>('analysis');

  // Management state
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('gray');
  const [editMacro, setEditMacro] = useState('otros');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('gray');
  const [newMacro, setNewMacro] = useState('otros');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: selectedRange.startDate.toISOString(),
        end: selectedRange.endDate.toISOString(),
      });
      const res = await fetch(`/api/categorias?${params}`);
      if (!res.ok) throw new Error('Error');
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [selectedRange]);

  const incomeCategories = useMemo(() => {
    if (!data) return [];
    return data.categories.filter(c => c.income > 0).sort((a, b) => b.income - a.income);
  }, [data]);

  const expenseCategories = useMemo(() => {
    if (!data) return [];
    return data.categories.filter(c => c.expenses > 0).sort((a, b) => b.expenses - a.expenses);
  }, [data]);

  function getTagColor(tag: string) {
    const tc = data?.tagCategories?.find(t => t.name === tag);
    if (tc && COLOR_CLASSES[tc.color]) return COLOR_CLASSES[tc.color];
    return COLOR_CLASSES.gray;
  }

  // CRUD handlers
  async function handleAddCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_category', name: newName.trim(), color: newColor, macroGroup: newMacro }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error); return; }
      setShowAdd(false);
      setNewName('');
      setNewColor('gray');
      setNewMacro('otros');
      await fetchData();
    } catch {
      alert('Error al crear categoría');
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameCategory(oldName: string) {
    if (!editName.trim() || editName.trim() === oldName) {
      // Just update color/macro if name unchanged
      if (editColor || editMacro) {
        setSaving(true);
        try {
          await fetch('/api/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_category', name: oldName, color: editColor, macroGroup: editMacro }),
          });
        } catch {}
      }
      setSaving(false);
      setEditingCat(null);
      await fetchData();
      return;
    }

    setSaving(true);
    try {
      // Update color/macro first
      await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_category', name: oldName, color: editColor, macroGroup: editMacro }),
      });
      // Then rename
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename_category', oldName, newName: editName.trim() }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error); return; }
      setEditingCat(null);
      await fetchData();
    } catch {
      alert('Error al actualizar categoría');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(name: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_category', name }),
      });
      if (!res.ok) { alert('Error al eliminar'); return; }
      setDeleteConfirm(null);
      await fetchData();
    } catch {
      alert('Error al eliminar categoría');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(tc: TagCategory) {
    setEditingCat(tc.name);
    setEditName(tc.name);
    setEditColor(tc.color);
    setEditMacro(tc.macroGroup);
  }

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tag size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Categorías Financieras</h1>
              <p className="text-sm text-gray-500">Análisis y gestión de categorías</p>
            </div>
          </div>
          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('analysis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp size={14} />
              Análisis
            </button>
            <button
              onClick={() => setActiveView('manage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'manage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings2 size={14} />
              Gestionar
            </button>
          </div>
        </div>

        {activeView === 'manage' ? (
          /* ===================== MANAGEMENT VIEW ===================== */
          <div className="space-y-4">
            {/* Add button */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {data?.tagCategories?.length || 0} categorías definidas
              </p>
              <button
                onClick={() => { setShowAdd(true); setNewName(''); setNewColor('gray'); setNewMacro('otros'); }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Plus size={16} />
                Nueva categoría
              </button>
            </div>

            {/* Add form */}
            {showAdd && (
              <Card className="!p-4 border-2 border-violet-200 bg-violet-50/30">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Nombre de la categoría"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    autoFocus
                  />
                  <select
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {AVAILABLE_COLORS.map(c => (
                      <option key={c.name} value={c.name}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    value={newMacro}
                    onChange={(e) => setNewMacro(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {MACRO_GROUPS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCategory}
                      disabled={saving || !newName.trim()}
                      className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                    >
                      <Check size={14} />
                      Crear
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Categories list */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-violet-600" size={24} />
                <span className="ml-2 text-gray-500">Cargando...</span>
              </div>
            ) : (
              <Card>
                <div className="overflow-x-auto -mx-4 sm:-mx-6">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Categoría</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Color</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Macro Grupo</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.tagCategories || []).map((tc) => {
                        const colors = COLOR_CLASSES[tc.color] || COLOR_CLASSES.gray;
                        const isEditing = editingCat === tc.name;
                        const isDeleting = deleteConfirm === tc.name;

                        if (isDeleting) {
                          return (
                            <tr key={tc.id} className="border-b border-gray-50 bg-red-50">
                              <td colSpan={4} className="px-4 sm:px-6 py-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-red-800">
                                      ¿Eliminar &quot;{tc.name}&quot;?
                                    </p>
                                    <p className="text-xs text-red-600 mt-0.5">
                                      Las transacciones etiquetadas con esta categoría quedarán sin clasificar
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleDeleteCategory(tc.name)}
                                      disabled={saving}
                                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                      Sí, eliminar
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        if (isEditing) {
                          return (
                            <tr key={tc.id} className="border-b border-gray-50 bg-violet-50/30">
                              <td className="px-4 sm:px-6 py-3">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  autoFocus
                                />
                              </td>
                              <td className="px-4 sm:px-6 py-3">
                                <select
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                  {AVAILABLE_COLORS.map(c => (
                                    <option key={c.name} value={c.name}>{c.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 sm:px-6 py-3">
                                <select
                                  value={editMacro}
                                  onChange={(e) => setEditMacro(e.target.value)}
                                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                  {MACRO_GROUPS.map(g => (
                                    <option key={g.value} value={g.value}>{g.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 sm:px-6 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => handleRenameCategory(tc.name)}
                                    disabled={saving}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Guardar"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={() => setEditingCat(null)}
                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Cancelar"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={tc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-4 sm:px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                  {tc.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded ${colors.dot}`} />
                                <span className="text-xs text-gray-500">{tc.color}</span>
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <Badge variant={tc.macroGroup === 'diezmos' ? 'purple' : tc.macroGroup === 'brand' ? 'info' : 'default'}>
                                {MACRO_GROUPS.find(g => g.value === tc.macroGroup)?.label || tc.macroGroup}
                              </Badge>
                            </td>
                            <td className="px-4 sm:px-6 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => startEdit(tc)}
                                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(tc.name)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!data?.tagCategories || data.tagCategories.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-sm text-gray-400">
                            No hay categorías definidas. Crea una nueva.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* ===================== ANALYSIS VIEW ===================== */
          <>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-violet-600" size={28} />
                <span className="ml-3 text-gray-500">Cargando categorías...</span>
              </div>
            ) : !data ? (
              <Card>
                <p className="text-center text-gray-400 py-12">No se pudieron cargar los datos</p>
              </Card>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="!p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Ingresos</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(data.totalIncome)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <ArrowUpRight size={14} className="text-emerald-500" />
                      <span className="text-xs text-gray-500">{incomeCategories.length} categorías</span>
                    </div>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Gastos</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.totalExpenses)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <ArrowDownRight size={14} className="text-red-500" />
                      <span className="text-xs text-gray-500">{expenseCategories.length} categorías</span>
                    </div>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resultado Neto</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(data.net)}
                    </p>
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">{data.totalTransactions} operaciones</span>
                    </div>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sin Categorizar</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 ${data.uncategorized > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {data.uncategorized}
                    </p>
                    {data.uncategorized > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        <AlertCircle size={12} className="text-amber-500" />
                        <span className="text-xs text-amber-600">Pendiente de clasificar</span>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Income & Expenses Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Ingresos por Categoría */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-500" />
                          Ingresos por Categoría
                        </div>
                      </CardTitle>
                      <Badge variant="success">{formatCurrency(data.totalIncome)}</Badge>
                    </CardHeader>
                    <div className="space-y-2.5">
                      {incomeCategories.map((cat) => {
                        const pct = data.totalIncome > 0 ? (cat.income / data.totalIncome) * 100 : 0;
                        const colors = getTagColor(cat.tag);
                        return (
                          <div key={cat.tag}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                  {cat.tag}
                                </span>
                                <span className="text-xs text-gray-400">{cat.incomeCount} ops</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.income)}</span>
                                <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {incomeCategories.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">Sin ingresos en este período</p>
                      )}
                    </div>
                  </Card>

                  {/* Gastos por Categoría */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <TrendingDown size={16} className="text-red-500" />
                          Gastos por Categoría
                        </div>
                      </CardTitle>
                      <Badge variant="danger">{formatCurrency(data.totalExpenses)}</Badge>
                    </CardHeader>
                    <div className="space-y-2.5">
                      {expenseCategories.map((cat) => {
                        const pct = data.totalExpenses > 0 ? (cat.expenses / data.totalExpenses) * 100 : 0;
                        const colors = getTagColor(cat.tag);
                        return (
                          <div key={cat.tag}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                  {cat.tag}
                                </span>
                                <span className="text-xs text-gray-400">{cat.expensesCount} ops</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.expenses)}</span>
                                <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {expenseCategories.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">Sin gastos en este período</p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Full Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-violet-500" />
                        Todas las Categorías
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto -mx-4 sm:-mx-6">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Categoría</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ingresos</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Gastos</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Neto</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-2">Ops</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categories.map((cat) => {
                          const colors = getTagColor(cat.tag);
                          return (
                            <tr key={cat.tag} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="px-4 sm:px-6 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                    {cat.tag}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-emerald-600 font-medium">
                                {cat.income > 0 ? formatCurrency(cat.income) : '-'}
                              </td>
                              <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-red-500 font-medium">
                                {cat.expenses > 0 ? `-${formatCurrency(cat.expenses)}` : '-'}
                              </td>
                              <td className={`px-4 sm:px-6 py-2.5 text-sm text-right font-bold ${cat.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(cat.net)}
                              </td>
                              <td className="px-4 sm:px-6 py-2.5 text-sm text-right text-gray-500">
                                {cat.totalOps}
                              </td>
                            </tr>
                          );
                        })}
                        {data.categories.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-sm text-gray-400">Sin datos</td>
                          </tr>
                        )}
                      </tbody>
                      {data.categories.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                            <td className="px-4 sm:px-6 py-3 text-sm font-bold text-gray-900">Total</td>
                            <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-emerald-600">
                              {formatCurrency(data.totalIncome)}
                            </td>
                            <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-red-600">
                              -{formatCurrency(data.totalExpenses)}
                            </td>
                            <td className={`px-4 sm:px-6 py-3 text-sm text-right font-bold ${data.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(data.net)}
                            </td>
                            <td className="px-4 sm:px-6 py-3 text-sm text-right font-bold text-gray-900">
                              {data.totalTransactions}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
