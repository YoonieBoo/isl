import { chromium } from "playwright";
const AUTH = process.argv[2];
const ENV_ID = "27723030-60b8-42fb-8bf2-72a0514e4794";
const browser = await chromium.launch();
const context = await browser.newContext({ storageState: AUTH });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`http://localhost:3000/datasets?environment=${ENV_ID}`);
await page.waitForLoadState("networkidle");
const links = await page.locator("table tbody tr td a").allInnerTexts();
console.log(JSON.stringify({ datasets: links }));

// Open and validate the first pending dataset.
await page.locator("table tbody tr td a").first().click();
await page.waitForLoadState("networkidle");
const idColValue = await page.locator("#idColumn").inputValue().catch(() => "");
const nameColValue = await page.locator("#nameColumn").inputValue().catch(() => "");
console.log(JSON.stringify({ idColValue, nameColValue }));

if (idColValue) {
  await page.locator("button:has-text('Run validation')").click();
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForLoadState("networkidle");
  const summary = await page.locator("dl").first().innerText().catch(() => "no summary");
  console.log(JSON.stringify({ summary }));
}
console.log(JSON.stringify({ errors, url: page.url() }));
await browser.close();
