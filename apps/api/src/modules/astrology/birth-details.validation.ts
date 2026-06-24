import { BadRequestException } from '@nestjs/common';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate birth-detail input BEFORE any chart computation (and before any
 * credit deduction). The astrology controller bodies are plain TypeScript
 * interfaces, so the global ValidationPipe never sees them — without this
 * guard, out-of-range coordinates flow into the ephemeris engine (garbage
 * ascendant / silent IST fallback) and a malformed date/time produces a
 * `NaN` Julian Day that propagates `undefined` into every sign/house index.
 *
 * Throws 400 on invalid input so the caller never spends compute/credits on
 * a chart that can't be correct.
 */
export function assertValidBirthDetails(bd: {
  dateOfBirth?: string;
  timeOfBirth?: string;
  latitude?: number;
  longitude?: number;
}): void {
  if (!bd || typeof bd.dateOfBirth !== 'string' || !DATE_RE.test(bd.dateOfBirth)) {
    throw new BadRequestException('dateOfBirth must be a valid date in YYYY-MM-DD format');
  }
  const [y, m, d] = bd.dateOfBirth.split('-').map((s) => parseInt(s, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1 || y > 9999) {
    throw new BadRequestException('dateOfBirth is not a valid calendar date');
  }
  if (Number.isNaN(Date.parse(bd.dateOfBirth))) {
    throw new BadRequestException('dateOfBirth is not a valid calendar date');
  }

  if (typeof bd.timeOfBirth !== 'string' || !TIME_RE.test(bd.timeOfBirth)) {
    throw new BadRequestException('timeOfBirth must be in 24-hour HH:mm format');
  }

  if (bd.latitude != null) {
    if (typeof bd.latitude !== 'number' || !Number.isFinite(bd.latitude) || bd.latitude < -90 || bd.latitude > 90) {
      throw new BadRequestException('latitude must be a number between -90 and 90');
    }
  }
  if (bd.longitude != null) {
    if (typeof bd.longitude !== 'number' || !Number.isFinite(bd.longitude) || bd.longitude < -180 || bd.longitude > 180) {
      throw new BadRequestException('longitude must be a number between -180 and 180');
    }
  }
}
