import { expect, test, type Page } from "@playwright/test";

const SHOTS = "test-results/screens";

// A tiny valid PNG used as photo proof.
const PROOF_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("demo1234");
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
  await page.getByRole("button", { name: /Planted a tree/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Note").fill("Neem sapling by the gate");
  await dialog.getByLabel("Photo proof").setInputFiles({ name: "tree.png", mimeType: "image/png", buffer: PROOF_PNG });
  await dialog.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Awaiting review")).toBeVisible();
  await snap(page, "04-actions");

  // Community: ward, district and state boards
  await page.getByRole("link", { name: "Community" }).first().click();
  await expect(page.getByText("(you)")).toBeVisible();
  await page.getByRole("button", { name: "My ward" }).click();
  await expect(page.getByText("(you)")).toBeVisible();
  await expect(page.getByText(/aims to avoid 10%/)).toBeVisible();
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

test("phone layout has no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "citizen1@ecosetu.demo");
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
  const login = await request.post("http://localhost:8001/api/auth/login", {
    data: { email: "citizen2@ecosetu.demo", password: "demo1234" },
  });
  const { token } = await login.json();
  const logged = await request.post("http://localhost:8001/api/actions", {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      action_code: "plant_tree",
      note: "Peepal sapling",
      proof: { name: "tree.png", mimeType: "image/png", buffer: PROOF_PNG },
    },
  });
  expect(logged.status()).toBe(201);

  await signIn(page, "admin@ecosetu.demo");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Mission LiFE regional overview")).toBeVisible();
  await expect(page.getByText("District performance")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "Peepal sapling" });
  await expect(row.getByRole("img")).toBeVisible();
  await snap(page, "08-admin");
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row).toHaveCount(0);

  // Citizens can't open the admin area.
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "citizen1@ecosetu.demo");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
});
