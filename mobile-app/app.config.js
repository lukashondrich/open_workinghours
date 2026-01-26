/**
 * Expo Config
 *
 * Extends app.json with dynamic values (environment variables).
 * Edit app.json for most config changes - this file only adds:
 * - Google Maps API key from EAS secrets
 * - TEST_MODE from environment
 */

import appJson from './app.json';

export default {
  ...appJson,
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        ...appJson.expo.android.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    extra: {
      ...appJson.expo.extra,
      // Use env var if set, otherwise use app.json value
      TEST_MODE: process.env.TEST_MODE !== undefined
        ? process.env.TEST_MODE === 'true'
        : appJson.expo.extra.TEST_MODE,
    },
  },
};
