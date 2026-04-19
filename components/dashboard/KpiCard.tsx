interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  trendLabel?: string;
  icon: string;
  iconBg: string;
  sparkline?: number[];
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function KpiCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  icon,
  iconBg,
  sparkline,
}: KpiCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-violet-500/30 hover:bg-white/7">
      {/* Subtle hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600/0 to-purple-500/0 opacity-0 transition-opacity duration-300 group-hover:from-violet-600/5 group-hover:to-purple-500/3 group-hover:opacity-100" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
            <span className="text-lg">{icon}</span>
          </div>
          {sparkline && (
            <div className="text-violet-400">
              <Sparkline data={sparkline} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm text-white/40">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
          {sub && <p className="text-sm text-white/50">{sub}</p>}
        </div>

        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(trend)}%</span>
            {trendLabel && <span className="text-white/30">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
