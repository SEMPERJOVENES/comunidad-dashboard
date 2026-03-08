'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { Settings, ShoppingBag, CreditCard, Link2, CheckCircle2, XCircle } from 'lucide-react';

export default function SettingsPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);

  const shopifyConnected = !!process.env.NEXT_PUBLIC_SHOPIFY_CONNECTED;
  const stripeConnected = !!process.env.NEXT_PUBLIC_STRIPE_CONNECTED;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
            <p className="text-sm text-gray-500">Administra conexiones e integraciones</p>
          </div>
        </div>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Integraciones</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {/* Shopify */}
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={22} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Shopify</h3>
                  <p className="text-xs text-gray-500">169523-e2.myshopify.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={shopifyConnected ? 'success' : 'warning'}>
                  {shopifyConnected ? 'Conectado' : 'Pendiente'}
                </Badge>
                <a
                  href="/api/auth/shopify?shop=169523-e2.myshopify.com"
                  className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                >
                  {shopifyConnected ? 'Reconectar' : 'Conectar'}
                </a>
              </div>
            </div>

            {/* Stripe */}
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                  <CreditCard size={22} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Stripe</h3>
                  <p className="text-xs text-gray-500">acct_1Q3yYyRojFhYIQW6</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={stripeConnected ? 'success' : 'warning'}>
                  {stripeConnected ? 'Conectado' : 'Pendiente'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la App</CardTitle>
          </CardHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Versión</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Organización</span>
              <span className="font-medium">Jóvenes Semper</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tienda</span>
              <span className="font-medium">Semper Brand</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
