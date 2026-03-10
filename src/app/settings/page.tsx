'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { Settings, ShoppingBag, CreditCard, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [shopifyOk, setShopifyOk] = useState<boolean | null>(null);
  const [stripeOk, setStripeOk] = useState<boolean | null>(null);

  useEffect(() => {
    // Test Shopify connection
    fetch('/api/shopify/products')
      .then((r) => setShopifyOk(r.ok))
      .catch(() => setShopifyOk(false));
    // Test Stripe connection
    fetch('/api/stripe?days=1')
      .then((r) => setStripeOk(r.ok))
      .catch(() => setStripeOk(false));
  }, []);

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
                {shopifyOk === null ? (
                  <Loader2 className="animate-spin text-gray-400" size={16} />
                ) : (
                  <Badge variant={shopifyOk ? 'success' : 'danger'}>
                    {shopifyOk ? 'Conectado' : 'Error'}
                  </Badge>
                )}
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
                {stripeOk === null ? (
                  <Loader2 className="animate-spin text-gray-400" size={16} />
                ) : (
                  <Badge variant={stripeOk ? 'success' : 'danger'}>
                    {stripeOk ? 'Conectado' : 'Error'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

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
            <div className="flex justify-between">
              <span className="text-gray-500">Fuente de datos</span>
              <span className="font-medium text-green-600">Datos reales (API en vivo)</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
