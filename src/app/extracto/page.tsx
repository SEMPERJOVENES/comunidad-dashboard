'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, BankTransaction } from '@/lib/types';
import { Landmark, Upload, Search, Loader2, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';

const TAG_OPTIONS = [
  'Diezmo', 'Merch', 'Donativo', 'Misa/Tabor', 'Retiros',
  'Viajes', 'Material', 'Música', 'Semper CD', 'BAC',
  'Gastos Varios', 'Stripe', 'Shopify', 'Bizum', 'Transferencia',
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
  const [importing, setImporting] = useState(false);

  useEffect(() => { fetchTransactions(); }, []);

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
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(20, allRows.length); i++) {
        const row = allRows[i].map((c: any) => String(c).toLowerCase());
        if (row.some((c: string) => /fecha/.test(c)) && row.some((c: string) => /concepto/.test(c)) && row.some((c: string) => /importe/.test(c))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rawData.length === 0) { alert('El archivo no contiene datos reconocibles'); setImporting(false); return; }
        const keys = Object.keys(rawData[0]);
        const dateKey = keys.find(k => /fecha|date/i.test(k)) || keys[0];
        const conceptKey = keys.find(k => /concepto|descripci/i.test(k)) || keys[1];
        const amountKey = keys.find(k => /importe|amount/i.test(k)) || keys[2];
        const balanceKey = keys.find(k => /saldo|balance/i.test(k)) || keys[3];
        const transactions = rawData.map(row => {
          let dateVal = row[dateKey];
          if (dateVal instanceof Date) dateVal = `${dateVal.getFullYear()}-${String(dateVal.getMonth()+1).padStart(2,'0')}-${String(dateVal.getDate()).padStart(2,'0')}`;
          return { date: String(dateVal || ''), concept: String(row[conceptKey] || ''), amount: String(row[amountKey] || '0'), balance: String(row[balanceKey] || '0') };
        }).filter(tx => tx.concept.trim() !== '');
        await sendImport(transactions);
        return;
      }

      const headers = allRows[headerRowIndex].map((h: any) => String(h).trim());
      const dateCol = headers.findIndex((h: string) => /fecha\s*(operaci|op)/i.test(h));
      const conceptCol = headers.findIndex((h: string) => /concepto/i.test(h));
      const amountCol = headers.findIndex((h: string) => /importe/i.test(h));
      const balanceCol = headers.findIndex((h: string) => /saldo/i.test(h));

      const dataRows = allRows.slice(headerRowIndex + 1);
      const transactions = dataRows
        .filter(row => String(row[conceptCol >= 0 ? conceptCol : 2] || '').trim() !== '' && row[dateCol >= 0 ? dateCol : 0] !== '')
        .map(row => {
          let dateVal = row[dateCol >= 0 ? dateCol : 0];
          if (dateVal instanceof Date) dateVal = `${dateVal.getFullYear()}-${String(dateVal.getMonth()+1).padStart(2,'0')}-${String(dateVal.getDate()).padStart(2,'0')}`;
          const rawAmount = row[amountCol >= 0 ? amountCol : 3];
          const rawBalance = row[balanceCol >= 0 ? balanceCol : 5];
          const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/\./g, '').replace(',', '.')) || 0;
          const balance = typeof rawBalance === 'number' ? rawBalance : parseFloat(String(rawBalance).replace(/\./g, '').replace(',', '.')) || 0;
          return { date: String(dateVal || ''), concept: String(row[conceptCol >= 0 ? conceptCol : 2] || ''), amount: String(amount), balance: String(balance) };
        });
      await sendImport(transactions);
    } catch (err) {
      alert('Error al procesar el archivo Excel: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setImporting(false);
    }
  }

  async function sendImport(transactions: { date: string; concept: string; amount: string; balance: string }[]) {
    if (transactions.length === 0) { alert('No se encontraron transacciones en el archivo'); return; }
    const res = await fetch('/api/extracto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', transactions }),
    });
    const data = await res.json();
    if (res.ok) { alert(`✅ Importadas ${data.imported} transacciones`); await fetchTransactions(); }
    else alert(`Error: ${data.error}`);
  }

  const filtered = transactions.filter(tx => {
    if (filterCategory !== 'all') {
      const tag = tx.manualTag || tx.autoTag || '';
      if (filterCategory === 'sin_clasificar') { if (tag) return false; }
      else if (!tag.toLowerCase().includes(filterCategory.toLowerCase())) return false;
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
              <p className="text-sm text-gray-500">Gestión y clasificación de movimientos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/reglas" className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
              <BookOpen size={16} />
              Reglas
            </a>
            <label className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors cursor-pointer">
              <Upload size={16} />
              Importar Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportExcel(file);
              }} />
            </label>
          </div>
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
            <input type="text" placeholder="Buscar por concepto, nombre..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="all">Todas las categorías</option>
            <option value="sin_clasificar">Sin clasificar</option>
            {TAG_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* Transactions table - DIRECT TAG EDITING */}
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
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-24">Fecha</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Concepto</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-28">Importe</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-28">Saldo</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-40">Etiqueta</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => {
                    const tag = tx.manualTag || tx.autoTag;
                    const isEditing = editingId === tx.id;
                    return (
                      <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="px-4 sm:px-6 py-3">
                          <p className="text-sm text-gray-900 break-words whitespace-normal">{tx.concept}</p>
                          {tx.memberName && <p className="text-xs text-gray-400">{tx.memberName}</p>}
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right text-sm font-semibold whitespace-nowrap ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-500 whitespace-nowrap">{formatCurrency(tx.balance)}</td>
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
                              {TAG_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingId(tx.id)}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              title="Clic para cambiar etiqueta"
                            >
                              {tag ? (
                                <Badge variant={tx.autoTag && !tx.manualTag ? 'info' : 'purple'}>
                                  {tx.autoTag && !tx.manualTag ? `🤖 ${tag}` : tag}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400 hover:text-violet-500 px-2 py-1 border border-dashed border-gray-300 rounded-full hover:border-violet-400 transition-colors">
                                  + Etiquetar
                                </span>
                              )}
                            </button>
                          )}
                          {tx.isDiezmo && <span className="ml-1 text-xs text-violet-600 font-medium">⛪</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                        {transactions.length === 0 ? 'Importa un extracto bancario para comenzar' : 'Sin resultados para este filtro'}
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
