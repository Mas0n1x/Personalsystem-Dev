import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  stats?: Array<{
    value: string | number;
    label: string;
  }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'primary',
  gradientFrom = 'primary-600/20',
  gradientTo = 'purple-600/20',
  stats,
  actions,
  children,
}: PageHeaderProps) {
  const colorMap: Record<string, { bg: string; text: string; glow: string; border: string }> = {
    primary: { bg: 'bg-primary-500/20', text: 'text-primary-400', glow: 'bg-primary-500/10', border: 'border-primary-500/30' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', glow: 'bg-purple-500/10', border: 'border-purple-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', glow: 'bg-blue-500/10', border: 'border-blue-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', glow: 'bg-green-500/10', border: 'border-green-500/30' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', glow: 'bg-amber-500/10', border: 'border-amber-500/30' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', glow: 'bg-orange-500/10', border: 'border-orange-500/30' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', glow: 'bg-red-500/10', border: 'border-red-500/30' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', glow: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', glow: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  };

  const colors = colorMap[iconColor] || colorMap.primary;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-${gradientFrom} via-slate-800 to-${gradientTo} border border-slate-700/50 p-6`}>
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/5" />
      <div className={`absolute top-0 right-0 w-64 h-64 ${colors.glow} rounded-full blur-3xl`} />

      {/* Content */}
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 ${colors.bg} rounded-2xl backdrop-blur-sm ${colors.border} border`}>
              <Icon className={`h-8 w-8 ${colors.text}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {/* Stats */}
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-6">
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div className="flex gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Children */}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
