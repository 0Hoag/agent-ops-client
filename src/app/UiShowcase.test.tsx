// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { UiShowcase } from './UiShowcase';

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; });

it('toggles the document theme through the showcase control', () => {
  render(<UiShowcase />);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  expect(document.documentElement.dataset.theme).toBe('light');
});
