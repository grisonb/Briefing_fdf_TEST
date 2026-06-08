import express from 'express';
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STORAGE_STATE = process.env.NATS_STORAGE_STATE || path.join(DATA_DIR, 'nats-storage-state.json');
const DOWNLOAD_DIR = process.env.NATS_DOWNLOAD_DIR || path.join(DATA_DIR, 'downloads');
const NATS_BRIEFING_URL = process.env.NATS_BRIEFING_URL || 'https://nats-uk.ead-it.com/fwf-nats/restricted/user/ino/brief_aerodrome.faces?menuId=C920E9BB76441A9AE05341741DC25BDD';
const NATS_LOGIN_URL = process.env.NATS_LOGIN_URL || NATS_BRIEFING_URL;
const NATS_FAVORITE_NAME = process.env.NATS_FAVORITE_NAME || 'PELICANDROMES';
const REQUEST_TIMEOUT_MS = Number(process.env.NATS_TIMEOUT_MS || 120000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.NATS_DOWNLOAD_TIMEOUT_MS || 120000);
const HEADLESS = String(process.env.NATS_HEADLESS || 'true').toLowerCase() !== 'false';
const SLOW_MO = Number(process.env.NATS_SLOW_MO_MS || 0);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

let natsJob = Promise.resolve();

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'briefing-fdf-nats-server' });
});

app.post('/api/nats/notams', async (_req, res) => {
  try {
    const pdfBuffer = await enqueueNatsDownload();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="nats-notams.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[nats] download failed:', error);
    res.status(502).json({
      ok: false,
      message: error.message || 'Echec du téléchargement NATS.',
    });
  }
});

function enqueueNatsDownload() {
  const run = natsJob.then(() => downloadNatsPdf());
  natsJob = run.catch(() => {});
  return run;
}

async function downloadNatsPdf() {
  validateRequiredEnv();
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(DOWNLOAD_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: await fileExists(STORAGE_STATE) ? STORAGE_STATE : undefined,
  });
  context.setDefaultTimeout(REQUEST_TIMEOUT_MS);
  const page = await context.newPage();

  try {
    await page.goto(NATS_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await page.goto(NATS_BRIEFING_URL, { waitUntil: 'domcontentloaded' });
    await openAerodromePibIfNeeded(page);
    await selectFavoriteBriefing(page);
    await generateBriefing(page);
    const pdfBuffer = await printPdf(page);
    await context.storageState({ path: STORAGE_STATE });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function validateRequiredEnv() {
  const missing = ['NATS_USERNAME', 'NATS_PASSWORD'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
  }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loginIfNeeded(page) {
  const userSelector = process.env.NATS_USERNAME_SELECTOR;
  const passwordSelector = process.env.NATS_PASSWORD_SELECTOR;
  const loginSelector = process.env.NATS_LOGIN_BUTTON_SELECTOR;

  const usernameField = userSelector
    ? page.locator(userSelector).first()
    : firstExisting(page, [
        'input[name="j_username"]',
        'input[name="username"]',
        'input[name="user"]',
        'input[id*="user" i]',
        'input[id*="login" i]',
        'input[type="text"]',
      ]);

  if (!(await isUsable(usernameField))) return;

  await usernameField.fill(process.env.NATS_USERNAME);

  const passwordField = passwordSelector
    ? page.locator(passwordSelector).first()
    : firstExisting(page, [
        'input[name="j_password"]',
        'input[name="password"]',
        'input[id*="password" i]',
        'input[type="password"]',
      ]);

  if (!(await isUsable(passwordField))) {
    throw new Error('Champ mot de passe NATS introuvable. Renseigner NATS_PASSWORD_SELECTOR.');
  }

  await passwordField.fill(process.env.NATS_PASSWORD);

  const submit = loginSelector
    ? page.locator(loginSelector).first()
    : firstExisting(page, [
        'button[type="submit"]',
        'input[type="submit"]',
        'text=/^(Log in|Login|Connexion|Sign in)$/i',
        'button:has-text("Login")',
      ]);

  if (await isUsable(submit)) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      submit.click(),
    ]);
  } else {
    await passwordField.press('Enter');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }
}

async function openAerodromePibIfNeeded(page) {
  const selector = process.env.NATS_AERODROME_PIB_SELECTOR;
  const target = selector
    ? page.locator(selector).first()
    : firstExisting(page, [
        'text=/Aerodrome\s+PIB/i',
        'a:has-text("Aerodrome PIB")',
        'button:has-text("Aerodrome PIB")',
      ]);

  if (await isUsable(target)) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      target.click(),
    ]);
  }
}

async function selectFavoriteBriefing(page) {
  const favoriteSelector = process.env.NATS_FAVORITES_BUTTON_SELECTOR;
  const favoriteButton = favoriteSelector
    ? page.locator(favoriteSelector).first()
    : firstExisting(page, [
        '[title*="favour" i]',
        '[title*="favor" i]',
        '[aria-label*="favour" i]',
        '[aria-label*="favor" i]',
        'button:has-text("★")',
        'a:has-text("★")',
      ]);

  if (await isUsable(favoriteButton)) {
    await favoriteButton.click();
  }

  const favoriteNameSelector = process.env.NATS_FAVORITE_SELECTOR;
  const favoriteName = favoriteNameSelector
    ? page.locator(favoriteNameSelector).first()
    : page.getByText(NATS_FAVORITE_NAME, { exact: false }).first();

  if (!(await isUsable(favoriteName))) {
    throw new Error(`Favori NATS "${NATS_FAVORITE_NAME}" introuvable. Renseigner NATS_FAVORITE_SELECTOR.`);
  }

  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    favoriteName.click(),
  ]);
}

async function generateBriefing(page) {
  const selector = process.env.NATS_GENERATE_SELECTOR;
  const generateButton = selector
    ? page.locator(selector).first()
    : firstExisting(page, [
        'text=/^Generate$/i',
        'button:has-text("Generate")',
        'input[value="Generate"]',
      ]);

  if (!(await isUsable(generateButton))) {
    throw new Error('Bouton Generate NATS introuvable. Renseigner NATS_GENERATE_SELECTOR.');
  }

  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    generateButton.click(),
  ]);
}

async function printPdf(page) {
  const selector = process.env.NATS_PRINT_PDF_SELECTOR;
  const printButton = selector
    ? page.locator(selector).first()
    : firstExisting(page, [
        'text=/Print\\s+PDF/i',
        'button:has-text("Print PDF")',
        'input[value*="Print PDF"]',
        'a:has-text("Print PDF")',
      ]);

  if (!(await isUsable(printButton))) {
    throw new Error('Bouton Print PDF NATS introuvable. Renseigner NATS_PRINT_PDF_SELECTOR.');
  }

  const resultPromise = Promise.race([
    page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT_MS })
      .then((download) => ({ type: 'download', download })),
    page.waitForResponse(
      (response) => (response.headers()['content-type'] || '').toLowerCase().includes('application/pdf'),
      { timeout: DOWNLOAD_TIMEOUT_MS },
    ).then((response) => ({ type: 'response', response })),
    page.waitForEvent('popup', { timeout: DOWNLOAD_TIMEOUT_MS })
      .then((popup) => ({ type: 'popup', popup })),
  ]);

  await printButton.click();
  const result = await resultPromise.catch(() => null);

  if (result?.type === 'download') {
    const downloadPath = await result.download.path();
    if (!downloadPath) throw new Error('Téléchargement PDF NATS reçu sans fichier temporaire.');
    return readFile(downloadPath);
  }

  if (result?.type === 'response') return result.response.body();

  if (result?.type === 'popup') {
    const popup = result.popup;
    const initialResponse = await popup.waitForLoadState('domcontentloaded')
      .then(() => popup.locator('embed[type="application/pdf"], iframe').first().getAttribute('src'))
      .catch(() => null);
    if (initialResponse) {
      const response = await popup.context().request.get(new URL(initialResponse, popup.url()).href);
      if (response.ok()) return response.body();
    }
  }

  throw new Error('Aucun PDF NATS reçu après Print PDF.');
}

function firstExisting(page, selectors) {
  return {
    async count() {
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if ((await locator.count().catch(() => 0)) > 0) return 1;
      }
      return 0;
    },
    async isVisible() {
      return Boolean(await resolveLocator(page, selectors));
    },
    async fill(value) {
      const locator = await requireLocator(page, selectors);
      return locator.fill(value);
    },
    async click() {
      const locator = await requireLocator(page, selectors);
      return locator.click();
    },
    async press(key) {
      const locator = await requireLocator(page, selectors);
      return locator.press(key);
    },
  };
}

async function resolveLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) continue;
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function requireLocator(page, selectors) {
  const locator = await resolveLocator(page, selectors);
  if (!locator) throw new Error(`Element introuvable parmi: ${selectors.join(', ')}`);
  return locator;
}

async function isUsable(locator) {
  return (await locator.count().catch(() => 0)) > 0 && (await locator.isVisible().catch(() => false));
}

app.listen(PORT, () => {
  console.log(`[nats] server listening on port ${PORT}`);
});
