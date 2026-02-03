import { TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface TicketKPICardProps {
  title: string;
  value: number | string;
  icon: 'check' | 'clock' | 'alert' | 'trending';
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  subtitle?: string;
}

export default function TicketKPICard({ title, value, icon, color, subtitle }: TicketKPICardProps) {
  const iconMap = {
    check: CheckCircle,
    clock: Clock,
    alert: AlertCircle,
    trending: TrendingUp,
  };

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  const Icon = iconMap[icon];

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border ${colorMap[color]} border-opacity-20 hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
