// tz-lookup ships no types. It exports a single function that maps a
// latitude/longitude to an IANA timezone name (e.g. "Asia/Kolkata") and
// throws on out-of-range coordinates.
declare module 'tz-lookup' {
  export default function tzLookup(latitude: number, longitude: number): string;
}
