// Where households go: the Nidhi app (Expo) on the web and as an Android APK. Set per deployment.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8081";
/** The Android APK from EAS; empty until the build exists, and then the landing page offers the web app instead. */
export const APK_URL = process.env.NEXT_PUBLIC_APK_URL ?? "";
