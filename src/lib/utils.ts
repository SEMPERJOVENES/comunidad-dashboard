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
      label: 'Últimos 7 días',
      startDate: startOfDay(subDays(now, 7)),
      endDate: endOfDay(now),
    },
    {
      label: 'Últimos 30 días',
      startDate: startOfDay(subDays(now, 30)),
      endDate: endOfDay(now),
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
  ];
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    refunded: 'bg-red-100 text-red-800',
    partially_refunded: 'bg-orange-100 text-orange-800',
    voided: 'bg-gray-100 text-gray-800',
    authorized: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getFulfillmentColor(status: string | null): string {
  if (!status) return 'bg-gray-100 text-gray-800';
  const colors: Record<string, string> = {
    fulfilled: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unfulfilled: 'bg-red-100 text-red-800',
    restocked: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

const PROJECT_COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#6366F1', '#14B8A6',
  '#F97316', '#8B5CF6', '#06B6D4', '#84CC16',
];

export function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}
