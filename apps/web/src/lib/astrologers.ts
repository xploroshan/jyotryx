/**
 * Astrologer roster for the "Chat with Astrologer" surface. Ids MUST match
 * the server-side persona registry in
 * apps/api/src/modules/chat/astrologers.ts — the API uses the id to pick
 * the first-person persona that drives the consultation.
 *
 * Photos live in /public/astrologers/<id>.svg (swap in real portraits any
 * time). The UI falls back to initials if an image is missing.
 */
export interface Astrologer {
  id: string;
  name: string;
  /** Maps to a chat category server-side. */
  category: string;
  specialty: string;
  experienceYears: number;
  languages: string[];
  rating: number;
  reviews: number;
  /** Relative public path to the portrait. */
  photo: string;
  online: boolean;
  tagline: string;
}

export const ASTROLOGERS: Astrologer[] = [
  {
    id: "acharya-vikram",
    name: "Acharya Vikram Shastri",
    category: "career",
    specialty: "Career & Finance",
    experienceYears: 22,
    languages: ["Hindi", "English"],
    rating: 4.9,
    reviews: 3120,
    photo: "/astrologers/acharya-vikram.svg",
    online: true,
    tagline: "Vedic guidance for career, business & money decisions.",
  },
  {
    id: "pandita-meera",
    name: "Pandita Meera Joshi",
    category: "relationship",
    specialty: "Love & Marriage",
    experienceYears: 18,
    languages: ["Hindi", "Marathi", "English"],
    rating: 4.8,
    reviews: 2740,
    photo: "/astrologers/pandita-meera.svg",
    online: true,
    tagline: "Compassionate insight into love, marriage & compatibility.",
  },
  {
    id: "guru-anandnath",
    name: "Guru Anand Nath",
    category: "remedy",
    specialty: "Remedies & Spirituality",
    experienceYears: 30,
    languages: ["Hindi", "English", "Bengali"],
    rating: 5.0,
    reviews: 4015,
    photo: "/astrologers/guru-anandnath.svg",
    online: false,
    tagline: "Time-tested remedies, gemstones & spiritual practices.",
  },
  {
    id: "jyotishi-kavya",
    name: "Jyotishi Kavya Reddy",
    category: "general",
    specialty: "Birth Chart & Life",
    experienceYears: 12,
    languages: ["Telugu", "Tamil", "English"],
    rating: 4.7,
    reviews: 1985,
    photo: "/astrologers/jyotishi-kavya.svg",
    online: true,
    tagline: "Clear, modern readings of your chart and life path.",
  },
];

export function getAstrologer(id?: string | null): Astrologer | undefined {
  if (!id) return undefined;
  return ASTROLOGERS.find((a) => a.id === id);
}

/** Two-letter initials for the avatar fallback. */
export function astrologerInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
