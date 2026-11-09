// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Button, DateRangePicker, Select } from './ui';

afterEach(cleanup);

it('forwards button behavior and preserves caller styles', () => {
  const clicked = vi.fn();
  render(<Button onClick={clicked} style={{ color: 'black' }}>Save</Button>);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(clicked).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).style.color).toBe('black');
});

it('keeps native select options and controlled value changes', () => {
  function Picker() {
    const [value, setValue] = React.useState('Today');
    return <><DateRangePicker value={value} onChange={(event) => setValue(event.target.value)} /><Select aria-label="Metric"><option>Cost</option></Select><output>{value}</output></>;
  }
  render(<Picker />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Date range' }), { target: { value: '7 days' } });
  expect(screen.getByRole('status').textContent).toBe('7 days');
  expect(screen.getByRole('combobox', { name: 'Metric' }).textContent).toBe('Cost');
});
