// Live validation driver for the Q3/2026 SmartDiscovery + ISL activation
// direction (Dummy dataset -> DDI1311). Extends the scripts/seed.mjs
// Playwright pattern into a set of small, composable commands so that real
// judgment (which review decision, what an insight should say) happens
// between commands rather than being hardcoded like seed.mjs's demo array.
//
// Usage: node scripts/validate-run.mjs <command> [...args]
// Requires `npm run dev` running at BASE_URL (default http://localhost:3000).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

async function withContext(authFile, fn) {
  const browser = await chromium.launch();
  const contextOptions = {};
  if (authFile && fs.existsSync(authFile)) {
    contextOptions.storageState = authFile;
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  try {
    const result = await fn(page, context);
    if (consoleErrors.length) {
      console.error("console errors during run:", consoleErrors);
    }
    return result;
  } finally {
    if (authFile) await context.storageState({ path: authFile });
    await browser.close();
  }
}

async function cmdSignup(authFile, label) {
  await withContext(null, async (page, context) => {
    const email = `isl-validation-${label}-${Date.now()}@mailinator.com`;
    const password = "Sm0keTest!2026Validation";
    await page.goto(`${BASE}/login`);
    await page.click("text=Sign up");
    await page.fill("#displayName", `ISL Validation — ${label}`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button:has-text("Sign up")');
    await page.waitForSelector("text=Dashboard", { timeout: 15000 });
    await context.storageState({ path: authFile });
    console.log(JSON.stringify({ email, authFile }));
  });
}

async function cmdCreateEnv(authFile, configPath) {
  const cfg = readJson(configPath);
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/learning-environments/new`);
    await page.fill("#name", cfg.name);
    await page.fill("#organisationName", cfg.organisationName);
    await page.fill("#environmentType", cfg.environmentType);
    await page.fill("#courseOrWorkshop", cfg.courseOrWorkshop);
    if (cfg.description) await page.fill("#description", cfg.description);
    if (cfg.learningObjectives) await page.fill("#learningObjectives", cfg.learningObjectives);
    await page.click('button:has-text("Create environment")');
    // The /new form page already renders an <h1>, so waiting for "h1" would
    // resolve immediately without waiting for the post-submit redirect —
    // wait for the URL to actually move off /new instead.
    await page.waitForURL((url) => /\/learning-environments\/(?!new$)[^/]+$/.test(url.pathname), {
      timeout: 15000,
    });
    const environmentId = page.url().split("/").pop();
    console.log(JSON.stringify({ environmentId }));
  });
}

async function cmdUpload(authFile, environmentId, datasetName, csvPath) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/datasets/new?environment=${environmentId}`);
    await page.fill("#name", datasetName);
    await (await page.$('input[type="file"]')).setInputFiles(csvPath);
    await page.click('button:has-text("Upload")');
    await page.waitForSelector("text=Map & validate", { timeout: 30000 });
    const datasetId = page.url().split("/").pop();
    console.log(JSON.stringify({ datasetId }));
  });
}

async function cmdValidate(authFile, datasetId, idColumn, nameColumn) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/datasets/${datasetId}`);
    await page.selectOption("#idColumn", idColumn);
    if (nameColumn) await page.selectOption("#nameColumn", nameColumn);
    await page.click('button:has-text("Run validation")');
    await page.waitForSelector("text=Matched existing learners", { timeout: 60000 });
    const summaryText = await page.locator("main").innerText();
    console.log(JSON.stringify({ summaryText }));
  });
}

async function cmdCreateRun(authFile, environmentId, datasetId, contextPath) {
  const ctx = readJson(contextPath);
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/processing-runs/new?environment=${environmentId}&dataset=${datasetId}`);
    await page.fill("#learningObjective", ctx.learningObjective);
    if (ctx.activityContext) await page.fill("#activityContext", ctx.activityContext);
    if (ctx.learnerPopulation) await page.fill("#learnerPopulation", ctx.learnerPopulation);
    if (ctx.activityType) await page.fill("#activityType", ctx.activityType);
    if (ctx.interpretationFocus) await page.fill("#interpretationFocus", ctx.interpretationFocus);
    if (ctx.signalCategories) await page.fill("#signalCategories", ctx.signalCategories);
    if (ctx.taxonomyGuidance) await page.fill("#taxonomyGuidance", ctx.taxonomyGuidance);
    if (ctx.processingNotes) await page.fill("#processingNotes", ctx.processingNotes);
    await page.fill("#evidenceFields", ctx.evidenceFields);
    await page.selectOption("#aiSource", ctx.aiSource ?? "mock");
    await page.click('button:has-text("Save as draft")');
    // The setup form itself already has a "Processing context" heading, so
    // (as with environment creation) wait for the URL to move off /new.
    await page.waitForURL((url) => /\/processing-runs\/(?!new$)[^/]+$/.test(url.pathname), {
      timeout: 15000,
    });
    const runId = page.url().split("/").pop();

    await page.click('button:has-text("Confirm configuration")');
    await page.waitForSelector("text=Run SmartDiscovery processing", { timeout: 15000 });
    await page.click('button:has-text("Run SmartDiscovery processing")');

    const maxPolls = ctx.maxPolls ?? 120;
    const pollMs = ctx.pollMs ?? 3000;
    let status = "";
    for (let i = 0; i < maxPolls; i++) {
      await page.waitForTimeout(pollMs);
      await page.reload();
      const body = await page.locator("body").innerText();
      const m = body.match(/(draft|queued|running|completed with warning|completed|failed|cancelled)/i);
      status = m ? m[0] : "";
      if (/completed|failed|cancelled/i.test(status)) break;
      if (i % 5 === 0) console.error(`  polling... (${i * pollMs}ms) status~="${status}"`);
    }
    console.log(JSON.stringify({ runId, status }));
  });
}

async function cmdDumpResults(authFile, runId, outFile) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/processing-runs/${runId}/results`, { timeout: 60000 });
    await page.waitForSelector("text=Learner Output", { timeout: 30000 });
    const items = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href^="/reviews/"]')];
      return links.map((a) => {
        const card = a.closest("div.rounded-xl");
        const resultId = a.getAttribute("href").split("/").pop();
        return { resultId, text: card ? card.innerText : "" };
      });
    });
    writeJson(outFile, items);
    console.log(JSON.stringify({ count: items.length, outFile }));
  });
}

async function cmdSubmitReviews(authFile, decisionsPath) {
  const decisions = readJson(decisionsPath); // [{resultId, decision, reviewNotes}]
  await withContext(authFile, async (page) => {
    const submitted = [];
    for (const d of decisions) {
      await page.goto(`${BASE}/reviews/${d.resultId}`, { timeout: 30000 });
      await page.waitForSelector("#decision", { timeout: 15000 });
      await page.selectOption("#decision", d.decision);
      if (d.correctedOutput && d.decision === "revise") {
        await page.fill("#correctedOutput", JSON.stringify(d.correctedOutput, null, 2));
      }
      for (const cat of d.errorCategories ?? []) {
        await page.check(`input[name="errorCategories"][value="${cat}"]`);
      }
      if (d.reviewNotes) await page.fill("#reviewNotes", d.reviewNotes);
      await page.click('button:has-text("Submit review")');
      await page.waitForSelector("text=Review history", { timeout: 15000 }).catch(() => {});
      submitted.push(d.resultId);
    }
    console.log(JSON.stringify({ submitted }));
  });
}

async function cmdDraftInsight(authFile, resultId, insightPath) {
  const insight = readJson(insightPath);
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/insights/new?resultId=${resultId}`, { timeout: 30000 });
    if ((await page.locator("#title").count()) === 0) {
      console.log(JSON.stringify({ error: "form-not-found (result may not have an agree/revise review yet)" }));
      return;
    }
    await page.fill("#title", insight.title);
    await page.fill("#summary", insight.summary);
    if (insight.observedStrengths) await page.fill("#observedStrengths", insight.observedStrengths);
    if (insight.developmentNeeds) await page.fill("#developmentNeeds", insight.developmentNeeds);
    if (insight.learningPreferences) await page.fill("#learningPreferences", insight.learningPreferences);
    if (insight.concerns) await page.fill("#concerns", insight.concerns);
    if (insight.interpretationBoundary) await page.fill("#interpretationBoundary", insight.interpretationBoundary);
    await page.click('button:has-text("Save as candidate insight")');
    // The /insights/new form itself already has a "Summary" field label, so
    // (as with environment/run creation) wait for the URL to move off /new.
    await page.waitForURL((url) => /\/insights\/(?!new$)[^/?]+$/.test(url.pathname), {
      timeout: 15000,
    });
    const insightId = page.url().split("/").pop();
    console.log(JSON.stringify({ insightId }));
  });
}

async function cmdApproveInsight(authFile, insightId) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/insights/${insightId}`, { timeout: 30000 });
    await page.click('button:has-text("Approve")');
    await page.waitForSelector("text=approved", { timeout: 15000 });
    console.log(JSON.stringify({ approved: insightId }));
  });
}

async function cmdGetText(authFile, urlPath, outFile) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}${urlPath}`, { timeout: 60000 });
    const text = await page.locator("main").innerText();
    if (outFile) writeJson(outFile, { urlPath, text });
    console.log(text);
  });
}

async function cmdListLinks(authFile, urlPath, hrefPrefix, outFile) {
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}${urlPath}`, { timeout: 30000 });
    await page.waitForSelector("table, main", { timeout: 15000 });
    const items = await page.evaluate((prefix) => {
      const links = [...document.querySelectorAll(`a[href^="${prefix}"]`)];
      return links.map((a) => ({ href: a.getAttribute("href"), text: a.textContent.trim() }));
    }, hrefPrefix);
    if (outFile) writeJson(outFile, items);
    console.log(JSON.stringify(items));
  });
}

async function cmdCheckPages(authFile, pathsCsv) {
  const paths = pathsCsv.split(",");
  await withContext(authFile, async (page) => {
    const results = [];
    for (const p of paths) {
      try {
        await page.goto(`${BASE}${p}`, { timeout: 20000 });
        const bodyText = await page.locator("body").innerText();
        const hasError = /Application error|Unhandled Runtime Error|500|This page could not be found/i.test(bodyText);
        const firstLine = bodyText.split("\n").find((l) => l.trim()) ?? "";
        results.push({ path: p, ok: !hasError, firstLine: firstLine.slice(0, 80) });
      } catch (e) {
        results.push({ path: p, ok: false, firstLine: String(e).slice(0, 120) });
      }
    }
    console.log(JSON.stringify(results, null, 2));
  });
}

async function cmdAddPortfolio(authFile, learnerId, configPath) {
  const cfg = readJson(configPath);
  await withContext(authFile, async (page) => {
    await page.goto(`${BASE}/portfolios/new?learner=${learnerId}`, { timeout: 30000 });
    await page.selectOption("#artifactType", cfg.artifactType);
    await page.fill("#title", cfg.title);
    if (cfg.description) await page.fill("#description", cfg.description);
    if (cfg.externalUrl) await page.fill("#externalUrl", cfg.externalUrl);
    if (cfg.evidenceNote) await page.fill("#evidenceNote", cfg.evidenceNote);
    if (cfg.visibility) await page.selectOption("#visibility", cfg.visibility);
    await page.click('button:has-text("Add artifact")');
    await page.waitForURL((url) => url.pathname === "/portfolios", { timeout: 15000 });
    console.log(JSON.stringify({ added: true }));
  });
}

async function cmdExport(authFile, environmentId, outFile) {
  await withContext(authFile, async (page, context) => {
    const resp = await context.request.get(`${BASE}/api/export/insights?environment=${environmentId}`);
    const body = await resp.json();
    writeJson(outFile, body);
    console.log(JSON.stringify({ status: resp.status(), count: body.count, outFile }));
  });
}

const [, , command, ...args] = process.argv;

const commands = {
  signup: cmdSignup,
  "create-env": cmdCreateEnv,
  upload: cmdUpload,
  validate: cmdValidate,
  "create-run": cmdCreateRun,
  "dump-results": cmdDumpResults,
  "submit-reviews": cmdSubmitReviews,
  "draft-insight": cmdDraftInsight,
  "approve-insight": cmdApproveInsight,
  "get-text": cmdGetText,
  "list-links": cmdListLinks,
  "check-pages": cmdCheckPages,
  "add-portfolio": cmdAddPortfolio,
  export: cmdExport,
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}\nAvailable: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

commands[command](...args).catch((err) => {
  console.error(err);
  process.exit(1);
});
