'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, BankTransaction } from '@/lib/types';
import { Landmark, Upload, Tag, Search, Loader2, Check, Filter } from 'lucide-react';

const TAG_OPTIONS = [
  'Stripe', 'Shopify', 'Bizum', 'Transferencia', 'Diezmo',
  'Comisión bancaria', 'Venta presencial', 'Gasto operativo',
  'Nómina', 'Alquiler', 'Proveedor', 'Otro',
];

export default function ExtractoPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const res = await fetch('/api/extracto');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualTag(id: string, tag: string, isDiezmo?: boolean) {
    try {
      const res = await fetch('/api/extracto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tag', id, manualTag: tag, isDiezmo }),
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(txs => txs.map(t => t.id === id ? data.transaction : t));
        setEditingId(null);
      }
    } catch {}
  }

  async function handleImportExcel(file: File) {
    // Parse Excel manually - for now, import as JSON data
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // The user will need to provide parsed data or we parse it server-side
        // For now, demonstrate with a simple JSON upload
        const text = e.target?.result as string;
        alert('Para importar el extracto, sube el archivo Excel. La importación automática desde Santander se procesará aquí.');
      } catch {}
    };
    reader.readAsText(file);
  }

  const filtered = transactions.filter(tx => {
    if (filterCategory !== 'all') {
      const tag = tx.manualTag || tx.autoTag || '';
      if (filterCategory === 'sin_clasificar') {
        if (tag) return false;
      } else if (!tag.toLowerCase().includes(filterCategory.toLowerCase())) {
        return false;
      }
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (tx.concept || '').toLowerCase().includes(search) ||
        (tx.memberName || '').toLowerCase().includes(search) ||
        (tx.manualTag || '').toLowerCase().includes(search);
    }
    return true;
  });

  const ingresos = transactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const gastos = transactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const sinClasificar = transactions.filter(tx => !tx.autoTag && !tx.manualTag).length;
  const diezmoTotal = transactions.filter(tx => tx.isDiezmo || tx.manualTag === 'Diezmo' || tx.autoTag === 'Diezmo')
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Landmark size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Extracto Bancario</h1>
              <p className="text-sm text-gray-500">Gestión y clasificación de movimientos bancarios</p>
            </div>
          </div>
          <label className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors cursor-pointer">
            <Upload size={16} />
            Importar Excel
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportExcel(file);
            }} />
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500 font-medium">Ingresos</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(ingresos)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Gastos</p>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(gastos)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Diezmos (banco)</p>
            <p className="text-xl font-bold text-violet-600 mt-1">{formatCurrency(diezmoTotal)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 font-medium">Sin Clasificar</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{sinClasificar}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por concepto, nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">Todas las categorías</option>
            <option value="sin_clasificar">Sin clasificar</option>
            <option value="Stripe">Stripe</option>
            <option value="Bizum">Bizum</option>
            <option value="Diezmo">Diezmo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Comisión">Comisión</option>
          </select>
        </div>

        {/* Transactions table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <span className="ml-2 text-gray-500 text-sm">Cargando extracto...</span>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fecha</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Concepto</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Importe</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Saldo</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Etiqueta</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => {
                    const tag = tx.manualTag || tx.autoTag;
                    const isEditing = editingId === tx.id;
                    return (
                      <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDate(tx.date)}</td>
                        <td className="px-4 sm:px-6 py-3">
                          <p className="text-sm text-gray-900 truncate max-w-[250px]">{tx.concept}</p>
                          {tx.memberName && <p className="text-xs text-gray-400">{tx.memberName}</p>}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-500">{formatCurrency(tx.balance)}</td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          {isEditing ? (
                            <select
                              autoFocus
                              defaultValue={tag || ''}
                              onChange={(e) => {
                                const isDiezmo = e.target.value === 'Diezmo';
                                handleManualTag(tx.id, e.target.value, isDiezmo);
                              }}
                              onBlur={() => setEditingId(null)}
                              className="text-xs px-2 py-1 border border-violet-300 rounded focus:ring-2 focus:ring-violet-500"
                            >
                              <option value="">Sin etiqueta</option>
                              {TAG_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : tag ? (
                            <Badge variant={tx.autoTag && !tx.manualTag ? 'info' : 'purple'}>
                              {tx.autoTag && !tx.manualTag ? `🤖 ${tag}` : tag}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-center">
                          <button
                            onClick={() => setEditingId(isEditing ? null : tx.id)}
                            className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors"
                            title="Etiquetar"
                          >
                            <Tag size={14} />
                          </button>
                          {tx.isDiezmo && (
                            <span className="ml-1 text-xs text-violet-600 font-medium">⛪</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                        {transactions.length === 0
                          ? 'Importa un extracto bancario para comenzar'
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
