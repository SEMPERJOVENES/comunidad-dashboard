import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from './types';

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-ES').format(num);
}

export function formatPercent(num: number): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: es });
}

export function getDateRanges(): DateRange[] {
  const now = new Date();
  return [
    {
      label: 'Hoy',
      startDate: startOfDay(now),
      endDate: endOfDay(now),
    },
    {
      label: 'Ayer',
      startDate: startOfDay(subDays(now, 1)),
      endDate: endOfDay(subDays(now, 1)),
    },
    {
      label: 'Este mes',
      startDate: startOfMonth(now),
      endDate: endOfDay(now),
    },
    {
      label: 'Mes anterior',
      startDate: startOfMonth(subMonths(now, 1)),
      endDate: endOfMonth(subMonths(now, 1)),
    },
    {
      label: 'Últimos 3 meses',
      startDate: startOfDay(subMonths(now, 3)),
      endDate: endOfDay(now),
    },
    {
      label: 'Últimos 6 meses',
      startDate: startOfDay(subMonths(now, 6)),
      endDate: endOfDay(now),
    },
    {
      label: 'Este año',
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: endOfDay(now),
    },
    {
      label: 'Desde siempre',
      startDate: new Date(2020, 0, 1),
      endDate: endOfDay(now),
    },
  ];
}

// Helper para obtener un rango por defecto por nombre (evitar índices hardcodeados)
export function getDefaultRange(label: string = 'Últimos 3 meses'): DateRange {
  const ranges = getDateRanges();
  return ranges.find(r => r.label === label) || ranges[4]; // fallback: últimos 3 meses
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Parser de importes robusto: detecta automáticamente si el separador decimal
 * es "." o "," y NO confunde miles con decimales.
 *
 * Soporta: 1.351,92 (ES) · 1,351.92 (US) · 1351.92 · 1351,92 · 1.234 (miles ES)
 * · 1,234 (miles US) · 300 · -1.351,92 · (1.351,92) · "1.234,56 €".
 *
 * Regla: si aparecen los dos separadores, el ÚLTIMO es el decimal y el otro
 * son miles. Si solo aparece uno, es decimal cuando va seguido de 1 o 2 dígitos
 * (convención bancaria de 2 decimales); con 3 dígitos o si aparece más de una
 * vez se trata como separador de miles.
 *
 * Origen: incidente 2026-06-24 (extracto SEMPER subido con punto decimal y
 * parseado como si fuera miles → importes x100/x10). Ver LESSONS.md.
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw ?? '').trim();
  if (!s) return 0;
  // Negativo: signo "-" o paréntesis contable "(1.234,56)"
  const negative = /-/.test(s) || /^\(.*\)$/.test(s);
  // Dejar solo dígitos, "." y ","
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart: string;
  let decPart: string;

  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos presentes: el que va más a la derecha es el decimal
    const decIdx = Math.max(lastDot, lastComma);
    intPart = s.slice(0, decIdx).replace(/[.,]/g, '');
    decPart = s.slice(decIdx + 1).replace(/[.,]/g, '');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const sepIdx = lastDot !== -1 ? lastDot : lastComma;
    const occurrences = s.split(sep).length - 1;
    const digitsAfter = s.length - sepIdx - 1;
    if (occurrences === 1 && (digitsAfter === 1 || digitsAfter === 2)) {
      // Decimal (1 o 2 dígitos detrás)
      intPart = s.slice(0, sepIdx);
      decPart = s.slice(sepIdx + 1);
    } else {
      // Separador de miles (3 dígitos detrás o más de una aparición)
      intPart = s.replace(/[.,]/g, '');
      decPart = '';
    }
  } else {
    intPart = s;
    decPart = '';
  }

  const num = parseFloat(`${intPart || '0'}.${decPart || '0'}`);
  if (!Number.isFinite(num)) return 0;
  return negative ? -Math.abs(num) : num;
}

