// HTML -> PNG renderer for Instagram post images.
// Plain ESM, Node 20+. Uses the 'playwright' package hoisted in the repo root node_modules.

import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--no-sandbox', '--font-render-hinting=none'];
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium';

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Replace {{{key}}} tokens with raw values, then {{key}} tokens with
 * HTML-escaped values. Missing keys become empty strings.
 */
export function fillTemplate(templateHtml, data = {}) {
  const raw = (key) =>
    Object.prototype.hasOwnProperty.call(data, key) && data[key] != null
      ? String(data[key])
      : '';
  return templateHtml
    .replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_, key) => raw(key))
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => escapeHtml(raw(key)));
}

/**
 * Inline local stylesheet <link>s (same-directory .css hrefs) as <style>
 * blocks, since page.setContent() breaks relative paths.
 */
async function inlineLocalCss(html, templateDir) {
  const linkRe = /<link\b[^>]*href=["']([^"':/\\]+\.css)["'][^>]*\/?>/gi;
  const matches = [...html.matchAll(linkRe)];
  for (const match of matches) {
    const cssPath = path.join(templateDir, match[1]);
    if (!existsSync(cssPath)) continue;
    const css = await readFile(cssPath, 'utf8');
    html = html.replace(match[0], `<style>\n${css}\n</style>`);
  }
  return html;
}

async function launchBrowser() {
  const envPath = process.env.PLAYWRIGHT_CHROME_PATH || process.env.CHROMIUM_PATH;
  if (envPath) {
    return chromium.launch({ executablePath: envPath, args: LAUNCH_ARGS });
  }
  try {
    return await chromium.launch({ args: LAUNCH_ARGS });
  } catch (err) {
    if (existsSync(FALLBACK_CHROMIUM)) {
      return chromium.launch({ executablePath: FALLBACK_CHROMIUM, args: LAUNCH_ARGS });
    }
    throw err;
  }
}

async function renderPageToPng(browser, html, outPath, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  try {
    try {
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      // Network idle may never settle (e.g. blocked font CDNs). Fall back to
      // 'load' plus a short grace period for rendering. If the 'load' fallback
      // ALSO fails, the page never rendered — propagate rather than screenshot
      // a broken frame (the caller then skips the day).
      try {
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      } catch (loadErr) {
        throw new Error(`render: page failed to load — ${loadErr?.message || loadErr}`);
      }
      await page.waitForTimeout(500);
    }
    // Let webfonts settle before the screenshot. A fallback font family is an
    // acceptable outcome, so this has its own short timeout and never fails the
    // render on its own (fonts.ready may reject or hang on some pages).
    await Promise.race([
      page.evaluate(() => document.fonts.ready.then(() => true)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).catch(() => {});
    await mkdir(path.dirname(outPath), { recursive: true });
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width, height },
    });
  } finally {
    await page.close();
  }
  return outPath;
}

/**
 * Render a single template to a PNG of exactly width x height.
 * Returns outPath.
 */
export async function renderTemplate({ templatePath, data, outPath, width = 1080, height = 1350 }) {
  const templateHtml = await readFile(templatePath, 'utf8');
  let html = fillTemplate(templateHtml, data);
  html = await inlineLocalCss(html, path.dirname(templatePath));

  const browser = await launchBrowser();
  try {
    return await renderPageToPng(browser, html, outPath, width, height);
  } finally {
    await browser.close();
  }
}

/**
 * Render multiple slides (array of data objects) with one shared browser.
 * Outputs outDir/baseName-01.png, -02.png, ... Returns the list of paths.
 */
export async function renderSlides({ templatePath, slides, outDir, baseName = 'slide', width = 1080, height = 1350 }) {
  const templateHtml = await readFile(templatePath, 'utf8');
  const templateDir = path.dirname(templatePath);
  const outPaths = [];

  const browser = await launchBrowser();
  try {
    for (let i = 0; i < slides.length; i++) {
      let html = fillTemplate(templateHtml, slides[i]);
      html = await inlineLocalCss(html, templateDir);
      const num = String(i + 1).padStart(2, '0');
      const outPath = path.join(outDir, `${baseName}-${num}.png`);
      await renderPageToPng(browser, html, outPath, width, height);
      outPaths.push(outPath);
    }
  } finally {
    await browser.close();
  }
  return outPaths;
}
