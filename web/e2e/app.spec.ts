import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API = `http://localhost:${process.env.E2E_API_PORT ?? 8021}`;
const PASSWORD = "e2e-citizen-pass-1";
let n = 0;
const uniq = () => `${Date.now()}${n++}`;

const HOUSEHOLD = {
  monthly_kwh: 300, members: 4, lpg_cylinders_per_month: 1, commute_mode: "two_wheeler", commute_km_per_day: 8,
  home_type: "apartment", ac_count: 2, has_geyser: true, has_washing_machine: true, has_ev: false, has_solar: false,
  roof_area_sqm: 40, discom: "dgvcl", area: "urban",
};

async function createCitizen(request: APIRequestContext, name = "Asha Patel") {
  const email = `e2e${uniq()}@example.com`;
  const reg = await request.post(`${API}/api/auth/register`, { data: { email, password: PASSWORD, name, district_id: 1, ward: "Ward 3" } });
  expect(reg.status()).toBe(201);
  const { token } = await reg.json();
  const hh = await request.put(`${API}/api/household`, { headers: { Authorization: `Bearer ${token}` }, data: HOUSEHOLD });
  expect(hh.status()).toBe(200);
  return { email, token };
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("free check, then keep the plan: sign up, see the plan, tick a step", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Units on your last bill (kWh)").fill("266");
  await page.getByRole("button", { name: "Show my savings" }).click();
  const result = page.getByTestId("check-result");
  await expect(result).toContainText("You could save about");
  await expect(result).toContainText("₹");
  await expect(result.getByRole("listitem")).toHaveCount(3);

  await result.getByRole("link", { name: "Keep my plan" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByLabel("Units on your last bill (kWh a month)")).toHaveValue("266"); // carried over
  await page.getByLabel("Your name").fill("Asha Patel");
  await page.getByLabel("Email").fill(`e2e${uniq()}@example.com`);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("District").selectOption({ label: "Surat" });
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Save about ₹");
  await expect(page.getByRole("button", { name: "I did this" })).toHaveCount(3); // top three steps first
  await page.getByRole("button", { name: "I did this" }).first().click();
  await expect(page.getByText("✓ Done")).toBeVisible();
  await expect(page.getByRole("img", { name: "1/6" })).toBeVisible();
  await page.getByRole("button", { name: /Show \d+ more steps/ }).click();
  await expect(page.getByRole("button", { name: "I did this" }).first()).toBeVisible();
});

test("phone: no sideways scrolling on the main screens", async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.goto("/");
  expect(await noOverflow()).toBe(true);
  await page.goto("/join");
  expect(await noOverflow()).toBe(true);
  const c = await createCitizen(request);
  await signIn(page, c.email);
  await expect(page).toHaveURL(/\/home$/);
  expect(await noOverflow()).toBe(true);
  for (const tab of ["Together", "You"]) {
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`/${tab.toLowerCase()}$`));
    expect(await noOverflow()).toBe(true);
  }
  await ctx.close();
});

test("together: start a society, get a code, totals stay hidden until 5 households", async ({ page, request }) => {
  const c = await createCitizen(request, "Chair Person");
  await signIn(page, c.email);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/together");
  await page.getByLabel("Society or ward name").fill("Shanti Apartments");
  await page.getByRole("button", { name: "Start a society" }).click();
  await expect(page.getByRole("heading", { name: "Shanti Apartments" })).toBeVisible();
  await expect(page.getByTestId("join-code")).toHaveText(/^[A-Z2-9]{8}$/);
  await expect(page.getByText(/Totals appear once 5 households have joined/)).toBeVisible();
});

test("GEDA staff land on the overview, citizens cannot open it", async ({ page, request }) => {
  await signIn(page, "officer@example.com", "e2e-admin-pass");
  await expect(page).toHaveURL(/\/geda$/);
  await expect(page.getByRole("heading", { name: "Mission LiFE regional overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Rooftop sunshine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Photos to review" })).toBeVisible();

  const c = await createCitizen(request);
  await page.evaluate(() => localStorage.clear());
  await signIn(page, c.email);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/geda");
  await expect(page).toHaveURL(/\/home$/);
});

test("your data: download, then delete the account for good", async ({ page, request }) => {
  const c = await createCitizen(request);
  await signIn(page, c.email);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/you");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL(/\/$/);
  const again = await request.post(`${API}/api/auth/login`, { data: { email: c.email, password: PASSWORD } });
  expect(again.status()).toBe(401);
});
