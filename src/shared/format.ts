export const money = (value?: number) => value == null ? 'Cost unavailable — check model pricing in Settings' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
export const compact = (value?: number) => value == null ? 'Not reported — sync usage' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
export const count = (value?: number) => value == null ? 'Not reported — sync usage' : new Intl.NumberFormat('en-US').format(value);
export function exactTime(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC' }).format(new Date(value)) : undefined;
}
export function relativeTime(value?: string, now = Date.now()) {
  if (!exactTime(value)) return 'Time not reported — sync session history';
  const seconds = (Date.parse(value!) - now) / 1000;
  const unit = Math.abs(seconds) >= 86400 ? 'day' : Math.abs(seconds) >= 3600 ? 'hour' : 'minute';
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / (unit === 'day' ? 86400 : unit === 'hour' ? 3600 : 60)), unit);
}
