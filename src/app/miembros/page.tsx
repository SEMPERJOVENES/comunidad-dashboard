'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { DateRange } from '@/lib/types';
import { getDefaultRange } from '@/lib/utils';
import { Loader2, Users, Church, Cake } from 'lucide-react';
import { getBirthdaysThisMonth } from '@/lib/birthdays';

interface Member {
  id: string;
  name: string;
  community: string;
  isActive: boolean;
  paidPrevMonth: boolean;
  paidCurrentMonth: boolean;
}

const COMUNIDADES_ORDER = ['San Martín', 'San Ignacio', 'San Pablo', 'Colaboradores'];

const COMMUNITY_STYLES: Record<string, { bg: string; text: string; headerBg: string; bar: string; dot: string }> = {
  'San Martín':  { bg: 'bg-orange-50',  text: 'text-orange-600', headerBg: 'bg-orange-100',  bar: 'bg-orange-500',  dot: 'bg-orange-400' },
  'San Ignacio': { bg: 'bg-green-50',   text: 'text-green-600',  headerBg: 'bg-green-100',   bar: 'bg-green-500',   dot: 'bg-green-400'  },
  'San Pablo':   { bg: 'bg-blue-50',    text: 'text-blue-600',   headerBg: 'bg-blue-100',    bar: 'bg-blue-500',    dot: 'bg-blue-400'   },
  'Colaboradores': { bg: 'bg-purple-50', text: 'text-purple-600', headerBg: 'bg-purple-100', bar: 'bg-purple-500', dot: 'bg-purple-400' },
};

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

export default function MiembrosPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultRange('Últimos 3 meses'));
  const [members, setMembers] = useState<Member[]>([]);
  const [prevMonth, setPrevMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const birthdaysThisMonth = useMemo(() => getBirthdaysThisMonth(), []);

  useEffect(() => {
    setLoading(true);
    fetch('/api/miembros')
      .then(r => r.json())
      .then(json => {
        setMembers(json.members || []);
        setPrevMonth(json.prevMonth || '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    return COMUNIDADES_ORDER.map(comunidad => {
      const list = members.filter(m => m.community === comunidad);
      const paying = list.filter(m => m.isActive);
      const notPaying = list.filter(m => !m.isActive);
      const pct = list.length > 0 ? Math.round((paying.length / list.length) * 100) : 0;
      return { comunidad, list, paying, notPaying, pct };
    }).filter(g => g.list.length > 0);
  }, [members]);

  const totals = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.isActive).length,
  }), [members]);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange} hideRangeSelector>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <Users size={22} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Miembros</h1>
              <p className="text-sm text-gray-500">Verde = da diezmo · Rojo = no da diezmo</p>
            </div>
          </div>
          {!loading && (
            <div className="flex items-center gap-4 text-xs bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <p className="text-gray-400 uppercase text-[10px]">Total</p>
                <p className="font-bold text-gray-900">{totals.total}</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <p className="text-gray-400 uppercase text-[10px]">Dan diezmo</p>
                <p className="font-bold text-green-600">{totals.active}</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div>
                <p className="text-gray-400 uppercase text-[10px]">No dan</p>
                <p className="font-bold text-red-500">{totals.total - totals.active}</p>
              </div>
            </div>
          )}
        </div>

        {/* Birthday widget */}
        {birthdaysThisMonth.length > 0 && (
          <Card className="!p-4 border-l-4 border-l-amber-400 bg-amber-50">
            <div className="flex items-center gap-2 mb-3">
              <Cake size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-amber-800">
                Cumpleaños este mes ({birthdaysThisMonth.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {birthdaysThisMonth.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                  <Cake size={11} className="text-amber-400" />
                  {b.name}
                  <span className="text-amber-400 font-normal">{b.day} {MONTHS_SHORT[b.month - 1]}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando miembros...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prevMonth && (
              <p className="text-xs text-gray-400 text-right">
                Estado diezmos: <span className="font-medium">{formatMonthLabel(prevMonth)}</span>
              </p>
            )}
            {grouped.map(({ comunidad, list, paying, notPaying, pct }) => {
              const style = COMMUNITY_STYLES[comunidad] || COMMUNITY_STYLES['Colaboradores'];
              return (
                <Card key={comunidad} className="!p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.headerBg}`}>
                        <Church size={15} className={style.text} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{comunidad}</h3>
                        <p className="text-[10px] text-gray-400">{list.length} miembros</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {paying.length}/{list.length}
                      </p>
                      <p className="text-[10px] text-gray-400">{pct}% dan diezmo</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>

                  {/* Member chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {paying.map(m => {
                      const hasBirthday = birthdaysThisMonth.some(b => b.name === m.name);
                      return (
                        <span key={m.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 ${hasBirthday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                          {hasBirthday && <Cake size={10} className="text-amber-400 flex-shrink-0" />}
                          {m.name}
                        </span>
                      );
                    })}
                    {notPaying.map(m => {
                      const hasBirthday = birthdaysThisMonth.some(b => b.name === m.name);
                      return (
                        <span key={m.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 ${hasBirthday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                          {hasBirthday && <Cake size={10} className="text-amber-400 flex-shrink-0" />}
                          {m.name}
                        </span>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
