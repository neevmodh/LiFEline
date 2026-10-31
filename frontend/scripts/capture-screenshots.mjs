// Capture the README screenshots from a running app.
//
//   1. Start the API (seeded with `python -m app.seed --demo`) and `npm run dev`.
//   2. npm run screenshots            # writes ../docs/screenshots/*.png
//
// Set BASE_URL to point elsewhere. Uses the installed Chrome locally (no browser download).
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../../docs/screenshots/", import.meta.url).pathname;
const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });

async function newPage({ width = 1280, height = 820, scheme = "light", mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    isMobile: mobile,
    hasTouch: mobile,
  });
  // Hide the Next.js dev-mode badge, and unstick the header so it can't cover element shots.
  await context.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; } header { position: static !important; }";
      document.head.append(style);
    });
  });
  return context.newPage();
}

async function demoLogin(page, who) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: new RegExp(`Try as (a )?${who}`) }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function shot(page, name, target) {
  await settle();
  await (target ?? page).screenshot({ path: `${OUT}${name}.png` });
  console.log("✓", name);
}

/** A realistic bi-monthly DGVCL bill, rendered and photographed for the bill-scan shot. */
async function billPhoto() {
  const page = await newPage({ width: 640, height: 430 });
  await page.setContent(`
    <body style="font: 21px/1.6 Arial, sans-serif; padding: 26px; background: #fff; color: #000">
      <div style="font-size: 24px; font-weight: bold">DAKSHIN GUJARAT VIJ COMPANY LTD</div>
      <div>Bill Period 01/07/2026 To 30/08/2026 &nbsp; Billing Days : 61</div>
      <table style="font-size: 19px; border-collapse: collapse; margin-top: 8px" border="1" cellpadding="6">
        <tr><th>Present Reading</th><th>Previous Reading</th><th>Units</th></tr>
        <tr><td>14520</td><td>13980</td><td>540</td></tr>
      </table>
      <div style="font-weight: bold; margin-top: 8px">Net Amount Payable Rs. 4,215.50</div>
    </body>`);
  const buffer = await page.screenshot();
  await page.context().close();
  return buffer;
}

// Landing and login
{
  const page = await newPage();
  await page.goto(BASE);
  await shot(page, "landing");
  await page.goto(`${BASE}/login`);
  await shot(page, "login");
  await page.context().close();
}

// New citizen: onboarding with a scanned bill
{
  const page = await newPage({ height: 860 });
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Your name").fill("Riya Patel");
  await page.getByLabel("Email").fill(`riya.${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("demo-pass-123");
  await page.getByLabel("District").selectOption({ label: "Surat" });
  await page.getByLabel("Ward / area").fill("Ward 4");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.getByLabel("Usable roof area (m²)").fill("40");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Electricity bill photo").setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: await billPhoto() });
  await page.getByText("kWh per month").waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Use this" }).click();
  await shot(page, "onboarding-bill-scan");
  await page.context().close();
}

// Demo citizen: dashboard, actions, community, solar
{
  const page = await newPage({ height: 1000 });
  await demoLogin(page, "citizen");
  await page.getByText("Right now").waitFor();
  await shot(page, "dashboard");

  await page.goto(`${BASE}/actions`);
  await page.getByText("Your recent actions").waitFor();
  await shot(page, "actions");

  await page.goto(`${BASE}/community`);
  await page.locator("path.leaflet-interactive").first().waitFor();
  await shot(page, "community");

  await page.goto(`${BASE}/solar`);
  await page.getByRole("button", { name: "Calculate" }).click();
  await page.getByText("Recommended system").waitFor({ timeout: 30_000 });
  await shot(page, "solar");
  await page.context().close();
}

// Phone
{
  const page = await newPage({ width: 390, height: 844, mobile: true });
  await demoLogin(page, "citizen");
  await page.getByText("Right now").waitFor();
  await shot(page, "mobile-dashboard");
  await page.context().close();
}

// GEDA admin: overview and district explorer, light and dark
for (const scheme of ["light", "dark"]) {
  const page = await newPage({ width: 1440, height: 900, scheme });
  await demoLogin(page, "GEDA admin");
  const explorer = page.locator("section").filter({ has: page.getByRole("heading", { name: "District explorer" }) });
  await explorer.locator("path.leaflet-interactive").first().waitFor();
  await explorer.getByText("Rooftop solar pipeline").waitFor({ timeout: 20_000 });
  if (scheme === "light") {
    await shot(page, "admin-overview");
    await explorer.getByRole("tab", { name: "Solar potential" }).click();
  }
  await page.mouse.move(0, 0);
  await shot(page, `admin-explorer-${scheme}`, explorer);
  await page.context().close();
}

await browser.close();
console.log(`Saved to ${OUT}`);
