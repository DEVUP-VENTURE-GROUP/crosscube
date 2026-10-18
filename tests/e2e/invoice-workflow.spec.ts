import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = "artifacts/screens";
mkdirSync(SHOTS, { recursive: true });

const USER = "e2e-admin";
const PASSWORD = "e2e-correct-horse-battery";

async function signIn(page: Page, next = "/invoice") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("sign in", () => {
  test("protects pages and APIs and returns to the requested page after login", async ({ page, request }) => {
    expect((await request.get("/api/reference-data")).status()).toBe(401);
    await page.goto("/catalog");
    await expect(page).toHaveURL(/\/login\?next=%2Fcatalog/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Sign in to continue.")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/login.png` });

    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect username or password.");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await page.screenshot({ path: `${SHOTS}/login-error.png` });

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.getByText(USER, { exact: true })).toBeVisible();

    const cookie = (await page.context().cookies()).find((c) => c.name === "inv_session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");

    await page.goto("/login");
    await expect(page).toHaveURL(/\/invoice/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/invoices");
    await expect(page).toHaveURL(/\/login\?next=%2Finvoices/);
  });

  test("rejects a forged session cookie", async ({ page, context }) => {
    await context.addCookies([{ name: "inv_session", value: "eyJ1IjoiYWRtaW4iLCJpYXQiOjEsImV4cCI6OTk5OTk5OTk5OX0.AAAA", url: "http://localhost:3100" }]);
    await page.goto("/invoice");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page works on mobile", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/login-mobile.png` });
    await context.close();
  });
});

async function addFromSearch(page: Page, query: string, option: string) {
  const search = page.getByRole("combobox", { name: "Search parts, labor and fees" });
  await search.fill(query);
  const match = page.getByRole("listbox").getByRole("option", { name: new RegExp(option) }).first();
  await expect(match).toBeVisible();
  await match.click();
}

test("operator builds, finalizes and downloads the reference invoice", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await expect(page).toHaveURL(/id=.+&tab=items/);

  await page.getByLabel("Name", { exact: true }).fill("Pat Example");
  await page.getByLabel("Company").fill("Catodrive");
  await page.getByLabel("Phone type").selectOption("Office");
  await page.getByLabel("Phone", { exact: true }).fill("(555) 010-3321");
  await page.getByLabel("Customer #").fill("8654");
  await page.getByLabel("Year").fill("2024");
  await page.getByLabel("Make").fill("Volkswagen");
  await page.getByLabel("Model").fill("Atlas");
  await page.getByLabel("Trim").fill("SEL");
  await page.getByLabel("Engine").fill("2L, In-Line4 (121CI)");
  await page.getByLabel("VIN").fill("1M8GDM9AXKP042788");
  await page.getByLabel("Odometer").fill("5132");

  await page.getByRole("combobox", { name: "Search parts, labor and fees" }).fill("motor");
  await expect(page.getByRole("listbox").getByRole("option", { name: /Motor Oil EDGE 0W-20 Euro Car 1QT/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/search-motor.png` });
  await page.getByRole("listbox").getByRole("option", { name: /Motor Oil EDGE/ }).click();

  const quantity = page.getByRole("textbox", { name: "Quantity" }).first();
  await quantity.fill("6");
  await quantity.press("Enter");

  await addFromSearch(page, "oil filter", "Oil Filter Kit");
  await expect(page.getByText("Labor configured for Oil Filter Kit")).toBeVisible();
  await page.getByRole("button", { name: "Add labor" }).click();
  await page.getByRole("button", { name: /\+ Shop Supplies/ }).click();
  await page.getByRole("button", { name: /\+ Hazardous Materials/ }).click();
  await expect(page.getByRole("button", { name: /\+ Shop Supplies/ })).toBeDisabled();

  const totals = page.getByTestId("invoice-totals").first();
  await expect(totals).toContainText("$134.15");
  await expect(totals).toContainText("$110.40");
  await expect(totals).toContainText("$262.05");
  await expect(totals).toContainText("$10.73");
  await expect(totals).toContainText("$272.78");

  const preview = page.locator("[data-invoice-document]");
  await expect(preview).toContainText("CATODRIVE - PAT EXAMPLE");
  await expect(preview).toContainText("93.60");
  await expect(preview).toContainText("DRAFT");
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${SHOTS}/add-items.png`, fullPage: true });

  await page.getByRole("link", { name: "Create Invoice" }).click();
  await expect(page).toHaveURL(/tab=invoice/);
  await expect(preview).toContainText("272.78");
  await page.getByRole("button", { name: "Add payment" }).click();
  await expect(page.getByTestId("invoice-totals").first()).toContainText("$0.00");
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Finalize invoice" }).click();
  const confirm = page.getByRole("button", { name: "Confirm & finalize" });
  await confirm.dblclick();
  await expect(page.getByRole("heading", { name: /^Invoice \d+$/ })).toBeVisible({ timeout: 15_000 });
  const number = (await page.getByRole("heading", { name: /^Invoice \d+$/ }).textContent())!.replace("Invoice ", "");
  await expect(preview).not.toContainText("DRAFT");
  await expect(preview).toContainText("Payments - Credit Card - $272.78");
  await page.screenshot({ path: `${SHOTS}/create-invoice-finalized.png`, fullPage: true });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`invoice-${number}.pdf`);
  const file = `artifacts/pdf/e2e-${number}.pdf`;
  await download.saveAs(file);
  expect(readFileSync(file).subarray(0, 5).toString()).toBe("%PDF-");

  await page.reload();
  await expect(page.getByRole("heading", { name: `Invoice ${number}` })).toBeVisible();
  await page.getByRole("link", { name: "Add Items" }).click();
  await expect(page.getByText(/is finalized; its items and prices are locked/)).toBeVisible();

  await page.goto("/invoices");
  await expect(page.getByRole("link", { name: number })).toBeVisible();
  const finalizedCount = await page.getByRole("link", { name: number }).count();
  expect(finalizedCount).toBe(1);
});

test("unsaved required fields block finalization with clear messages", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "New invoice" }).click();
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await page.getByRole("link", { name: "Create Invoice" }).click();
  await expect(page.getByTestId("issue-list")).toContainText("Customer name is required.");
  await expect(page.getByTestId("issue-list")).toContainText("Add at least one part");
  await expect(page.getByRole("button", { name: "Finalize invoice" })).toBeDisabled();
});

test("catalog and settings pages load", async ({ page }) => {
  await signIn(page, "/catalog");
  await expect(page.getByRole("cell", { name: /Motor Oil EDGE/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/catalog.png`, fullPage: true });
  await page.goto("/settings");
  await expect(page.getByLabel("Business name")).toHaveValue("Demo Auto Repair (sample business)");
  await page.screenshot({ path: `${SHOTS}/settings.png`, fullPage: true });
});

test("mobile layout stacks editor and preview with a sticky action bar", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review & create", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/mobile.png`, fullPage: true });
  await context.close();
});
