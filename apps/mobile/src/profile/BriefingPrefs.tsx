import { useEffect, useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { endpoints, type BriefingPreferences } from '@myastro360/shared';
import { api } from '@/api/client';
import { Card, Muted } from '@/components/ui';
import { colors } from '@/theme';

/**
 * Daily-briefing preference — the mobile mirror of the web
 * BriefingPreferenceSection: a self-saving toggle (optimistic flip, rollback
 * on error, defaults ON when the fetch fails).
 */
export function BriefingPrefs() {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<BriefingPreferences>(endpoints.briefingPreferences.base)
      .then((p) => setEnabled(p.briefingEmailEnabled))
      .catch(() => setEnabled(true))
      .finally(() => setLoaded(true));
  }, []);

  const flip = (next: boolean) => {
    setEnabled(next); // optimistic
    api
      .put<BriefingPreferences>(endpoints.briefingPreferences.base, { briefingEmailEnabled: next })
      .catch(() => setEnabled(!next)); // rollback
  };

  return (
    <Card testID="briefing-prefs">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-fg font-semibold">Daily briefing email</Text>
          <Muted className="text-xs mt-0.5">Your personalized cosmic outlook, every morning.</Muted>
        </View>
        <Switch
          testID="briefing-toggle"
          value={enabled}
          disabled={!loaded}
          onValueChange={flip}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor="#fff"
        />
      </View>
    </Card>
  );
}
