'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICards from '@/components/dashboard/KPICards';
import RevenueChart from '@/components/dashboard/RevenueChart';
import OrdersChart from '@/components/dashboard/OrdersChart';
import TopProducts from '@/components/dashboard/TopProducts';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import RecentOrders from '@/components/dashboard/RecentOrders';
import { Card } from '@/components/ui/Card';
import { DateRange, KPIData, RevenueDataPoint, TopProduct, ProjectSummary, ShopifyOrder } from '@/lib/types';
import { getDateRanges, formatCurrency } from '@/lib/utils';
import { Loader2, ShoppingCart, CreditCard, Store, Church } from 'lucide-react';

export default function DashboardPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [recentOrders, setRecentOrders] = useState<ShopifyOrder[]>([]);
  const [incomeSources, setIncomeSources] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/dashboard?${params}`);
        if (!res.ok) throw new Error('Error al cargar datos');
        const data = await res.json();
        setKpi(data.kpi);
        setRevenueData(data.revenueData);
        setTopProducts(data.topProducts);
        setProjects(data.projects);
        setRecentOrders(data.recentOrders);
        setIncomeSources(data.incomeSources);
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando datos reales...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
            <p className="text-red-500 text-sm mt-1">Verifica las credenciales de Shopify en las variables de entorno.</p>
          </div>
        ) : (
          <>
            <KPICards data={kpi!} />

            {/* Income sources consolidated */}
            {incomeSources && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart size={14} className="text-blue-500" />
                    <p className="text-xs text-gray-500 font-medium">Shopify</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(incomeSources.shopify)}</p>
                </Card>
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={14} className="text-indigo-500" />
                    <p className="text-xs text-gray-500 font-medium">Stripe</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(incomeSources.stripe)}</p>
                </Card>
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <Store size={14} className="text-green-500" />
                    <p className="text-xs text-gray-500 font-medium">Presenciales</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(incomeSources.ventasPresenciales)}</p>
                </Card>
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <Church size={14} className="text-violet-500" />
                    <p className="text-xs text-gray-500 font-medium">Diezmos</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(incomeSources.diezmos)}</p>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart data={revenueData} />
              <OrdersChart data={revenueData} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TopProducts products={topProducts} />
              </div>
              <ProjectBreakdown projects={projects} />
            </div>
            <RecentOrders orders={recentOrders} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
