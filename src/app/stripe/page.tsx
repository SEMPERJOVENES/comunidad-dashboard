'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { CreditCard, TrendingUp, ArrowUpRight, Loader2, CheckCircle } from 'lucide-react';

interface StripeCharge {
  id: string;
  amount: number;
  status: string;
  created: string;
  paid: boolean;
  refunded: boolean;
  disputed: boolean;
  customerName: string | null;
  customerEmail: string | null;
  description: string | null;
}

interface StripeData {
  balance: { available: number; pending: number; currency: string };
  payouts: { id: string; amount: number; status: string; arrival_date: string; created: string }[];
  charges: StripeCharge[];
  volume: { volume: number; count: number; refunded: number; disputed: number };
}

export default function StripePage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StripeData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/stripe?${params}`);
        if (!res.ok) throw new Error('Error al cargar datos de Stripe');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stripe</h1>
            <p className="text-sm text-gray-500">Pagos y balances en tiempo real</p>
          </div>
        </div>

        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Stripe conectado</p>
              <p className="text-xs text-green-600 mt-0.5">Datos en tiempo real</p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando datos de Stripe...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        ) : data ? (
          <>
            {/* Balance cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs text-gray-500 font-medium">Balance Disponible</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(data.balance.available)}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Balance Pendiente</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(data.balance.pending)}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Volumen del Mes</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(data.volume.volume)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{data.volume.count} cobros</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Neto Estimado</p>
                <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(data.balance.available + data.balance.pending)}</p>
                <p className="text-xs text-gray-400 mt-0.5">disponible + pendiente</p>
              </Card>
            </div>

            {/* Recent payouts */}
            <Card>
              <CardHeader>
                <CardTitle>Últimos Payouts</CardTitle>
              </CardHeader>
              {data.payouts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin payouts recientes</p>
              ) : (
                <div className="space-y-3">
                  {data.payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-900">{formatDate(payout.arrival_date)}</p>
                        <p className="text-xs text-gray-400">{payout.id.slice(0, 18)}...</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={payout.status === 'paid' ? 'success' : payout.status === 'pending' ? 'warning' : 'default'}>
                          {payout.status}
                        </Badge>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(payout.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent charges - WITH customer names */}
            <Card>
              <CardHeader>
                <CardTitle>Últimos Cobros</CardTitle>
              </CardHeader>
              {data.charges.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin cobros recientes</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Fecha</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Cliente</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Monto</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.charges.slice(0, 20).map((charge) => (
                        <tr key={charge.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-500">{formatDate(charge.created)}</td>
                          <td className="px-4 py-2">
                            <p className="text-sm font-medium text-gray-900">{charge.customerName || 'Anónimo'}</p>
                            {charge.customerEmail && charge.customerEmail !== charge.customerName && (
                              <p className="text-xs text-gray-400">{charge.customerEmail}</p>
                            )}
                            {charge.description && (
                              <p className="text-xs text-gray-400">{charge.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-right">{formatCurrency(charge.amount)}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge variant={charge.paid ? 'success' : charge.refunded ? 'danger' : 'warning'}>
                              {charge.refunded ? 'Reembolsado' : charge.paid ? 'Pagado' : 'Pendiente'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
