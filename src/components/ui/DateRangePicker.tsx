'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from '@/lib/types';

interface DateRangePickerProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}

const quickRanges = [
  { label: 'Hoy', getRange: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
  { label: 'Ayer', getRange: () => ({ start: startOfDay(subDays(new Date(), 1)), end: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Este mes', getRange: () => ({ start: startOfMonth(new Date()), end: endOfDay(new Date()) }) },
  { label: 'Mes anterior', getRange: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 meses', getRange: () => ({ start: startOfDay(subMonths(new Date(), 3)), end: endOfDay(new Date()) }) },
  { label: 'Últimos 6 meses', getRange: () => ({ start: startOfDay(subMonths(new Date(), 6)), end: endOfDay(new Date()) }) },
  { label: 'Este año', getRange: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: endOfDay(new Date()) }) },
  { label: 'Desde siempre', getRange: () => ({ start: new Date(2020, 0, 1), end: endOfDay(new Date()) }) },
];

export default function DateRangePicker({ selectedRange, onRangeChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync inputs con el rango seleccionado
  useEffect(() => {
    setStartInput(format(selectedRange.startDate, 'yyyy-MM-dd'));
    setEndInput(format(selectedRange.endDate, 'yyyy-MM-dd'));
  }, [selectedRange]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function applyQuickRange(qr: typeof quickRanges[0]) {
    const { start, end } = qr.getRange();
    onRangeChange({ label: qr.label, startDate: start, endDate: end });
    setIsOpen(false);
  }

  function applyCustomRange() {
    const start = new Date(startInput);
    const end = new Date(endInput);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (start > end) return;

    const label = `${format(start, 'dd/MM/yy')} — ${format(end, 'dd/MM/yy')}`;
    onRangeChange({ label, startDate: startOfDay(start), endDate: endOfDay(end) });
    setIsOpen(false);
  }

  // Texto a mostrar en el botón
  const displayLabel = selectedRange.label.length > 20
    ? `${format(selectedRange.startDate, 'dd MMM', { locale: es })} — ${format(selectedRange.endDate, 'dd MMM yy', { locale: es })}`
    : selectedRange.label;

  return (
    <div ref={containerRef} className="relative">
      {/* Botón principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Calendar size={14} className="text-gray-500 shrink-0" />
        <span className="text-xs sm:text-sm whitespace-nowrap">{displayLabel}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay móvil */}
          <div className="fixed inset-0 z-10 sm:hidden" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-xl w-[300px] sm:w-[340px] overflow-hidden">
            {/* Header con inputs de fecha */}
            <div className="p-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Desde</label>
                  <input
                    type="date"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                  />
                </div>
                <span className="text-gray-300 mt-4">→</span>
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Hasta</label>
                  <input
                    type="date"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                  />
                </div>
              </div>
              <button
                onClick={applyCustomRange}
                className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Aplicar rango
              </button>
            </div>

            {/* Selecciones rápidas */}
            <div className="p-1.5">
              <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Selección rápida
              </p>
              <div className="grid grid-cols-2 gap-0.5">
                {quickRanges.map((qr) => {
                  const isActive = selectedRange.label === qr.label;
                  return (
                    <button
                      key={qr.label}
                      onClick={() => applyQuickRange(qr)}
                      className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-violet-50 text-violet-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {qr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
