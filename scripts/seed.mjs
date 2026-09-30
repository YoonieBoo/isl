// Seeds demo data through the real app (spec §23: "Do not use hardcoded
// JSON as the final demo system of record") — signs up a real user, then
// drives the actual UI/server actions to create a learning environment,
// upload+validate a dataset, run SmartDiscovery (mock adapter, no API cost),
// review a spread of outcomes, approve insight, and add portfolio artifacts.
//
// Usage: make sure `npm run dev` is running (defaults to localhost:3000;
// override with BASE_URL=http://localhost:PORT), then:
//   npx playwright install chromium   # first time only
//   node scripts/seed.mjs

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CSV_PATH = path.join(__dirname, "seed-dataset.csv");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const email = `isl-seed-${Date.now()}@mailinator.com`;
  const password = "Sm0keTest!2026";

  console.log(`Seeding against ${BASE} as ${email}`);

  console.log("1) Sign up seed admin");
  await page.goto(`${BASE}/login`);
  await page.click("text=Sign up");
  await page.fill("#displayName", "Seed Admin");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign up")');
  await page.waitForSelector("text=Dashboard", { timeout: 15000 });

  console.log("2) Create learning environment");
  await page.goto(`${BASE}/learning-environments/new`);
  await page.fill("#name", `Foundations Cohort ${new Date().toISOString().slice(0, 10)}`);
  await page.fill("#organisationName", "Peanuts Academy");
  await page.fill("#environmentType", "professional upskilling program");
  await page.fill("#courseOrWorkshop", "Foundations — Week 1 Reflections");
  await page.fill("#description", "Seed data for MVP validation.");
  await page.fill("#learningObjectives", "Build baseline learner signal extraction from weekly reflections.");
  await page.click('button:has-text("Create environment")');
  await page.waitForSelector("h1", { timeout: 15000 });
  const environmentId = page.url().split("/").pop();
  console.log("   environmentId =", environmentId);

  console.log("3) Upload + validate dataset");
  await page.goto(`${BASE}/datasets/new?environment=${environmentId}`);
  await page.fill("#name", "Week 1 Reflections");
  await (await page.$('input[type="file"]')).setInputFiles(CSV_PATH);
  await page.click('button:has-text("Upload")');
  await page.waitForSelector("text=Map & validate", { timeout: 20000 });
  const datasetId = page.url().split("/").pop();
  await page.selectOption("#idColumn", "student_id");
  await page.selectOption("#nameColumn", "name");
  await page.click('button:has-text("Run validation")');
  await page.waitForSelector("text=Matched existing learners", { timeout: 20000 });
  console.log("   datasetId =", datasetId);

  console.log("4) Create, confirm, and execute processing run (mock adapter)");
  await page.goto(`${BASE}/processing-runs/new?environment=${environmentId}&dataset=${datasetId}`);
  await page.fill("#learningObjective", "Understand learner sentiment, strengths, and needs from week 1 reflections.");
  await page.fill("#activityContext", "Week 1 async reflection prompt.");
  await page.fill("#evidenceFields", "reflection");
  await page.selectOption("#aiSource", "mock");
  await page.click('button:has-text("Save as draft")');
  await page.waitForSelector("text=Processing context", { timeout: 15000 });
  await page.click('button:has-text("Confirm configuration")');
  await page.waitForSelector("text=Run SmartDiscovery processing", { timeout: 15000 });
  const runId = page.url().split("/").pop();
  await page.click('button:has-text("Run SmartDiscovery processing")');

  let completed = false;
  for (let i = 0; i < 30 && !completed; i++) {
    await page.reload();
    completed = /completed/i.test(await page.locator("body").innerText());
    if (!completed) await page.waitForTimeout(2000);
  }
  console.log("   runId =", runId, "| completed:", completed);

  console.log("5) Review a spread of outcomes (agree / revise / reject / unsure)");
  await page.goto(`${BASE}/reviews?run=${runId}`);
  await page.waitForSelector("table");
  const reviewCount = await page.locator('table a[href^="/reviews/"]').count();
  const decisions = ["agree", "agree", "agree", "revise", "reject", "agree", "unsure", "agree"];
  const agreedResultIds = [];
  for (let i = 0; i < Math.min(reviewCount, decisions.length); i++) {
    await page.goto(`${BASE}/reviews?run=${runId}`);
    await page.waitForSelector("table");
    const links = await page.locator('table a[href^="/reviews/"]').all();
    const href = await links[i].getAttribute("href");
    await page.goto(`${BASE}${href}`);
    await page.waitForSelector("#decision");
    await page.selectOption("#decision", decisions[i]);
    await page.fill("#reviewNotes", `Seed review — marked ${decisions[i]}.`);
    await page.click('button:has-text("Submit review")');
    await page.waitForSelector("table", { timeout: 15000 });
    if (decisions[i] === "agree") agreedResultIds.push(href.split("/").pop());
  }
  console.log(`   reviewed ${Math.min(reviewCount, decisions.length)} results`);

  console.log("6) Draft insights from agreed results, approve most (leave ≥1 not approved)");
  let approvedCount = 0;
  const draftCount = Math.min(agreedResultIds.length, 5);
  for (let i = 0; i < draftCount; i++) {
    await page.goto(`${BASE}/insights/new?resultId=${agreedResultIds[i]}`);
    if ((await page.locator("#title").count()) === 0) continue;
    await page.fill("#summary", "Auto-drafted from reviewed processing output during seeding.");
    await page.fill(
      "#interpretationBoundary",
      "Based on a single week of reflection evidence — treat as an emerging signal, not a fixed trait.",
    );
    await page.click('button:has-text("Save as candidate insight")');
    await page.waitForSelector("text=Summary", { timeout: 15000 });
    if (i < draftCount - 1) {
      await page.click('button:has-text("Approve")');
      await page.waitForTimeout(500);
      approvedCount += 1;
    }
  }
  console.log(`   drafted ${draftCount} insights, approved ${approvedCount}`);

  console.log("7) Add portfolio artifacts for 3 learners");
  await page.goto(`${BASE}/learners`);
  await page.waitForSelector("table");
  const learnerHrefs = await Promise.all(
    (await page.locator('table a[href^="/learners/"]').all())
      .slice(0, 3)
      .map((l) => l.getAttribute("href")),
  );
  const artifactTypes = ["reflection", "project", "achievement"];
  for (let i = 0; i < learnerHrefs.length; i++) {
    const learnerId = learnerHrefs[i].split("/").pop();
    await page.goto(`${BASE}/portfolios/new?learner=${learnerId}`);
    await page.selectOption("#artifactType", artifactTypes[i]);
    await page.fill("#title", `Week 1 ${artifactTypes[i]} artifact`);
    await page.fill("#description", "Seed portfolio artifact for MVP validation.");
    await page.fill("#evidenceNote", "Added by scripts/seed.mjs.");
    await page.selectOption("#visibility", "learner_visible");
    await page.click('button:has-text("Add artifact")');
    await page.waitForSelector("table", { timeout: 15000 });
  }
  console.log(`   added ${learnerHrefs.length} portfolio artifacts`);

  console.log("\nDone. Console errors during seeding:", consoleErrors.length ? consoleErrors : "(none)");
  await browser.close();
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
