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

