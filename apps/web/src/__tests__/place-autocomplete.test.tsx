/**
 * PlaceAutocomplete — birthplace type-ahead that captures coordinates.
 * Verifies the geocode-on-type, suggestion pick (sets coords), free-text
 * fallback (clears coords), and the no-results affordance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { en } from '@/i18n/en';

// Real English dictionary so the component's t.form.* copy is asserted verbatim.
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: en, locale: 'en' as const, setLocale: vi.fn(), resetLocale: vi.fn() }),
}));

const mockApiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}));

import { PlaceAutocomplete } from '@/components/ui/PlaceAutocomplete';

const MUMBAI = { name: 'Mumbai', label: 'Mumbai, Maharashtra, India', lat: 19.076, lng: 72.8777, country: 'India', state: 'Maharashtra', countryCode: 'IN' };

// Controlled test harness that mirrors how forms wire the component.
function Harness({ onChangeSpy }: { onChangeSpy?: (n: string, c: any) => void }) {
  const [value, setValue] = React.useState('');
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  return (
    <PlaceAutocomplete
      id="pob"
      value={value}
      coords={coords}
      onChange={(n, c) => {
        setValue(n);
        setCoords(c);
        onChangeSpy?.(n, c);
      }}
      placeholder="City, Country"
    />
  );
}

describe('PlaceAutocomplete', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('does not query the geocoder for a query shorter than 2 chars', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm' } });
    // Wait past the debounce window; the upstream must never be called.
    await new Promise((r) => setTimeout(r, 400));
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('debounces, queries the geo proxy, and renders located suggestions', async () => {
    mockApiGet.mockResolvedValue([MUMBAI]);
    render(<Harness />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mumbai' } });
    expect(await screen.findByText('Mumbai, Maharashtra, India')).toBeDefined();
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/geo/search?q=mumbai'));
  });

  it('captures coordinates when a suggestion is picked', async () => {
    const spy = vi.fn();
    mockApiGet.mockResolvedValue([MUMBAI]);
    render(<Harness onChangeSpy={spy} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mumbai' } });
    const option = await screen.findByText('Mumbai, Maharashtra, India');
    fireEvent.mouseDown(option);
    // Last onChange carries the real coordinates.
    expect(spy).toHaveBeenLastCalledWith('Mumbai', { lat: 19.076, lng: 72.8777 });
  });

  it('clears coordinates when the user edits the text by hand', async () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Timbuktu' } });
    // A hand-typed name must not carry coordinates.
    expect(spy).toHaveBeenLastCalledWith('Timbuktu', null);
  });

  it('does NOT geocode or open on a programmatic prefill (only on user typing)', async () => {
    mockApiGet.mockResolvedValue([MUMBAI]);
    // A parent that seeds `value` (profile prefill / deep-link) without the user
    // touching the field must not fire a request or pop the dropdown.
    const { rerender } = render(
      <PlaceAutocomplete id="pob" value="" coords={null} onChange={() => {}} />,
    );
    rerender(<PlaceAutocomplete id="pob" value="Mumbai" coords={null} onChange={() => {}} />);
    await new Promise((r) => setTimeout(r, 400));
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows a "type it in" affordance when the geocoder returns nothing', async () => {
    mockApiGet.mockResolvedValue([]);
    render(<Harness />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzznotaplace' } });
    expect(await screen.findByText(en.form.placeNoResults)).toBeDefined();
  });
});
