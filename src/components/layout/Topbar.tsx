'use client';

import { Menu, Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getDateRanges } from '@/lib/utils';
import { DateRange } from '@/lib/types';

interface TopbarProps {
  onMenuClick: () => void;
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export default function Topbar({ onMenuClick, selectedRange, onRangeChange }: TopbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const ranges = getDateRanges();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 hidden sm:block">
            Semper Dashboard
          </h2>
        </div>

        {/* Right: Date selector + notifications */}
        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="hidden sm:inline">{selectedRange.label}</span>
              <span className="sm:hidden text-xs">{selectedRange.label}</span>
              <ChevronDown size={14} />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {ranges.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => {
                        onRangeChange(range);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                        selectedRange.label === range.label
                          ? 'bg-violet-50 text-violet-700 font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

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
