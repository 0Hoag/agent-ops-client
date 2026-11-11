import type { InsightAnalyticsResponse, InsightDeliveryResponse } from '../../shared/api/generated/Api';
import { count, money as usd, exactTime } from '../../shared/format';
import { ProductTerms } from '../../shared/ui/ProductTerms';

const percent = (value: number | undefined, denominator: number | undefined) => !denominator || value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;

export function CostCache({ data }: { data: InsightAnalyticsResponse }) {
  const maxCost = Math.max(0, ...(data.buckets ?? []).map((bucket) => bucket.equivalent_cost_usd ?? 0));
  return <section aria-label="Cost and cache trends" className="mb-6 overflow-x-auto rounded bg-white p-4">
    <h2 className="text-lg font-semibold">Cost and cache trends ({data.period}, grouped by {data.group_by === 'harness' ? 'tool' : data.group_by === 'wave' ? 'batch' : data.group_by})</h2>
    <ProductTerms />
    <p>Actual billed cost is separate from equivalent API cost. Missing prices: {count(data.unknown_price_count)}. Set missing model prices in Settings.</p>
    <p>UTC buckets · {data.bucket_timestamp ?? 'Bucket timestamp unavailable'} · Week starts: {data.week_starts ?? 'Unavailable'}</p>
    <p>Unavailable metrics need usage and delivery history to be synced. Rates also need eligible records.</p>
    <table className="w-full text-left"><thead><tr><th>Period</th><th>Actual billed (USD)</th><th>Equivalent API (USD)</th><th>Cache-hit rate</th><th>Tokens (input / cached / output / reasoning / cache write)</th><th>Runs</th><th>Missing prices</th></tr></thead>
      <tbody>{data.buckets?.map((bucket, index) => <tr key={`${bucket.start}-${bucket.key}-${index}`}>
        <td><time title={exactTime(bucket.start)}>{exactTime(bucket.start) ?? 'Date not reported — sync usage'}</time> · {bucket.key}</td><td>{usd(bucket.actual_cost_usd)}</td>
        <td>{usd(bucket.equivalent_cost_usd)}<div aria-hidden="true" className="h-2 bg-sky-600" style={{ width: `${maxCost ? (bucket.equivalent_cost_usd ?? 0) / maxCost * 100 : 0}%` }} /></td>
        <td>{percent(bucket.cache_hit_rate, bucket.input_tokens)} ({data.cache_denominator ?? 'denominator unavailable'})<div aria-hidden="true" className="h-2 bg-emerald-600" style={{ width: `${(bucket.cache_hit_rate ?? 0) * 100}%` }} /></td>
        <td>{count(bucket.input_tokens)} / {count(bucket.cached_input_tokens)} / {count(bucket.output_tokens)} / {count(bucket.reasoning_tokens)} / {count(bucket.cache_write_tokens)}</td><td>{count(bucket.runs)}</td><td>{count(bucket.unknown_price_count)}</td>
      </tr>)}</tbody></table>
    {!data.buckets?.length && <p>No analytics observations for this period.</p>}
  </section>;
}

export function Delivery({ data }: { data: InsightDeliveryResponse }) {
  const complete = data.history?.complete === true;
  return <section aria-label="Delivery quality" className="mb-6 overflow-x-auto rounded bg-white p-4">
    <h2 className="text-lg font-semibold">Delivery quality</h2>
    {!complete && <p role="note">History incomplete; sync delivery history to calculate affected metrics.</p>}
    <p>Unavailable metrics need synced history and eligible records; check model pricing in Settings for missing costs.</p>
    <p>History unavailable: {count(data.history?.unavailable)}. Costs use equivalent API USD, not billed USD.</p>
    <table className="w-full text-left"><thead><tr><th>Metric</th><th>Value</th><th>Denominator / exclusions</th></tr></thead><tbody>
      {(['merged_prs', 'closed_issues'] as const).map((key) => {
        const metric = data[key];
        return <tr key={key}><td>Cost per {key === 'merged_prs' ? 'merged PR' : 'closed issue'}</td>
          <td>{complete && metric?.count ? `${usd(metric.cost_per_item_usd)} equivalent API cost/item` : 'Unavailable'}</td>
          <td>{count(metric?.count)} items · {count(metric?.eligible)} eligible · {count(metric?.unavailable)} unavailable</td></tr>;
      })}
      <tr><td>Rework rate</td><td>{complete ? percent(data.send_back?.rate, data.send_back?.denominator) : 'Unavailable'}</td><td>{count(data.send_back?.numerator)} / {count(data.send_back?.denominator)}</td></tr>
      <tr><td>First-pass CI success</td><td>{complete ? percent(data.first_ci_success?.rate, data.first_ci_success?.eligible) : 'Unavailable'}</td><td>{count(data.first_ci_success?.successful)} / {count(data.first_ci_success?.eligible)}</td></tr>
      <tr><td>Issue-to-merge lead time</td><td>{complete && data.issue_to_merge_lead_time?.completed && data.issue_to_merge_lead_time.median_seconds != null ? `${(data.issue_to_merge_lead_time.median_seconds / 86400).toFixed(1)} days median` : 'Unavailable'}</td><td>{count(data.issue_to_merge_lead_time?.completed)} completed · {count(data.issue_to_merge_lead_time?.unavailable)} unavailable</td></tr>
      {data.harness_comparison?.map((item) => <tr key={item.harness}><td>{item.harness} cost / observed changed line (USD/line)</td><td>{item.changed_lines ? usd(item.cost_per_changed_line_usd) : 'Unavailable'}</td><td>{count(item.eligible)} eligible · {count(item.changed_lines)} observed lines · {count(item.unavailable)} excluded</td></tr>)}
    </tbody></table>
    {!data.harness_comparison?.length && <p>No tool comparison data. Choose a wider date range or sync usage.</p>}
  </section>;
}
