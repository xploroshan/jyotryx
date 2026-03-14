import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function getZodiacSign(month: number, day: number): string {
  const signs = [
    "Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini",
    "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn",
  ];
  const lastDay = [19, 18, 20, 19, 20, 20, 22, 22, 22, 22, 21, 21, 31];
  return day > lastDay[month - 1] ? signs[month] : signs[month - 1];
}

export function getZodiacEmoji(sign: string): string {
  const emojis: Record<string, string> = {
    Aries: "\u2648", Taurus: "\u2649", Gemini: "\u264a", Cancer: "\u264b",
    Leo: "\u264c", Virgo: "\u264d", Libra: "\u264e", Scorpio: "\u264f",
    Sagittarius: "\u2650", Capricorn: "\u2651", Aquarius: "\u2652", Pisces: "\u2653",
  };
  return emojis[sign] || "";
}
