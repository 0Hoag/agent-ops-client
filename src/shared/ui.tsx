import type { ReactNode } from 'react';

/** Primary action with theme-specific foreground contrast. */
export function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--on-accent)', cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? .5 : 1, ...props.style }}>{children}</button>; }
export function Card({ children }: { children: ReactNode }) { return <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16 }}>{children}</section>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) { const color = tone === 'neutral' ? 'var(--muted)' : `var(--${tone})`; return <span style={{ color, border: `1px solid ${color}`, borderRadius: 999, padding: '2px 8px' }}>{children}</span>; }
/** Bounded field using the same boundary token as native form consumers. */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} style={{ padding: 8, borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--field-line)', ...props.style }} />; }
export function DateRangePicker(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <Select aria-label="Date range" {...props}><option>Today</option><option>7 days</option><option>30 days</option><option>Custom</option></Select>; }
export function Table() { return <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Metric</th><th align="right">Value</th></tr></thead><tbody><tr><td>Agent cost</td><td align="right">$12.40</td></tr></tbody></table>; }
export function Tabs() { return <div role="tablist"><button role="tab" aria-selected="true">Usage</button><button role="tab">Efficiency</button></div>; }
export function Tooltip({ children, text }: { children: ReactNode; text: string }) { return <span title={text}>{children}</span>; }
export function Skeleton() { return <div aria-label="Loading" style={{ height: 24, background: 'var(--line)', borderRadius: 4 }} />; }
export function EmptyState() { return <div><p>No usage data yet.</p><Button>Connect a repository</Button></div>; }
export function Toast({ children }: { children: ReactNode }) { return <div role="status" style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--line)' }}>{children}</div>; }
export function Stat() { return <div><small>Weekly cost</small><h2>$12.40 <Badge tone="good">↓ 8%</Badge></h2><svg aria-label="Cost trend" width="100" height="24"><polyline points="0,20 25,12 50,16 75,5 100,8" fill="none" stroke="var(--accent)" /></svg></div>; }
export function Chart() { return <div role="img" aria-label="Weekly cost chart" style={{ padding: 12, borderBottom: '2px solid var(--accent)' }}>Mon　$3 · Wed　$5 · Fri　$4</div>; }
