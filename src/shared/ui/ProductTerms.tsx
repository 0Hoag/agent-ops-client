import { exactTime, relativeTime } from '../format';

export function RelativeTime({ value }: { value?: string }) {
  return <time dateTime={exactTime(value) ? value : undefined} title={exactTime(value)}>{relativeTime(value)}</time>;
}

const terms = {
  Tool: 'The agent application used for a session (also called a harness).',
  Batch: 'A group of related tasks, also called a wave.',
  Agent: 'An automated worker that carries out a task.',
  Tokens: 'Units of text processed by a model; input, cached input and output can have different prices.',
  Cache: 'Reused model input. Cache-hit rate measures the share of input served from cache.',
  'Equivalent API cost': 'Estimated cost at API prices, not necessarily the amount actually billed.',
  CI: 'Automated checks run on a code change. First-pass success means the initial checks passed.',
  Rework: 'Work sent back for another attempt or revision.',
};

export function ProductTerms() {
  return <details className="my-3 text-sm"><summary>Terms explained</summary><dl className="grid gap-2 p-3">{Object.entries(terms).map(([term, meaning]) => <div key={term}><dt className="font-medium"><abbr title={meaning} tabIndex={0}>{term}</abbr></dt><dd>{meaning}</dd></div>)}</dl></details>;
}
