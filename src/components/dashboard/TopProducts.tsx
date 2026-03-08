'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TopProduct } from '@/lib/types';

interface TopProductsProps {
  products: TopProduct[];
}

export default function TopProducts({ products }: TopProductsProps) {
  const maxRevenue = products.length > 0 ? products[0].revenue : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Productos</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-5 text-right font-mono">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {product.title}
              </p>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(product.revenue)}
              </p>
              <p className="text-xs text-gray-500">{formatNumber(product.unitsSold)} uds</p>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
        )}
      </div>
    </Card>
  );
}
