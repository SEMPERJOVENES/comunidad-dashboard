'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICards from '@/components/dashboard/KPICards';
import RevenueChart from '@/components/dashboard/RevenueChart';
import OrdersChart from '@/components/dashboard/OrdersChart';
import TopProducts from '@/components/dashboard/TopProducts';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import RecentOrders from '@/components/dashboard/RecentOrders';
import { DateRange } from '@/lib/types';
import { getDateRanges } from '@/lib/utils';
import {
  demoKPI,
  demoRevenueData,
  demoTopProducts,
  demoProjects,
  demoRecentOrders,
} from '@/lib/demo-data';

export default function DashboardPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]); // Últimos 30 días

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        {/* KPIs */}
        <KPICards data={demoKPI} />

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={demoRevenueData} />
          <OrdersChart data={demoRevenueData} />
        </div>

        {/* Products + Projects row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TopProducts products={demoTopProducts} />
          </div>
          <ProjectBreakdown projects={demoProjects} />
        </div>

        {/* Recent Orders */}
        <RecentOrders orders={demoRecentOrders} />
      </div>
    </DashboardLayout>
  );
}
