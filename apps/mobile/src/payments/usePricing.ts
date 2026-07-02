import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { parsePricing, type PricingInfo } from './products';

/** Pricing + store policy from GET /payments/pricing (public), parsed. */
export function usePricing(): { pricing: PricingInfo; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['pricing'],
    queryFn: () => api.get<Record<string, string>>(endpoints.payments.pricing),
    staleTime: 5 * 60 * 1000,
  });
  return { pricing: parsePricing(q.data ?? {}), isLoading: q.isLoading };
}
