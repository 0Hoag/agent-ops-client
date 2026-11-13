import type { InsightAnalyticsBucket } from '../../shared/api/generated/Api';
import { money } from '../../shared/format';

/** Direct daily labels distinguish reported priced spend from unavailable costs. */
export function DailySpend({ buckets }: { buckets: InsightAnalyticsBucket[] }) {
  const max = Math.max(0, ...buckets.flatMap((item) => item.actual_cost_usd == null ? [] : [item.actual_cost_usd]));
  return <div className="mt-4 grid gap-2" aria-label="Daily spend chart">{buckets.map((item) => {
    const spend = item.actual_cost_usd;
    const label = item.start ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(item.start)) : 'Date unavailable';
    return <div key={item.start} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 text-sm">
      <time dateTime={item.start} title={item.start}>{label}</time>
      <div className="h-2 rounded bg-slate-100">{spend != null && <div className="h-2 rounded bg-blue-600" style={{ width: `${max ? spend / max * 100 : 0}%` }} />}</div>
      <span>{spend == null ? 'Not priced' : `${money(spend)}${item.unknown_price_count ? ' · Partial' : ''}`}</span>
    </div>;
  })}</div>;
}
