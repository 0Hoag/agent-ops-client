import type { InsightAnalyticsBucket } from '../../shared/api/generated/Api';
import { money } from '../../shared/format';

/** Direct daily labels distinguish reported priced spend from unavailable costs. */
export function DailySpend({ buckets }: { buckets: InsightAnalyticsBucket[] }) {
  const days = new Map<string | undefined, InsightAnalyticsBucket>();
  for (const bucket of buckets) {
    const key = bucket.start?.slice(0, 10);
    const previous = days.get(key);
    days.set(key, {
      start: bucket.start,
      actual_cost_usd: previous?.actual_cost_usd == null && bucket.actual_cost_usd == null ? undefined : (previous?.actual_cost_usd ?? 0) + (bucket.actual_cost_usd ?? 0),
      unknown_price_count: (previous?.unknown_price_count ?? 0) + (bucket.unknown_price_count ?? 0),
    });
  }
  const daily = [...days.values()];
  const max = Math.max(0, ...daily.flatMap((item) => item.actual_cost_usd == null ? [] : [item.actual_cost_usd]));
  return <div role="group" className="mt-4 grid gap-2" aria-label="Daily spend chart">{daily.map((item) => {
    const spend = item.actual_cost_usd;
    const label = item.start ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(item.start)) : 'Date unavailable';
    return <div key={item.start} className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 text-sm">
      <time dateTime={item.start} title={item.start}>{label}</time>
      <div className="h-2 rounded bg-slate-100">{spend != null && <div className="h-2 rounded bg-blue-600" style={{ width: `${max ? spend / max * 100 : 0}%` }} />}</div>
      <span>{spend == null ? 'Not priced' : `${money(spend)}${item.unknown_price_count ? ' · Partial' : ''}`}</span>
    </div>;
  })}</div>;
}
