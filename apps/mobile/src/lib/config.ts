import Constants from 'expo-constants';

/** Public web origin — used to build shareable `/match/:token` links. */
export const WEB_ORIGIN =
  (Constants.expoConfig?.extra?.webOrigin as string | undefined) ?? 'https://www.myastro360.com';
