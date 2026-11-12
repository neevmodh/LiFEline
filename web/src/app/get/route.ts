// A permanent address for the landing page's QR code: Android phones go to the latest APK, every
// other device to the app on the web. The QR never needs reprinting when a new APK is built.
import { NextResponse, type NextRequest } from "next/server";

import { APK_URL, APP_URL } from "@/lib/links";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const android = /android/i.test(request.headers.get("user-agent") ?? "");
  return NextResponse.redirect(android && APK_URL ? APK_URL : APP_URL, 302);
}
