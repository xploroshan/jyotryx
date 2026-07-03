import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ApiError,
  endpoints,
  type AuthResponse,
  type OtpSendResponse,
} from '@myastro360/shared';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Screen, Heading, Muted, Button, Card } from '@/components/ui';
import { toE164, isValidOtp } from '@/auth/phone';
import { useGoogleSignIn } from '@/auth/google';

type Mode = 'login' | 'register' | 'phone';

const inputCls = 'h-11 rounded-lg border border-border bg-bg px-3 text-fg mb-3';

/**
 * Sign-in / sign-up. Three first-party modes — email login, email register,
 * phone OTP (backend OTP: /auth/otp/send + /auth/otp/verify, which
 * auto-creates accounts) — plus native Google (/auth/google). All responses
 * carry the NESTED token payload { user, tokens: { accessToken, refreshToken } }.
 */
export default function SignIn() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finishAuth = async (res: AuthResponse) => {
    await setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
    router.replace(res.user.profileComplete ? '/(tabs)' : '/(auth)/onboarding');
  };

  const fail = (e: unknown, fallback: string) =>
    setError(e instanceof ApiError ? e.message : fallback);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      fail(e, fallback);
    } finally {
      setLoading(false);
    }
  };

  const onLogin = () =>
    run(async () => {
      const res = await api.post<AuthResponse>(
        endpoints.auth.login,
        { email, password },
        { skipAuthRefreshOn401: true },
      );
      await finishAuth(res);
    }, 'Sign-in failed. Please try again.');

  const onRegister = () =>
    run(async () => {
      if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        throw new ApiError('Password needs 8+ characters with upper, lower and a digit.');
      }
      const res = await api.post<AuthResponse>(endpoints.auth.register, { name, email, password });
      await finishAuth(res);
    }, 'Could not create your account.');

  const onSendOtp = () =>
    run(async () => {
      const e164 = toE164(phone);
      if (!e164) throw new ApiError('Enter a valid 10-digit mobile number.');
      const res = await api.post<OtpSendResponse>(endpoints.auth.otpSend, { phone: e164 });
      setOtpSent(true);
      // Outside production the API returns the OTP for painless testing.
      setDevOtpHint(res.devOtp ? `Dev OTP: ${res.devOtp}` : '');
    }, 'Could not send the code.');

  const onVerifyOtp = () =>
    run(async () => {
      const e164 = toE164(phone);
      if (!e164 || !isValidOtp(otp)) throw new ApiError('Enter the code you received.');
      const res = await api.post<AuthResponse>(endpoints.auth.otpVerify, {
        phone: e164,
        otp: otp.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      await finishAuth(res);
    }, 'Verification failed. Please try again.');

  const google = useGoogleSignIn((idToken) =>
    run(async () => {
      const res = await api.post<AuthResponse>(endpoints.auth.google, { idToken });
      await finishAuth(res);
    }, 'Google sign-in failed.'),
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-4xl mb-2">🕉️</Text>
          <Heading>MyAstro360</Heading>
          <Muted className="mt-1">Your cosmos, decoded.</Muted>
        </View>

        {/* Mode selector */}
        <View className="flex-row gap-2 mb-4">
          {(
            [
              ['login', 'Sign in'],
              ['register', 'Sign up'],
              ['phone', 'Phone'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <Pressable
              key={m}
              testID={`auth-mode-${m}`}
              onPress={() => {
                setMode(m);
                setError('');
              }}
              className={`flex-1 h-10 rounded-lg items-center justify-center border ${
                mode === m ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'
              }`}
            >
              <Text className={mode === m ? 'text-accent font-medium' : 'text-fg-muted'}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          {error ? (
            <View className="mb-3 rounded-md bg-danger/10 border border-danger/30 p-3">
              <Text className="text-danger text-xs" testID="signin-error">
                {error}
              </Text>
            </View>
          ) : null}

          {mode === 'register' ? (
            <TextInput
              testID="signin-name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#807666"
              autoCapitalize="words"
              className={inputCls}
            />
          ) : null}

          {mode !== 'phone' ? (
            <>
              <TextInput
                testID="signin-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#807666"
                className={inputCls}
              />
              <TextInput
                testID="signin-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="#807666"
                className={inputCls}
              />
              <Button
                testID="signin-submit"
                title={mode === 'login' ? 'Sign in' : 'Create account'}
                loading={loading}
                onPress={mode === 'login' ? onLogin : onRegister}
              />
            </>
          ) : (
            <>
              <TextInput
                testID="signin-phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="10-digit mobile (India)"
                placeholderTextColor="#807666"
                editable={!otpSent}
                className={inputCls}
              />
              {otpSent ? (
                <>
                  {devOtpHint ? <Muted className="mb-2 text-xs">{devOtpHint}</Muted> : null}
                  <TextInput
                    testID="signin-otp"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Enter code"
                    placeholderTextColor="#807666"
                    className={inputCls}
                  />
                  <TextInput
                    testID="signin-otp-name"
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name (new accounts)"
                    placeholderTextColor="#807666"
                    autoCapitalize="words"
                    className={inputCls}
                  />
                  <Button testID="signin-verify-otp" title="Verify & continue" loading={loading} onPress={onVerifyOtp} />
                  <Pressable
                    className="items-center py-2 mt-1"
                    onPress={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                  >
                    <Muted className="text-xs">Change number</Muted>
                  </Pressable>
                </>
              ) : (
                <Button testID="signin-send-otp" title="Send code" loading={loading} onPress={onSendOtp} />
              )}
            </>
          )}

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-border" />
            <Muted className="mx-3">or</Muted>
            <View className="flex-1 h-px bg-border" />
          </View>

          <Button
            testID="signin-google"
            title={google.available ? 'Continue with Google' : 'Google sign-in (not configured)'}
            variant="secondary"
            disabled={!google.available}
            onPress={google.prompt}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
