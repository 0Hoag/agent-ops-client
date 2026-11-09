import { Badge, Button, Card, Chart, DateRangePicker, EmptyState, Select, Skeleton, Stat, Table, Tabs, Toast, Tooltip } from '../shared/ui';

export function UiShowcase() {
  return <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}><header><h1>Design system</h1><p>Shared components for cost, efficiency, and attention.</p><Button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }}>Toggle theme</Button></header><Card><Stat /><DateRangePicker /> <Select aria-label="Metric"><option>Cost</option></Select></Card><Card><Tabs /><Table /><Chart /></Card><Card><Badge>Neutral</Badge> <Badge tone="good">Healthy</Badge> <Badge tone="warn">Review</Badge> <Badge tone="bad">Blocked</Badge><p><Tooltip text="Exact event time">Relative time: 2 hours ago</Tooltip></p><Skeleton /></Card><Card><EmptyState /></Card><Toast>Saved successfully</Toast></main>;
}
