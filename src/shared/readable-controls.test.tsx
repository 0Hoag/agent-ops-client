import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './ui';

describe('Shared readable controls', () => {
  it('uses a dedicated contrasting foreground for the primary button', () => {
    expect(renderToStaticMarkup(<Button>Save</Button>)).toContain('var(--on-accent)');
  });
  it('keeps hover and selected Work rows on a themed surface', () => {
    const css = readFileSync('src/style.css', 'utf8');
    expect(css).toContain('.work-row:hover');
    expect(css).toContain('.work-row[aria-selected="true"]');
    expect(readFileSync('src/modules/work/page.tsx', 'utf8')).not.toContain('hover:bg-slate-50');
  });
});
