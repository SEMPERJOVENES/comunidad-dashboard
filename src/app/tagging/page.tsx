'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getDateRanges } from '@/lib/utils';
import { DateRange, TaggedTransaction } from '@/lib/types';
import { demoProjects } from '@/lib/demo-data';
import { Tags, Check, X, MessageSquare, Filter } from 'lucide-react';

const demoTransactions: TaggedTransaction[] = [
  { orderId: 10001, orderName: '#1001', date: '2026-03-08T14:30:00Z', amount: 245.00, projectTag: 'Colección Verano', autoTagged: true, reviewed: false },
  { orderId: 10002, orderName: '#1002', date: '2026-03-08T12:15:00Z', amount: 89.90, projectTag: 'Streetwear Line', autoTagged: true, reviewed: true, reviewedBy: 'Admin' },
  { orderId: 10003, orderName: '#1003', date: '2026-03-07T18:45:00Z', amount: 156.50, projectTag: 'Básicos Orgánicos', autoTagged: true, reviewed: true, reviewedBy: 'Admin' },
  { orderId: 10004, orderName: '#1004', date: '2026-03-07T10:20:00Z', amount: 320.00, projectTag: 'Colaboraciones', autoTagged: false, reviewed: false, notes: 'Posible Colección Verano también' },
  { orderId: 10005, orderName: '#1005', date: '2026-03-06T16:00:00Z', amount: 45.00, projectTag: 'Accesorios', autoTagged: true, reviewed: true, reviewedBy: 'Admin' },
  { orderId: 10006, orderName: '#1006', date: '2026-03-06T11:30:00Z', amount: 178.00, projectTag: 'Streetwear Line', autoTagged: true, reviewed: false },
  { orderId: 10007, orderName: '#1007', date: '2026-03-05T09:00:00Z', amount: 67.50, projectTag: 'Básicos Orgánicos', autoTagged: true, reviewed: false },
  { orderId: 10008, orderName: '#1008', date: '2026-03-05T07:45:00Z', amount: 210.00, projectTag: 'Colección Verano', autoTagged: true, reviewed: true, reviewedBy: 'Admin' },
];

export default function TaggingPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewed'>('all');

  const filtered = demoTransactions.filter((t) => {
    if (filterStatus === 'pending') return !t.reviewed;
    if (filterStatus === 'reviewed') return t.reviewed;
    return true;
  });

  const pendingCount = demoTransactions.filter((t) => !t.reviewed).length;
  const reviewedCount = demoTransactions.filter((t) => t.reviewed).length;

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Tags size={24} className="text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Etiquetado de Transacciones</h1>
            <p className="text-sm text-gray-500">Revisa y clasifica transacciones por proyecto</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold mt-1">{demoTransactions.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Pendientes</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Revisadas</p>
            <p className="text-xl font-bold text-green-600 mt-1">{reviewedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Auto-etiquetadas</p>
            <p className="text-xl font-bold text-violet-600 mt-1">{demoTransactions.filter((t) => t.autoTagged).length}</p>
          </Card>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'pending', 'reviewed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterStatus === status
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'Todas' : status === 'pending' ? 'Pendientes' : 'Revisadas'}
            </button>
          ))}
        </div>

        {/* Transactions table */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Orden</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Fecha</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Monto</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Proyecto</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Origen</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Estado</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const project = demoProjects.find((p) => p.projectName === tx.projectTag);
                  return (
                    <tr key={tx.orderId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3">
                        <span className="text-sm font-medium text-violet-600">{tx.orderName}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-gray-500">{formatDate(tx.date)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">{formatCurrency(tx.amount)}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project?.color || '#gray' }} />
                          <select className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 pr-6">
                            {demoProjects.map((p) => (
                              <option key={p.projectName} selected={p.projectName === tx.projectTag}>
                                {p.projectName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <Badge variant={tx.autoTagged ? 'info' : 'warning'}>
                          {tx.autoTagged ? 'Auto' : 'Manual'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <Badge variant={tx.reviewed ? 'success' : 'warning'}>
                          {tx.reviewed ? 'Revisada' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {!tx.reviewed && (
                            <button className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors" title="Aprobar">
                              <Check size={14} />
                            </button>
                          )}
                          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Nota">
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
