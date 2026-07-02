import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@myastro360/shared';
import { useI18nStore } from '@/store/i18n';
import { Screen, Heading, Muted, Card, Button } from '@/components/ui';
import { analyzeAndWait, type PalmImage } from './api';
import { PalmistryResult } from './PalmistryResult';
import type { PalmistryAnalysis } from '@/features/results/responses.p4';

/**
 * Palmistry — gender (drives the palm the backend reads) + a palm photo
 * (camera or gallery via expo-image-picker) → multipart upload → poll → reading.
 * A 402 means the reading is locked (purchase ships with payments, P5).
 */
export function PalmistryScreen() {
  const locale = useI18nStore((s) => s.locale);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [image, setImage] = useState<PalmImage | null>(null);
  const [locked, setLocked] = useState(false);

  const toPalmImage = (a: ImagePicker.ImagePickerAsset): PalmImage => ({
    uri: a.uri,
    name: a.fileName ?? `palm.${(a.mimeType ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`,
    type: a.mimeType ?? 'image/jpeg',
  });

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled && res.assets[0]) setImage(toPalmImage(res.assets[0]));
  };
  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled && res.assets[0]) setImage(toPalmImage(res.assets[0]));
  };

  const run = useMutation({
    mutationFn: () => analyzeAndWait(image!, gender!, locale),
    onMutate: () => setLocked(false),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) setLocked(true);
    },
  });

  const result = run.data as PalmistryAnalysis | undefined;

  if (result) {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
          <Heading className="mb-4">Your palm reading</Heading>
          <PalmistryResult data={result} imageUri={image?.uri} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        <Heading className="mb-1">Palmistry</Heading>
        <Muted className="mb-5">A clear photo of your dominant palm gives the best reading.</Muted>

        <Card className="mb-4">
          <Text className="text-fg font-medium mb-2">Your gender</Text>
          <Muted className="mb-3 text-xs">Determines which palm is read (right for men, left for women).</Muted>
          <View className="flex-row gap-2">
            {(['male', 'female'] as const).map((g) => (
              <Pressable
                key={g}
                testID={`palm-gender-${g}`}
                onPress={() => setGender(g)}
                className={`flex-1 h-11 rounded-lg items-center justify-center border ${gender === g ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'}`}
              >
                <Text className={`capitalize ${gender === g ? 'text-accent' : 'text-fg-muted'}`}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="mb-4">
          <Text className="text-fg font-medium mb-3">Palm photo</Text>
          {image ? (
            <Image source={{ uri: image.uri }} style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 12 }} contentFit="cover" />
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button testID="palm-capture" title="Take photo" variant="secondary" onPress={capture} />
            </View>
            <View className="flex-1">
              <Button testID="palm-pick" title="Choose photo" variant="secondary" onPress={pick} />
            </View>
          </View>
        </Card>

        {locked ? (
          <Card className="mb-4" testID="palm-locked">
            <Text className="text-fg font-semibold mb-1">Unlock your reading</Text>
            <Muted>Palmistry is a one-time unlock. Purchasing ships with the payments update (P5).</Muted>
          </Card>
        ) : null}

        {run.isError && !locked ? (
          <Muted className="text-danger mb-3">
            {run.error instanceof ApiError ? run.error.message : 'Something went wrong. Please try again.'}
          </Muted>
        ) : null}

        <Button
          testID="palm-analyze"
          title={run.isPending ? 'Reading your palm…' : 'Analyze my palm'}
          loading={run.isPending}
          disabled={!gender || !image}
          onPress={() => run.mutate()}
        />
      </ScrollView>
    </Screen>
  );
}
