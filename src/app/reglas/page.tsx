'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { BookOpen, Plus, Trash2, Search, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = [
  'Diezmo', 'Merch', 'Donativo', 'Misa/Tabor', 'Retiros',
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('Diezmo');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => { fetchRules(); }, []);

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

  async function handleAdd() {
    if (!newKeyword.trim()) return;
    const res = await fetch('/api/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', keyword: newKeyword, category: newCategory }),
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
    'Merch': 'bg-pink-100 text-pink-700',
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
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Entonces es...</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAdd}
                disabled={!newKeyword.trim()}
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
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                  {catRules.map(rule => (
                    <div
                      key={rule.keyword}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-red-200 transition-colors"
                    >
                      <span className="text-sm text-gray-700">"{rule.keyword}"</span>
                      <button
                        onClick={() => handleDelete(rule.keyword)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all"
                        title="Eliminar regla"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
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
