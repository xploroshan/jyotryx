/**
 * Option lists + coordinate tables for the Vedic feature inputs. Mirrors the
 * web selectors (`electional.ts` cities/activities, muhurat purposes, tarot
 * spreads, vastu enums, zodiac signs).
 */
import type { FieldOption } from './types';

export const ZODIAC_SIGNS: { id: string; label: string; glyph: string }[] = [
  { id: 'aries', label: 'Aries', glyph: '♈' },
  { id: 'taurus', label: 'Taurus', glyph: '♉' },
  { id: 'gemini', label: 'Gemini', glyph: '♊' },
  { id: 'cancer', label: 'Cancer', glyph: '♋' },
  { id: 'leo', label: 'Leo', glyph: '♌' },
  { id: 'virgo', label: 'Virgo', glyph: '♍' },
  { id: 'libra', label: 'Libra', glyph: '♎' },
  { id: 'scorpio', label: 'Scorpio', glyph: '♏' },
  { id: 'sagittarius', label: 'Sagittarius', glyph: '♐' },
  { id: 'capricorn', label: 'Capricorn', glyph: '♑' },
  { id: 'aquarius', label: 'Aquarius', glyph: '♒' },
  { id: 'pisces', label: 'Pisces', glyph: '♓' },
];

export const HOROSCOPE_PERIODS: FieldOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const MUHURAT_PURPOSES: FieldOption[] = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'education', label: 'Education' },
  { value: 'puja', label: 'Puja' },
  { value: 'housewarming', label: 'Housewarming' },
];

// Shared by Cosmic Calendar + Decision Room (electional.ts ACTIVITIES).
export const ELECTIONAL_ACTIVITIES: FieldOption[] = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'griha_pravesh', label: 'Griha Pravesh' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'education', label: 'Education' },
  { value: 'medical', label: 'Medical' },
  { value: 'general', label: 'General' },
];

export const TAROT_SPREADS: FieldOption[] = [
  { value: 'single', label: 'Single Card' },
  { value: 'three-card', label: 'Three Card' },
  { value: 'celtic-cross', label: 'Celtic Cross' },
];

export const VASTU_PROPERTY_TYPES: FieldOption[] = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'office', label: 'Office' },
  { value: 'shop', label: 'Shop' },
  { value: 'factory', label: 'Factory' },
  { value: 'plot', label: 'Plot' },
];

export const VASTU_DIRECTIONS: FieldOption[] = [
  { value: 'N', label: 'North' },
  { value: 'NE', label: 'North-East' },
  { value: 'E', label: 'East' },
  { value: 'SE', label: 'South-East' },
  { value: 'S', label: 'South' },
  { value: 'SW', label: 'South-West' },
  { value: 'W', label: 'West' },
  { value: 'NW', label: 'North-West' },
];

export const DIVISIONAL_TYPES: FieldOption[] = [
  { value: '9', label: 'D9 · Navamsha' },
  { value: '10', label: 'D10 · Dashamsha' },
];

export const NUMEROLOGY_MODES: FieldOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'brand', label: 'Brand / Business' },
  { value: 'personal-year', label: 'Personal Year' },
];

/** A small city table with coordinates for the electional pickers. */
export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
];

export const CITY_OPTIONS: FieldOption[] = CITIES.map((c, i) => ({ value: String(i), label: c.name }));
