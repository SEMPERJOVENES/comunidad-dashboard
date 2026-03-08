'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { DateRange } from '@/lib/types';
import { getDateRanges } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export default function DashboardLayout({ children, selectedRange, onRangeChange }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          selectedRange={selectedRange}
          onRangeChange={onRangeChange}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
