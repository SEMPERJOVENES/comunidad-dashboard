'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';

export default function StripePage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stripe</h1>
            <p className="text-sm text-gray-500">Pagos y balances de Stripe</p>
          </div>
        </div>

        {/* Status banner */}
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Conexión Stripe pendiente</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Agrega tu clave secreta de Stripe (sk_live_... o sk_test_...) en las variables de entorno para activar la integración.
              </p>
            </div>
          </div>
        </Card>

        {/* Demo data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Balance Disponible</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(12450.30)}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp size={16} className="text-green-600" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Balance Pendiente</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(3280.00)}</p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg">
                <ArrowUpRight size={16} className="text-amber-600" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Volumen del Mes</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(47832.50)}</p>
              </div>
              <div className="p-2 bg-violet-100 rounded-lg">
                <CreditCard size={16} className="text-violet-600" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Disputas</p>
                <p className="text-xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg">
                <ArrowDownRight size={16} className="text-gray-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos Payouts</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {[
              { date: '06 Mar 2026', amount: 4250.00, status: 'paid' },
              { date: '28 Feb 2026', amount: 3890.50, status: 'paid' },
              { date: '21 Feb 2026', amount: 5120.00, status: 'paid' },
              { date: '14 Feb 2026', amount: 2980.75, status: 'paid' },
              { date: '07 Feb 2026', amount: 4560.30, status: 'paid' },
            ].map((payout, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-900">{payout.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success">{payout.status}</Badge>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(payout.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
