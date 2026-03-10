'use client';

import { Menu, Bell } from 'lucide-react';
import { DateRange } from '@/lib/types';
import DateRangePicker from '@/components/ui/DateRangePicker';

interface TopbarProps {
  onMenuClick: () => void;
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  hideRangeSelector?: boolean;
}

export default function Topbar({ onMenuClick, selectedRange, onRangeChange, hideRangeSelector }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 hidden sm:block">
            Semper Dashboard
          </h2>
        </div>

        {/* Right: Date selector + notifications */}
        <div className="flex items-center gap-3">
          {!hideRangeSelector && (
            <DateRangePicker
              selectedRange={selectedRange}
              onRangeChange={onRangeChange}
            />
          )}

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
