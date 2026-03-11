'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDefaultRange } from '@/lib/utils';
import { DateRange, BankTransaction } from '@/lib/types';
import {
  Landmark, Upload, Search, Loader2, BookOpen, AlertCircle, List,
  TrendingUp, TrendingDown, ClipboardPaste, X, Check, FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExtractoPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'sin_clasificar'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  // Paste modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<{ date: string; concept: string; amount: string; balance: string }[]>([]);
  const [pasteError, setPasteError] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [selectedRange]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: selectedRange.startDate.toISOString(),
        end: selectedRange.endDate.toISOString(),
      });
      const res = await fetch(`/api/extracto?${params}`);
      const data = await res.json();
      setTransactions(data.transactions || []);

      // Extraer etiquetas únicas de las transacciones reales
      const txs: BankTransaction[] = data.transactions || [];
      const uniqueTags = new Set<string>();
      txs.forEach(tx => {
        const tag = tx.manualTag || tx.autoTag;
        if (tag) uniqueTags.add(tag);
      });
      setTagOptions(Array.from(uniqueTags).sort());
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
        setTransactions(prev => {
          const updated = prev.map(t => t.id === id ? data.transaction : t);
          // Recalcular etiquetas únicas
          const uniqueTags = new Set<string>();
          updated.forEach(tx => {
            const t = tx.manualTag || tx.autoTag;
            if (t) uniqueTags.add(t);
          });
          setTagOptions(Array.from(uniqueTags).sort());
          return updated;
        });
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
        const txns = rawData.map(row => {
          let dateVal = row[dateKey];
          if (dateVal instanceof Date) dateVal = `${dateVal.getFullYear()}-${String(dateVal.getMonth()+1).padStart(2,'0')}-${String(dateVal.getDate()).padStart(2,'0')}`;
          return { date: String(dateVal || ''), concept: String(row[conceptKey] || ''), amount: String(row[amountKey] || '0'), balance: String(row[balanceKey] || '0') };
        }).filter(tx => tx.concept.trim() !== '');
        await sendImport(txns);
        return;
      }

      const headers = allRows[headerRowIndex].map((h: any) => String(h).trim());
      const dateCol = headers.findIndex((h: string) => /fecha\s*(operaci|op)/i.test(h));
      const conceptCol = headers.findIndex((h: string) => /concepto/i.test(h));
      const amountCol = headers.findIndex((h: string) => /importe/i.test(h));
      const balanceCol = headers.findIndex((h: string) => /saldo/i.test(h));

      const dataRows = allRows.slice(headerRowIndex + 1);
      const txns = dataRows
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
      await sendImport(txns);
    } catch (err) {
      alert('Error al procesar el archivo Excel: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setImporting(false);
    }
  }

  // === PARSE SANTANDER PASTE FORMAT ===
  function parseSantanderPaste(text: string): { date: string; concept: string; amount: string; balance: string }[] {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results: { date: string; concept: string; amount: string; balance: string }[] = [];

    for (const line of lines) {
      // Saltar headers, metadata, líneas de texto puro
      if (/^(Fecha|FECHA|Movimientos|Cuenta|Saldo|Total|Divisa|CCC)/i.test(line)) continue;
      if (/^(Desde|Hasta|Selecciona|Descargar|Imprimir)/i.test(line)) continue;
      if (!/\d{2}\/\d{2}\/\d{4}/.test(line)) continue;

      // Split por tabulador
      const cols = line.split('\t');
      if (cols.length < 4) continue;

      // Buscar columna con fecha DD/MM/YYYY
      const dateMatch = cols[0]?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!dateMatch) continue;

      const date = cols[0].trim();
      // Concepto: puede estar en col 2 (si col 1 es fecha valor)
      // Formato Santander: FechaOp | FechaValor | Concepto | Importe | Divisa | Saldo | ...
      let conceptIdx = 2;
      let amountIdx = 3;
      let balanceIdx = 5;

      // Detectar si col[1] es fecha valor
      if (/\d{2}\/\d{2}\/\d{4}/.test(cols[1] || '')) {
        conceptIdx = 2;
        amountIdx = 3;
        balanceIdx = 5;
      } else {
        // Sin fecha valor: FechaOp | Concepto | Importe | Saldo
        conceptIdx = 1;
        amountIdx = 2;
        balanceIdx = 3;
      }

      const concept = (cols[conceptIdx] || '').trim();
      if (!concept) continue;

      // Parse importe español: -2,01 o 4.360,13
      const rawAmount = (cols[amountIdx] || '').trim();
      const rawBalance = (cols[balanceIdx] || '').trim();

      function parseSpanishNumber(str: string): number {
        if (!str) return 0;
        // Quitar espacios y símbolo de moneda
        const clean = str.replace(/[€\s]/g, '').trim();
        if (!clean) return 0;
        // Formato español: 1.234,56 → quitar puntos, coma→punto
        return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
      }

      const amount = parseSpanishNumber(rawAmount);
      const balance = parseSpanishNumber(rawBalance);

      // Solo añadir si hay importe válido (no 0 excepto si es literalmente 0)
      if (amount === 0 && !rawAmount.includes('0')) continue;

      results.push({ date, concept, amount: String(amount), balance: String(balance) });
    }

    return results;
  }

  function handlePastePreview() {
    setPasteError('');
    if (!pasteText.trim()) {
      setPasteError('Pega el contenido del extracto bancario');
      setPastePreview([]);
      return;
    }
    const parsed = parseSantanderPaste(pasteText);
    if (parsed.length === 0) {
      setPasteError('No se encontraron transacciones válidas en el texto pegado. Asegúrate de copiar las filas desde el extracto del banco.');
      setPastePreview([]);
      return;
    }
    setPastePreview(parsed);
  }

  async function handlePasteImport() {
    if (pastePreview.length === 0) return;
    setImporting(true);
    try {
      await sendImport(pastePreview);
      setShowPasteModal(false);
      setPasteText('');
      setPastePreview([]);
      setPasteError('');
    } finally {
      setImporting(false);
    }
  }

  async function sendImport(txns: { date: string; concept: string; amount: string; balance: string }[]) {
    if (txns.length === 0) { alert('No se encontraron transacciones'); return; }
    const res = await fetch('/api/extracto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', transactions: txns }),
    });
    const data = await res.json();
    if (res.ok) {
      const msg = data.skipped > 0
        ? `✅ Importadas ${data.imported} transacciones nuevas (${data.skipped} duplicadas ignoradas)`
        : `✅ Importadas ${data.imported} transacciones`;
      alert(msg);
      await fetchTransactions();
    } else {
      alert(`Error: ${data.error}`);
    }
  }

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const tag = tx.manualTag || tx.autoTag || '';
      if (activeTab === 'sin_clasificar' && tag) return false;
      if (filterCategory !== 'all') {
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
  }, [transactions, activeTab, filterCategory, searchTerm]);

  const ingresos = transactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const gastos = transactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const sinClasificar = transactions.filter(tx => !tx.autoTag && !tx.manualTag).length;
  const balance = ingresos - gastos;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* Header con título y acciones */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Landmark size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Extracto Bancario</h1>
              <p className="text-sm text-gray-500">Gestión y clasificación de movimientos</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/reglas" className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
              <BookOpen size={16} />
              <span className="hidden sm:inline">Reglas</span>
            </a>
            <button
              onClick={() => { setShowPasteModal(true); setPasteText(''); setPastePreview([]); setPasteError(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
            >
              <ClipboardPaste size={16} />
              <span className="hidden sm:inline">Pegar extracto</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
              <Upload size={16} />
              <span className="hidden sm:inline">Excel</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportExcel(file);
              }} />
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-green-500" />
              <p className="text-xs text-gray-500 font-medium">Ingresos</p>
            </div>
            <p className="text-lg sm:text-xl font-bold text-green-600 mt-1">{formatCurrency(ingresos)}</p>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-red-500" />
              <p className="text-xs text-gray-500 font-medium">Gastos</p>
            </div>
            <p className="text-lg sm:text-xl font-bold text-red-600 mt-1">{formatCurrency(gastos)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-gray-500 font-medium">Balance neto</p>
            <p className={`text-lg sm:text-xl font-bold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-gray-500 font-medium">Sin clasificar</p>
            <p className="text-lg sm:text-xl font-bold text-amber-600 mt-1">{sinClasificar}</p>
            <span className="text-xs text-gray-400">{transactions.length} movimientos</span>
          </Card>
        </div>

        {/* Quick Access Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 px-2 py-1 flex gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('all'); setFilterCategory('all'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-violet-50 text-violet-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <List size={15} />
            Todos
            <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600">
              {transactions.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('sin_clasificar'); setFilterCategory('all'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'sin_clasificar'
                ? 'bg-amber-50 text-amber-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AlertCircle size={15} />
            Sin clasificar
            {sinClasificar > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                {sinClasificar}
              </span>
            )}
          </button>
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
            <option value="all">Todas las etiquetas</option>
            <option value="sin_clasificar">Sin clasificar</option>
            {tagOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                          <div>
                            <p className="text-sm text-gray-900 break-words whitespace-normal">{tx.concept}</p>
                            {tx.memberName && <p className="text-xs text-gray-400">{tx.memberName}</p>}
                          </div>
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right text-sm font-semibold whitespace-nowrap ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right text-sm text-gray-500 whitespace-nowrap">
                          {formatCurrency(tx.balance)}
                        </td>
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
                              {tagOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                        {transactions.length === 0
                          ? 'Sin datos para este período. Importa o pega un extracto bancario para comenzar.'
                          : 'Sin resultados para este filtro'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500">
                  Mostrando {filtered.length} de {transactions.length} movimientos bancarios
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* === MODAL PEGAR EXTRACTO === */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPasteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <ClipboardPaste size={20} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Pegar extracto bancario</h2>
                  <p className="text-xs text-gray-500">Copia las filas del extracto de tu banco y pégalas aquí</p>
                </div>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Instructions */}
              <div className="bg-violet-50 rounded-lg p-3 text-xs text-violet-700 space-y-1">
                <p className="font-semibold">📋 Instrucciones:</p>
                <p>1. Abre tu banca online (Santander, BBVA, etc.)</p>
                <p>2. Selecciona las filas del extracto y copia (Ctrl+C)</p>
                <p>3. Pega aquí (Ctrl+V) — el sistema detecta duplicados automáticamente</p>
              </div>

              {/* Textarea */}
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPastePreview([]); setPasteError(''); }}
                placeholder="Pega aquí las filas copiadas del extracto bancario..."
                className="w-full h-40 p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono"
                autoFocus
              />

              {/* Preview button */}
              <button
                onClick={handlePastePreview}
                className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                Previsualizar ({pasteText.split('\n').filter(l => l.trim()).length} líneas)
              </button>

              {/* Error */}
              {pasteError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {pasteError}
                </div>
              )}

              {/* Preview table */}
              {pastePreview.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      ✅ {pastePreview.length} transacciones detectadas
                    </p>
                    <span className="text-xs text-gray-400">Las duplicadas se ignorarán al importar</span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Fecha</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Concepto</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Importe</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastePreview.slice(0, 20).map((tx, i) => {
                          const amt = parseFloat(tx.amount);
                          return (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">{tx.date}</td>
                              <td className="px-3 py-1.5 text-xs text-gray-900 truncate max-w-[200px]">{tx.concept}</td>
                              <td className={`px-3 py-1.5 text-xs text-right font-medium whitespace-nowrap ${amt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {amt >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)}€
                              </td>
                              <td className="px-3 py-1.5 text-xs text-right text-gray-500 whitespace-nowrap">
                                {parseFloat(tx.balance).toFixed(2)}€
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {pastePreview.length > 20 && (
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-400 text-center">
                        y {pastePreview.length - 20} transacciones más...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {pastePreview.length > 0 && (
              <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasteImport}
                  disabled={importing}
                  className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <><Loader2 size={16} className="animate-spin" /> Importando...</>
                  ) : (
                    <><Check size={16} /> Importar {pastePreview.length} transacciones</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
