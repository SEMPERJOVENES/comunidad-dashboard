'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatNumber, getDateRanges } from '@/lib/utils';
import { DateRange, ProjectSummary } from '@/lib/types';
import { FolderKanban, Plus, TrendingUp, ShoppingCart, Loader2 } from 'lucide-react';

export default function ProjectsPage() {
  const ranges = getDateRanges();
  const [selectedRange, setSelectedRange] = useState<DateRange>(ranges[3]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: selectedRange.startDate.toISOString(),
          end: selectedRange.endDate.toISOString(),
        });
        const res = await fetch(`/api/dashboard?${params}`);
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRange]);

  const totalRevenue = projects.reduce((sum, p) => sum + p.totalRevenue, 0);

  return (
    <DashboardLayout selectedRange={selectedRange} onRangeChange={setSelectedRange}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderKanban size={24} className="text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Proyectos</h1>
              <p className="text-sm text-gray-500">Desglose financiero por proyecto</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
            <Plus size={16} />
            Nuevo Proyecto
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <span className="ml-3 text-gray-500">Cargando proyectos...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-xs text-gray-500 font-medium">Revenue Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Proyectos Activos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 font-medium">Órdenes Totales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(projects.reduce((s, p) => s + p.totalOrders, 0))}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card key={project.projectName} className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <h3 className="text-base font-semibold text-gray-900">{project.projectName}</h3>
                    <span className="ml-auto text-xs font-medium text-gray-400">{project.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-500">
                        <TrendingUp size={14} />
                        <span className="text-sm">Revenue</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(project.totalRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-500">
                        <ShoppingCart size={14} />
                        <span className="text-sm">Órdenes</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{formatNumber(project.totalOrders)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${project.percentage}%`, backgroundColor: project.color }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full text-center py-8 text-sm text-gray-400">
                  Sin proyectos (agrega tags a tus órdenes en Shopify)
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
