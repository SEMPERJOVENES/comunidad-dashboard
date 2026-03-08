'use client';

import { DollarSign, ShoppingCart, TrendingUp, RotateCcw, Users, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatNumber, formatPercent, cn } from '@/lib/utils';
import { KPIData } from '@/lib/types';

interface KPICardsProps {
  data: KPIData;
}

export default function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: 'Revenue Total',
      value: formatCurrency(data.totalRevenue),
      change: data.revenueChange,
      icon: DollarSign,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Órdenes',
      value: formatNumber(data.totalOrders),
      change: data.ordersChange,
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Ticket Medio (AOV)',
      value: formatCurrency(data.averageOrderValue),
      change: null,
      icon: TrendingUp,
      color: 'text-violet-600 bg-violet-100',
    },
    {
      label: 'Tasa Reembolso',
      value: `${data.refundRate.toFixed(1)}%`,
      change: null,
      icon: RotateCcw,
      color: data.refundRate > 5 ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100',
    },
    {
      label: 'Clientes Nuevos',
      value: formatNumber(data.newCustomers),
      change: null,
      icon: UserPlus,
      color: 'text-emerald-600 bg-emerald-100',
    },
    {
      label: 'Recurrentes',
      value: formatNumber(data.returningCustomers),
      change: null,
      icon: Users,
      color: 'text-amber-600 bg-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium truncate">{card.label}</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1 truncate">
                {card.value}
              </p>
              {card.change !== null && (
                <p
                  className={cn(
                    'text-xs font-medium mt-1',
                    card.change >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatPercent(card.change)} vs anterior
                </p>
              )}
            </div>
            <div className={cn('p-2 rounded-lg flex-shrink-0', card.color)}>
              <card.icon size={16} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
