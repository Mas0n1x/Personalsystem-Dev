import { type LucideIcon } from 'lucide-react';

interface StatsCardProps {
  value: string | number;
  label: string;
  icon: LucideIcon;
  color?: 'primary' | 'purple' | 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'emerald' | 'indigo' | 'cyan' | 'slate' | 'white';
  trend?: {
    value: number;
    label: string;
  };
}

export default function StatsCard({
  value,
  label,
  icon: Icon,
  color = 'primary',
  trend,
}: StatsCardProps) {
  const colorMap: Record<string, { gradient: string; border: string; iconBg: string; iconText: string; valueText: string }> = {
    primary: {
      gradient: 'from-primary-900/30 to-slate-800/50',
      border: 'border-primary-700/30 hover:border-primary-600/50',
      iconBg: 'bg-primary-500/20',
      iconText: 'text-primary-400',
      valueText: 'text-primary-400',
    },
    purple: {
      gradient: 'from-purple-900/30 to-slate-800/50',
      border: 'border-purple-700/30 hover:border-purple-600/50',
      iconBg: 'bg-purple-500/20',
      iconText: 'text-purple-400',
      valueText: 'text-purple-400',
    },
    blue: {
      gradient: 'from-blue-900/30 to-slate-800/50',
      border: 'border-blue-700/30 hover:border-blue-600/50',
      iconBg: 'bg-blue-500/20',
      iconText: 'text-blue-400',
      valueText: 'text-blue-400',
    },
    green: {
      gradient: 'from-green-900/30 to-slate-800/50',
      border: 'border-green-700/30 hover:border-green-600/50',
      iconBg: 'bg-green-500/20',
      iconText: 'text-green-400',
      valueText: 'text-green-400',
    },
    emerald: {
      gradient: 'from-emerald-900/30 to-slate-800/50',
      border: 'border-emerald-700/30 hover:border-emerald-600/50',
      iconBg: 'bg-emerald-500/20',
      iconText: 'text-emerald-400',
      valueText: 'text-emerald-400',
    },
    amber: {
      gradient: 'from-amber-900/30 to-slate-800/50',
      border: 'border-amber-700/30 hover:border-amber-600/50',
      iconBg: 'bg-amber-500/20',
      iconText: 'text-amber-400',
      valueText: 'text-amber-400',
    },
    orange: {
      gradient: 'from-orange-900/30 to-slate-800/50',
      border: 'border-orange-700/30 hover:border-orange-600/50',
      iconBg: 'bg-orange-500/20',
      iconText: 'text-orange-400',
      valueText: 'text-orange-400',
    },
    red: {
      gradient: 'from-red-900/30 to-slate-800/50',
      border: 'border-red-700/30 hover:border-red-600/50',
      iconBg: 'bg-red-500/20',
      iconText: 'text-red-400',
      valueText: 'text-red-400',
    },
    indigo: {
      gradient: 'from-indigo-900/30 to-slate-800/50',
      border: 'border-indigo-700/30 hover:border-indigo-600/50',
      iconBg: 'bg-indigo-500/20',
      iconText: 'text-indigo-400',
      valueText: 'text-indigo-400',
    },
    cyan: {
      gradient: 'from-cyan-900/30 to-slate-800/50',
      border: 'border-cyan-700/30 hover:border-cyan-600/50',
      iconBg: 'bg-cyan-500/20',
      iconText: 'text-cyan-400',
      valueText: 'text-cyan-400',
    },
    slate: {
      gradient: 'from-slate-500/30 to-slate-800/50',
      border: 'border-slate-500/30 hover:border-slate-400/50',
      iconBg: 'bg-slate-400/20',
      iconText: 'text-slate-300',
      valueText: 'text-slate-300',
    },
    white: {
      gradient: 'from-white/10 to-slate-800/50',
      border: 'border-white/20 hover:border-white/40',
      iconBg: 'bg-white/20',
      iconText: 'text-white',
      valueText: 'text-white',
    },
  };

  const colors = colorMap[color];

  return (
    <div className={`card p-4 bg-gradient-to-br ${colors.gradient} ${colors.border} transition-all hover:-translate-y-0.5`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 ${colors.iconBg} rounded-lg`}>
          <Icon className={`h-4 w-4 ${colors.iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-lg font-bold ${colors.valueText}`}>{value}</p>
          <p className="text-xs text-slate-400 truncate">{label}</p>
        </div>
        {trend && (
          <div className={`text-xs ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}
