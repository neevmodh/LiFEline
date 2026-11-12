// Extends app.json with what can't be static: on EAS builds google-services.json (Firebase, for
// Android push) comes from the GOOGLE_SERVICES_JSON file variable, since the file is kept out of
// git; locally it is read from mobile/google-services.json when present.
import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (existsSync("./google-services.json") ? "./google-services.json" : undefined);
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
