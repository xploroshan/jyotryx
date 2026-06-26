/**
 * Curated, authoritative remedy temples per dosha.
 *
 * These are the well-known kshetras traditionally associated with pacifying
 * each dosha. Coordinates are approximate (temple town centre) and are used
 * only to seed a "find this kind of temple near me" maps search — not for
 * precise navigation. `searchQuery` powers the geolocation deep-link so a user
 * anywhere can find the nearest relevant temple, even if the famous ones are
 * far away. Shaped so a live places lookup (OSM/Places) can replace the
 * deep-link later without changing callers.
 */
export interface RemedyTemple {
  name: string;
  place: string;
  state: string;
  lat: number;
  lng: number;
  why: string;
}

export interface RemedyTempleSet {
  /** Deity / figure associated with the remedy (for display). */
  deity: string;
  /** Plain maps-search query for "find near me" (findable anywhere). */
  searchQuery: string;
  /** Famous authoritative temples for this dosha. */
  temples: RemedyTemple[];
}

export type RemedyDoshaKey = 'mangal' | 'kaal_sarp' | 'nadi' | 'pitra';

export const REMEDY_TEMPLES: Record<RemedyDoshaKey, RemedyTempleSet> = {
  mangal: {
    deity: 'Mangal (Mars) / Hanuman',
    searchQuery: 'Hanuman temple',
    temples: [
      {
        name: 'Mangalnath Mandir',
        place: 'Ujjain',
        state: 'Madhya Pradesh',
        lat: 23.1985,
        lng: 75.7763,
        why: 'Considered the birthplace of Mars (Mangal) — the foremost site for Mangal Dosha (Bhat Puja) shanti.',
      },
      {
        name: 'Salasar Balaji (Hanuman)',
        place: 'Salasar',
        state: 'Rajasthan',
        lat: 27.602,
        lng: 74.7236,
        why: 'Hanuman worship, especially on Tuesdays, traditionally calms the heat of Mars.',
      },
    ],
  },
  kaal_sarp: {
    deity: 'Shiva / Rahu-Ketu',
    searchQuery: 'Shiva temple',
    temples: [
      {
        name: 'Trimbakeshwar Shiva Temple',
        place: 'Trimbak, Nashik',
        state: 'Maharashtra',
        lat: 19.9333,
        lng: 73.53,
        why: 'The foremost site for Kaal Sarp Dosha Nivaran Puja.',
      },
      {
        name: 'Srikalahasti Temple',
        place: 'Srikalahasti',
        state: 'Andhra Pradesh',
        lat: 13.7497,
        lng: 79.6983,
        why: 'The Rahu-Ketu kshetra — well known for Kaal Sarp and Rahu/Ketu dosha pujas.',
      },
    ],
  },
  nadi: {
    deity: 'Shiva (Maha Mrityunjaya)',
    searchQuery: 'Shiva temple',
    temples: [
      {
        name: 'Mahakaleshwar Jyotirlinga',
        place: 'Ujjain',
        state: 'Madhya Pradesh',
        lat: 23.1828,
        lng: 75.7682,
        why: 'Maha Mrityunjaya Jaap here before marriage is a classic remedy for Nadi Dosha.',
      },
      {
        name: 'Ramanathaswamy Temple',
        place: 'Rameswaram',
        state: 'Tamil Nadu',
        lat: 9.2881,
        lng: 79.3174,
        why: 'A revered Shiva kshetra for marital harmony remedies.',
      },
    ],
  },
  pitra: {
    deity: 'Ancestors (Pitra) / Vishnu',
    searchQuery: 'Vishnu temple',
    temples: [
      {
        name: 'Vishnupad Temple',
        place: 'Gaya',
        state: 'Bihar',
        lat: 24.796,
        lng: 85.0119,
        why: 'The foremost site for Pind Daan and ancestral Tarpan to relieve Pitra Dosha.',
      },
      {
        name: 'Trimbakeshwar Shiva Temple',
        place: 'Trimbak, Nashik',
        state: 'Maharashtra',
        lat: 19.9333,
        lng: 73.53,
        why: 'Performs Narayan Nagbali / Pitra Dosha Nivaran rituals.',
      },
    ],
  },
};
