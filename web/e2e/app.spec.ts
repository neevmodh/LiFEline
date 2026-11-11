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

test("GEDA staff land on the overview, citizens cannot open it", async ({ page, request }) => {
  await signIn(page, "officer@example.com", "e2e-admin-pass");
  await expect(page).toHaveURL(/\/geda$/);
  await expect(page.getByRole("heading", { name: "Mission LiFE regional overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Rooftop sunshine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Photos to review" })).toBeVisible();

  const c = await createCitizen(request);
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem("nidhi.token", t); }, c.token);
  await page.goto("/geda");
  await expect(page).toHaveURL(/\/$/); // households use the app, not the console
});

test("GEDA console: funnel, themes, communities, and a Peak Hour Challenge created from the console", async ({ page, request }) => {
  const c = await createCitizen(request);
  await request.post(`${API}/api/actions`, { headers: { Authorization: `Bearer ${c.token}` }, multipart: { action_code: "cycle_walk" } });
  await signIn(page, "officer@example.com", "e2e-admin-pass");
  await expect(page).toHaveURL(/\/geda$/);

  const funnel = page.getByRole("region", { name: /From sign-up to verified action/ });
  await expect(funnel.getByText("Registered")).toBeVisible();
  await expect(funnel.getByText("Acted this week")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mission LiFE themes, last 30 days" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();

  await page.getByRole("button", { name: /New Peak Hour Challenge/ }).click();
  await page.getByLabel("Title").fill("E2E evening peak");
  await page.getByLabel("From (hour, 0-23)").fill("18");
  await page.getByLabel("To (hour, 1-24)").fill("20");
  await page.getByRole("button", { name: "Create" }).click();
  const campaigns = page.getByRole("region", { name: /Campaigns and Peak Hour Challenges/ });
  await expect(campaigns.getByText("⚡ E2E evening peak")).toBeVisible();
  await expect(campaigns.getByText(/18:00–20:00/)).toBeVisible();
});

test("landing: free check, then keep the plan in the app with the answers", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Units on your last bill (kWh)").fill("266");
  await page.getByRole("button", { name: "Show my savings" }).click();
  const result = page.getByTestId("check-result");
  await expect(result).toContainText("You could save about");
  await expect(result.getByRole("listitem")).toHaveCount(3);
  const keep = await result.getByRole("link", { name: "Keep my plan" }).getAttribute("href");
  const url = new URL(keep!);
  expect(JSON.parse(url.searchParams.get("guest")!).monthly_kwh).toBe(266); // the app's onboarding starts from these
});

test("landing: get the app, open the web app, GEDA sign-in, and no dead links", async ({ page, request }) => {
  await page.goto("/");
  const get = page.getByRole("region", { name: "Get Nidhi" });
  await expect(get.getByRole("img", { name: "QR code to get the Nidhi app" }).locator("svg")).toBeVisible();
  await expect(get.getByRole("link", { name: "Open the Nidhi app" })).toHaveAttribute("href", /^https?:\/\//);
  await get.getByRole("link", { name: "GEDA sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  const internal = await page.locator('a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!.split("#")[0] || "/"))]);
  for (const href of internal) expect((await request.get(href)).status(), href).toBe(200);
  for (const gone of ["/home", "/join", "/together", "/you"]) expect((await request.get(gone)).status(), gone).toBe(404);
});

test("phone: no sideways scrolling on the public pages", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const path of ["/", "/login", "/methodology"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
  await ctx.close();
});

test("households who sign in here are pointed to the app", async ({ page, request }) => {
  const c = await createCitizen(request);
  await signIn(page, c.email);
  await expect(page.getByText("Households use the Nidhi app")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

