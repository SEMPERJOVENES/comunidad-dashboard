'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { BookOpen, Plus, Trash2, Search, Loader2, ArrowLeft, Edit3, Check, X } from 'lucide-react';
import Link from 'next/link';

const FALLBACK_CATEGORIES = [
  'Diezmo', 'Brand', 'Donativo', 'Misa/Tabor', 'Retiros',
  'Viajes', 'Material', 'Música', 'Semper CD', 'BAC',
  'Gastos Varios', 'Stripe', 'Shopify', 'Bizum', 'Transferencia',
  'Comisión bancaria', 'Venta presencial', 'Gasto operativo',
  'Nómina', 'Alquiler', 'Proveedor', 'Otro',
];

interface Rule {
  keyword: string;
  category: string;
}

export default function ReglasPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingRule, setEditingRule] = useState<{ keyword: string; newCategory: string } | null>(null);

  const allCategories = useMemo(() => {
    const fromRules = rules.map(r => r.category);
    const merged = new Set([...FALLBACK_CATEGORIES, ...dbCategories, ...fromRules]);
    return Array.from(merged).sort();
  }, [rules, dbCategories]);

  useEffect(() => { fetchRules(); fetchCategories(); }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch('/api/reglas');
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/api/categorias?start=2020-01-01&end=2099-12-31');
      const data = await res.json();
      if (data.tagCategories) {
        setDbCategories(data.tagCategories.map((tc: any) => tc.name));
      }
    } catch { /* fallback to FALLBACK_CATEGORIES */ }
  }

  async function handleAdd() {
    if (!newKeyword.trim() || !newCategory.trim()) return;
    const res = await fetch('/api/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', keyword: newKeyword, category: newCategory.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setRules(data.rules);
      setNewKeyword('');
    } else {
      alert(data.error);
    }
  }

  async function handleDelete(keyword: string) {
    const res = await fetch('/api/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', keyword }),
    });
    const data = await res.json();
    if (res.ok) setRules(data.rules);
  }

  async function handleUpdateCategory(oldKeyword: string, newCat: string) {
    if (!newCat.trim()) return;
    const res = await fetch('/api/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', oldKeyword, keyword: oldKeyword, category: newCat.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setRules(data.rules);
      setEditingRule(null);
    }
  }

  const filtered = useMemo(() => {
    return rules.filter(r => {
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return r.keyword.includes(s) || r.category.toLowerCase().includes(s);
      }
      return true;
    });
  }, [rules, filterCategory, searchTerm]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Rule[]> = {};
    for (const r of filtered) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const categoryColors: Record<string, string> = {
    'Diezmo': 'bg-violet-100 text-violet-700',
    'Brand': 'bg-pink-100 text-pink-700',
    'Donativo': 'bg-green-100 text-green-700',
    'Viajes': 'bg-blue-100 text-blue-700',
    'Material': 'bg-orange-100 text-orange-700',
    'Retiros': 'bg-teal-100 text-teal-700',
    'Música': 'bg-indigo-100 text-indigo-700',
    'BAC': 'bg-cyan-100 text-cyan-700',
    'Stripe': 'bg-purple-100 text-purple-700',
    'Shopify': 'bg-lime-100 text-lime-700',
    'Comisión bancaria': 'bg-red-100 text-red-700',
    'Gastos Varios': 'bg-gray-100 text-gray-700',
  };

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/extracto" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={20} />
            </Link>
            <BookOpen size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Reglas de Etiquetado</h1>
              <p className="text-sm text-gray-500">Cuando el concepto contenga la palabra clave → asignar categoría</p>
            </div>
          </div>
          <span className="text-sm text-gray-500 font-medium">{rules.length} reglas</span>
        </div>

        {/* Add rule */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Añadir Regla</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Cuando contenga...</label>
              <input
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="ej: camiseta, thomann, retiro..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex-1 sm:flex-initial">
              <label className="text-xs text-gray-500 mb-1 block">Entonces es...</label>
              <input
                type="text"
                list="category-options"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Seleccionar o escribir nueva..."
                className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <datalist id="category-options">
                {allCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAdd}
                disabled={!newKeyword.trim() || !newCategory.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={16} /> Añadir
              </button>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar regla..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">Todas las categorías</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Rules grouped by category */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-violet-600" size={24} />
            <span className="ml-2 text-gray-500 text-sm">Cargando reglas...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([category, catRules]) => (
              <Card key={category}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
                      {category}
                    </span>
                    <span className="text-xs text-gray-400">{catRules.length} reglas</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {catRules.map(rule => {
                    const isEditingThis = editingRule?.keyword === rule.keyword;
                    return (
                      <div
                        key={rule.keyword}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors"
                      >
                        <span className="text-sm text-gray-700">&quot;{rule.keyword}&quot;</span>
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 ml-1">
                            <input
                              type="text"
                              list="edit-category-options"
                              value={editingRule.newCategory}
                              onChange={e => setEditingRule({ ...editingRule, newCategory: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleUpdateCategory(rule.keyword, editingRule.newCategory);
                                if (e.key === 'Escape') setEditingRule(null);
                              }}
                              autoFocus
                              className="w-28 px-1.5 py-0.5 text-xs border border-violet-300 rounded focus:ring-1 focus:ring-violet-500 focus:outline-none"
                            />
                            <datalist id="edit-category-options">
                              {allCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                            <button onClick={() => handleUpdateCategory(rule.keyword, editingRule.newCategory)} className="p-0.5 text-emerald-500 hover:text-emerald-700"><Check size={12} /></button>
                            <button onClick={() => setEditingRule(null)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => setEditingRule({ keyword: rule.keyword, newCategory: rule.category })}
                              className="p-0.5 text-gray-400 hover:text-violet-500"
                              title="Cambiar categoría"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(rule.keyword)}
                              className="p-0.5 text-gray-400 hover:text-red-500"
                              title="Eliminar regla"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
            {grouped.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                {searchTerm || filterCategory !== 'all' ? 'Sin resultados para este filtro' : 'No hay reglas. Añade la primera arriba.'}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
