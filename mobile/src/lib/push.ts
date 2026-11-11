// Alerts on the phone: Green Hours, the evening peak, a bill reminder and GEDA Peak Hour Challenges.
// The API decides what to send and when (backend/app/services/push.py); the app only registers this
// device's Expo push token. Web builds and simulators don't get alerts, and a refusal is final until
// the person changes it in settings, so failures are silent: alerts are a bonus, never a blocker.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

let registered = false;

export async function registerForAlerts(): Promise<void> {
  if (registered || Platform.OS === "web" || !Device.isDevice) return;
  registered = true;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("alerts", {
        name: "Nidhi alerts",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.registerPush(token);
  } catch (e) {
    registered = false; // try again next launch (e.g. no network, or push credentials not set up yet)
    console.warn("Push registration failed", e);
  }
}
