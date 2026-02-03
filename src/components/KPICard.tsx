import { TrendingUp, TrendingDown } from 'lucide-react';
import { Metric } from '../types';

interface KPICardProps {
  metric: Metric;
}

export default function KPICard({ metric }: KPICardProps) {
  const isPositive = metric.change_percentage >= 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{metric.name}</h3>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-gray-900">
          {metric.value.toLocaleString('pt-BR')}
        </p>
        <div
          className={`flex items-center gap-1 text-sm font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{Math.abs(metric.change_percentage).toFixed(1)}%</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        vs período anterior: {metric.previous_value.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
