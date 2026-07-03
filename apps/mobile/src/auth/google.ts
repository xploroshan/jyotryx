/**
 * Native Google sign-in → backend session.
 *
 * Uses expo-auth-session's ID-TOKEN flow: the resulting Google id token's
 * audience is the WEB client id, which must equal the server's
 * GOOGLE_CLIENT_ID — that's what `POST /auth/google` verifies against
 * (oauth2.googleapis.com/tokeninfo + aud check). NOT /auth/firebase: that
 * endpoint expects a Firebase-minted token and would reject a raw Google one.
 *
 * Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (same value as the API's
 * GOOGLE_CLIENT_ID); the hook reports `available: false` without it.
 */
import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const webClientId =
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ??
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function useGoogleSignIn(onIdToken: (idToken: string) => void): {
  available: boolean;
  prompt: () => void;
} {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as Record<string, string>)?.id_token;
      if (idToken) onIdToken(idToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    available: !!webClientId && !!request,
    prompt: () => {
      promptAsync();
    },
  };
}
