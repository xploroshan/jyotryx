import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo app config. `myastro360://` scheme + universal links power the payment
 * return flow and notification deep-links (see docs/mobile/ANDROID_APP_PLAN.md
 * §3, §5). EAS env drives the API base + Firebase + Sentry at build time.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MyAstro360',
  slug: 'myastro360',
  scheme: 'myastro360',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ede4d0',
  },
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.myastro360.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ede4d0',
    },
    // Universal links back into the app from the web checkout return + emails.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'myastro360.com', pathPrefix: '/app' },
          // Shared compatibility links open in-app (app/match/[token]).
          { scheme: 'https', host: 'myastro360.com', pathPrefix: '/match' },
          { scheme: 'https', host: 'www.myastro360.com', pathPrefix: '/match' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    bundleIdentifier: 'com.myastro360.app',
    supportsTablet: false,
    associatedDomains: ['applinks:myastro360.com'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    ['expo-camera', { cameraPermission: 'MyAstro360 uses the camera to capture your palm for palmistry readings.' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'MyAstro360 accesses your photos so you can upload a palm image for a reading.',
        cameraPermission: 'MyAstro360 uses the camera to capture your palm for palmistry readings.',
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#c43200' }],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    ['@sentry/react-native/expo', { organization: 'myastro360', project: 'mobile' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myastro360.com/api',
    webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'https://www.myastro360.com',
    // Must equal the API's GOOGLE_CLIENT_ID (the /auth/google audience check).
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    router: { origin: false },
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
