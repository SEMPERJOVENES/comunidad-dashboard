'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { ProjectSummary } from '@/lib/types';

interface ProjectBreakdownProps {
  projects: ProjectSummary[];
}

export default function ProjectBreakdown({ projects }: ProjectBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caja por Proyecto</CardTitle>
      </CardHeader>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={projects}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                dataKey="totalRevenue"
                nameKey="projectName"
                strokeWidth={2}
                stroke="#fff"
              >
                {projects.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full space-y-2">
          {projects.map((project) => (
            <div key={project.projectName} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-sm text-gray-700 truncate">{project.projectName}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-semibold">{formatCurrency(project.totalRevenue)}</span>
                <span className="text-xs text-gray-400 ml-2">{project.percentage.toFixed(0)}%</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin proyectos configurados</p>
          )}
        </div>
      </div>
    </Card>
  );
}
