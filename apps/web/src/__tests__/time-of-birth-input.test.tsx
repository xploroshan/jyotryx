/**
 * TimeOfBirthInput Tests
 *
 * Guards the dropdown-based time selector that replaced the native
 * <input type="time"> picker. The key regression: a partial selection (e.g.
 * choosing the minute before the hour) must stick instead of snapping back to
 * its placeholder.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import TimeOfBirthInput from '@/components/ui/TimeOfBirthInput';

/** Controlled wrapper mirroring how the profile form drives the component. */
function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <TimeOfBirthInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

function selects(container: HTMLElement) {
  const [hour, minute, period] = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
  return { hour, minute, period };
}

describe('TimeOfBirthInput', () => {
  it('keeps a minute chosen before the hour (no snap-back to placeholder)', () => {
    const { container } = render(<Harness />);
    const { hour, minute } = selects(container);

    // Pick the minute first while the hour is still empty.
    fireEvent.change(minute, { target: { value: '9' } });
    expect(minute.value).toBe('9');

    // Then pick the hour — both selections must be retained.
    fireEvent.change(hour, { target: { value: '11' } });
    expect(hour.value).toBe('11');
    expect(minute.value).toBe('9');
  });

  it('emits a 24-hour HH:mm string once hour and minute are set', () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const { hour, minute, period } = selects(container);

    fireEvent.change(hour, { target: { value: '11' } });
    fireEvent.change(minute, { target: { value: '10' } });
    expect(onChange).toHaveBeenLastCalledWith('11:10');

    fireEvent.change(period, { target: { value: 'PM' } });
    expect(onChange).toHaveBeenLastCalledWith('23:10');
  });

  it('handles the 12 AM / 12 PM midnight-noon edge cases', () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const { hour, minute, period } = selects(container);

    fireEvent.change(hour, { target: { value: '12' } });
    fireEvent.change(minute, { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith('00:00'); // 12 AM -> 00:00

    fireEvent.change(period, { target: { value: 'PM' } });
    expect(onChange).toHaveBeenLastCalledWith('12:00'); // 12 PM -> 12:00
  });

  it('hydrates the dropdowns from an existing 24-hour value', () => {
    const { container } = render(<TimeOfBirthInput value="14:30" onChange={() => {}} />);
    const { hour, minute, period } = selects(container);
    expect(hour.value).toBe('2');
    expect(minute.value).toBe('30');
    expect(period.value).toBe('PM');
  });
});
