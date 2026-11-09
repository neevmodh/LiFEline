import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SHOTS = "test-results/screens";
const API = "http://localhost:8001";
const PASSWORD = "secret123";
// Created by `python -m app.create_admin` when the test API starts (playwright.config.ts).
const ADMIN = { email: "officer@example.com", password: "e2e-admin-pass" };

/** A distinct, non-blank photo for each proof (blank or reused photos are rejected). */
async function proofPhoto(page: Page, label: string, hue: number): Promise<Buffer> {
  const shot = await page.context().newPage();
  await shot.setViewportSize({ width: 480, height: 360 });
  await shot.setContent(`
    <body style="margin:0;height:360px;display:grid;place-items:center;font:bold 40px Arial;color:#fff;
      background:linear-gradient(${hue}deg,hsl(${hue},60%,30%),hsl(${(hue + 120) % 360},70%,60%))">
      <div style="transform:rotate(${hue % 30}deg)">${label}</div>
    </body>`);
  const buf = await shot.screenshot();
  await shot.close();
  return buf;
}

/** A real citizen signed up and onboarded through the API; returns the email. */
async function createCitizen(request: APIRequestContext, name: string): Promise<{ email: string; token: string }> {
  const email = `${name.toLowerCase().replace(/\W/g, "")}${Date.now()}@example.com`;
  const reg = await request.post(`${API}/api/auth/register`, {
    data: { email, password: PASSWORD, name, district_id: 1, ward: "Ward 2" },
  });
  expect(reg.status()).toBe(201);
  const { token } = await reg.json();
  const household = await request.put(`${API}/api/household`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      monthly_kwh: 220, members: 4, lpg_cylinders_per_month: 1, commute_mode: "two_wheeler", commute_km_per_day: 12,
      home_type: "apartment", ac_count: 1, has_geyser: true, has_washing_machine: true, has_ev: false,
      has_solar: false, roof_area_sqm: 30, discom: "ugvcl", area: "urban",
    },
  });
  expect(household.status()).toBe(200);
  return { email, token };
}

/** Render a realistic bi-monthly bill and photograph it, so the OCR path reads real pixels. */
async function billPhoto(page: Page): Promise<Buffer> {
  const bill = await page.context().newPage();
  await bill.setViewportSize({ width: 700, height: 520 });
  await bill.setContent(`
    <body style="font: 22px/1.6 Arial, sans-serif; padding: 28px; background: #fff; color: #000">
      <div style="font-size: 26px; font-weight: bold">DAKSHIN GUJARAT VIJ COMPANY LTD</div>
      <div>Bill Period 01/07/2026 To 30/08/2026</div>
      <div>Billing Days : 61</div>
      <div>Present Reading 14520</div>
      <div>Previous Reading 13980</div>
      <div style="font-weight: bold">Units Consumed : 540</div>
      <div>Net Amount Payable Rs. 4215.50</div>
    </body>`);
  const shot = await bill.screenshot();
  await bill.close();
  return shot;
}

/** Visible form control by label. Next keeps visited routes mounted (hidden), so labels can repeat. */
function field(page: Page, label: string, exact = false) {
  return page.getByLabel(label, { exact }).filter({ visible: true });
}

/** Full-page screenshot for the deck/README, after chart animations settle. */
async function snap(page: Page, name: string) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("citizen journey: sign up, scan a bill, act, compete, check solar", async ({ page }) => {
  // On-device OCR downloads its language model on first use.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Small daily choices");
  await snap(page, "01-landing");

  // Register
  await page.getByRole("link", { name: "Get started" }).click();
  await field(page, "Your name").fill("Riya Test");
  await field(page, "Email").fill(`riya${Date.now()}@example.com`);
  await field(page, "Password").fill("secret123");
  await field(page, "District").selectOption({ label: "Surat" });
  await field(page, "Ward / area").fill("Ward 4");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Onboarding with a scanned bill. No AI key is configured, so this exercises on-device OCR.
  await field(page, "Usable roof area (m²)").fill("40");
  await page.getByRole("button", { name: "Continue" }).click();
  // The file input itself is visually hidden behind the "Scan bill" button.
  await page.getByLabel("Electricity bill photo").setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: await billPhoto(page) });
  const found = page.getByRole("status").filter({ hasText: "kWh per month" });
  await expect(found).toContainText("540 units over 61 days", { timeout: 90_000 });
  await expect(found).toContainText("Read on your device");
  await snap(page, "02-onboarding-bill-scan");
  await found.getByRole("button", { name: "Use this" }).click();
  await expect(field(page, "Units (kWh) per month")).toHaveValue("266");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "See my dashboard" }).click();

  // Dashboard
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Today's challenge")).toBeVisible();
  await expect(page.getByText("Right now")).toBeVisible();
  await snap(page, "03-dashboard");
  await page.getByRole("button", { name: "I did this" }).click();
  await expect(page.getByText(/\+\d+ points/)).toBeVisible();
  await expect(page.getByText("Done ✓")).toBeVisible();

  // Log a monthly reading
  await field(page, "Units (kWh)", true).fill("240");
  await page.getByRole("button", { name: "Add bill" }).click();
  await expect(page.getByText(/vs baseline/)).toBeVisible();

  // Action with photo proof goes to review
  await page.getByRole("link", { name: "Actions" }).first().click();
  const tree = await proofPhoto(page, "Neem sapling", 110);
  await page.getByRole("button", { name: /Planted a tree/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/For your household/)).toBeVisible();
  await dialog.getByLabel("Note").fill("Neem sapling by the gate");
  await dialog.getByLabel("Photo proof").setInputFiles({ name: "tree.png", mimeType: "image/png", buffer: tree });
  await dialog.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Awaiting review")).toBeVisible();
  await snap(page, "04-actions");

  // The same photo can't back a second claim. (Walking is allowed twice a day, so the daily cap
  // can't interfere even when it is today's challenge and was already logged above.)
  await page.getByRole("button", { name: /Walked or cycled/ }).click();
  await dialog.getByLabel("Photo proof").setInputFiles({ name: "again.png", mimeType: "image/png", buffer: tree });
  await dialog.getByRole("button", { name: "Submit for review" }).click();
  await expect(dialog.getByText(/already been submitted/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Community: ward, district and state boards
  await page.getByRole("link", { name: "Community" }).first().click();
  await expect(page.getByText("(you)")).toBeVisible();
  await page.getByRole("button", { name: "My ward" }).click();
  await expect(page.getByText("(you)")).toBeVisible();
  await expect(page.getByText(/aims to avoid 10%/)).toBeVisible();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(33); // all Gujarat districts
  await snap(page, "05-community");

  // Solar, prefilled from onboarding
  await page.getByRole("link", { name: "Solar" }).first().click();
  await expect(field(page, "Shadow-free roof area (m²)")).toHaveValue("40");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("Recommended system")).toBeVisible();
  await expect(page.getByText("Gujarat average")).toBeVisible(); // PVGIS is disabled in tests
  await snap(page, "06-solar");

  // Profile edits persist
  await page.getByRole("link", { name: "Riya Test" }).click();
  await field(page, "Name", true).fill("Riya T");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByRole("link", { name: "Riya T", exact: true })).toBeVisible();

  // Sign out returns to the landing page
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors).toEqual([]);
});

test("phone layout has no horizontal scroll", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { email } = await createCitizen(request, "Mobile Tester");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Today's challenge")).toBeVisible();
  for (const path of ["/dashboard", "/actions", "/community", "/solar", "/profile"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `${path} scrolls horizontally`).toBe(false);
  }
  await page.goto("/dashboard");
  await snap(page, "07-dashboard-mobile");
});

test("admin reviews proof and sees regional analytics", async ({ page, request }) => {
  // A citizen submits a proof through the API so the queue isn't empty.
  const citizen = await createCitizen(request, "Peepal Planter");
  const logged = await request.post(`${API}/api/actions`, {
    headers: { Authorization: `Bearer ${citizen.token}` },
    multipart: {
      action_code: "plant_tree",
      note: "Peepal sapling",
      proof: { name: "tree.png", mimeType: "image/png", buffer: await proofPhoto(page, "Peepal sapling", 200) },
    },
  });
  expect(logged.status()).toBe(201);

  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Mission LiFE regional overview")).toBeVisible();
  await expect(page.getByText("District performance")).toBeVisible();

  // District explorer: real boundaries for all 33 districts, metric switching, selection, tooltips.
  const explorer = page.locator("section").filter({ has: page.getByRole("heading", { name: "District explorer" }) });
  await expect(explorer.locator("path.leaflet-interactive")).toHaveCount(33);
  await expect(explorer.getByText("CO₂ avoided, last 30 days")).toBeVisible();
  await explorer.getByRole("tab", { name: "Solar potential" }).click();
  await expect(explorer.getByText("Untapped rooftop solar")).toBeVisible();
  await expect(explorer.getByText("Rooftop solar pipeline")).toBeVisible();

  await page.getByRole("row").filter({ hasText: "Surat" }).click();
  await expect(explorer.getByRole("heading", { level: 3 })).toHaveText("Surat");
  await expect(explorer.getByText("Leading wards · 30 days")).toBeVisible();

  // Hover central Gujarat: exactly one tooltip, for the district under the pointer.
  const map = explorer.locator(".leaflet-container");
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  const tooltip = page.getByRole("tooltip").filter({ visible: true });
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip).toContainText("Untapped rooftop solar");
  await page.mouse.move(box.x + 5, box.y + box.height - 5); // off Gujarat, over the sea
  await expect(tooltip).toHaveCount(0);
  const row = page.getByRole("listitem").filter({ hasText: "Peepal sapling" });
  await expect(row.getByRole("img")).toBeVisible();
  await snap(page, "08-admin");
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row).toHaveCount(0);

  // Citizens can't open the admin area.
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, citizen.email);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("booth mode: a new sign-up appears live on the GEDA screen", async ({ page, request }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Booth mode" }).click();
  await expect(page.getByRole("img", { name: /QR code to sign up/ })).toBeVisible();

  // A judge signs up on their own phone while the booth screen is open.
  const { token } = await createCitizen(request, "Kiran Booth");
  await request.post(`${API}/api/actions`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { action_code: "standby_off" },
  });

  const kiran = page.getByRole("listitem").filter({ hasText: "Kiran" });
  await expect(kiran.filter({ hasText: "joined Mission LiFE" })).toBeVisible({ timeout: 15_000 });
  await expect(kiran.filter({ hasText: "Switched off at the plug" })).toBeVisible();
  await expect(kiran.first()).not.toContainText("Booth"); // first name only
  await snap(page, "09-booth-mode");
});
