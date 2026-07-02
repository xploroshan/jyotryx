import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, endpoints, type AuthResponse } from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Button, Card } from '@/components/ui';

/**
 * Sign-in. Email/password runs end-to-end against the shared api client
 * (POST /auth/login). Phone OTP + Google use @react-native-firebase and land
 * in the P1 auth milestone — the buttons are present so the flow is visible.
 */
export default function SignIn() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>(endpoints.auth.login, { email, password });
      await setAuth(res.user, res.accessToken, res.refreshToken);
      router.replace(res.user.profileComplete ? '/(tabs)' : '/(auth)/onboarding');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="justify-center">
      <View className="items-center mb-8">
        <Text className="text-4xl mb-2">🕉️</Text>
        <Heading>MyAstro360</Heading>
        <Muted className="mt-1">Your cosmos, decoded.</Muted>
      </View>

      <Card>
        {error ? (
          <View className="mb-3 rounded-md bg-danger/10 border border-danger/30 p-3">
            <Text className="text-danger text-xs" testID="signin-error">
              {error}
            </Text>
          </View>
        ) : null}

        <Text className="text-fg-muted text-xs mb-1">Email</Text>
        <TextInput
          testID="signin-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#807666"
          className="h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-3"
        />

        <Text className="text-fg-muted text-xs mb-1">Password</Text>
        <TextInput
          testID="signin-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#807666"
          className="h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-4"
        />

        <Button testID="signin-submit" title="Sign in" loading={loading} onPress={onSubmit} />

        <View className="flex-row items-center my-4">
          <View className="flex-1 h-px bg-border" />
          <Muted className="mx-3">or</Muted>
          <View className="flex-1 h-px bg-border" />
        </View>

        <View className="gap-2">
          <Button title="Continue with phone (OTP)" variant="secondary" onPress={() => {}} />
          <Button title="Continue with Google" variant="secondary" onPress={() => {}} />
        </View>
      </Card>

      <Pressable className="mt-6 items-center" onPress={() => {}}>
        <Muted>New here? Create an account</Muted>
      </Pressable>
    </Screen>
  );
}
