import { useState } from 'react';
import { Share } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { ApiError, endpoints } from '@myastro360/shared';
import { api } from '@/api/client';
import { useI18nStore } from '@/store/i18n';
import { useAuthStore } from '@/store/auth';
import { Card, Button, Muted } from '@/components/ui';
import type { Values } from './types';
import type { MatchingData } from './results/responses';
import { buildSharePayload } from './share';
import { WEB_ORIGIN } from '@/lib/config';

/**
 * Match-share action, rendered by the runner after the matching result. Creates
 * a share token (POST /astrology/matching/share) then opens the native share
 * sheet with `${WEB_ORIGIN}/match/${token}` (the API returns only the token).
 */
export function ShareMatch({ data, values }: { data: unknown; values: Values }) {
  const locale = useI18nStore((s) => s.locale);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const [error, setError] = useState('');

  const share = useMutation({
    mutationFn: () => api.post<{ token: string }>(endpoints.astrology.matchingShare, buildSharePayload(data as MatchingData, values, locale)),
    onSuccess: async ({ token }) => {
      setError('');
      const url = `${WEB_ORIGIN}/match/${token}`;
      try {
        await Share.share({ message: `Our compatibility on MyAstro360: ${url}`, url });
      } catch {
        /* user dismissed the sheet */
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not create a share link.'),
  });

  return (
    <Card>
      <Muted className="mb-3">Share this compatibility result.</Muted>
      <Button
        testID="match-share"
        title={share.isPending ? 'Preparing…' : 'Share result'}
        loading={share.isPending}
        onPress={() => (isAuthed ? share.mutate() : setError('Sign in to share.'))}
      />
      {error ? <Muted className="text-danger mt-2 text-xs">{error}</Muted> : null}
    </Card>
  );
}
