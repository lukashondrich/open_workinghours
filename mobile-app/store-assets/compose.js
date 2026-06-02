#!/usr/bin/env node
/**
 * Composition step: turn raw screenshots into marketing PNGs.
 *
 * For each raw/{locale}/{NN-name}.png:
 *   - Read the matching headline from copy/{locale}.json
 *   - Render an SVG headline overlay
 *   - Place the screenshot below the headline on a tinted background
 *   - Write composed/{locale}/{NN-name}.png at 1320x2868 (App Store size)
 *
 * Run:
 *   node compose.js              # all locales
 *   LOCALES=en node compose.js   # one locale
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ── Design constants ────────────────────────────────────────────────────────
const CANVAS_WIDTH = 1320;
const CANVAS_HEIGHT = 2868;
const BG_COLOR = '#f0fdfa';            // brand teal at very low opacity over white
const HEADLINE_COLOR = '#0f766e';      // brand teal (darker)
const HEADLINE_TOP = 180;
const HEADLINE_BLOCK_HEIGHT = 480;
const HEADLINE_FONT_SIZE = 96;
const HEADLINE_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const SCREENSHOT_TOP = 720;
const SCREENSHOT_WIDTH = 1100;          // scaled down from 1320; horizontal padding (1320-1100)/2 = 110
const SCREENSHOT_BORDER_RADIUS = 56;
const SHADOW_BLUR = 40;

const COPY_DIR = path.join(__dirname, 'copy');
const RAW_DIR = path.join(__dirname, 'raw');
const COMPOSED_DIR = path.join(__dirname, 'composed');

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Word-wrap a string into lines that fit within `maxCharsPerLine` (approximate).
 * Headlines are short, so this naive splitter is fine.
 */
function wrapHeadline(text, maxCharsPerLine = 22) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build an SVG containing the headline text, sized to the headline block.
 * Multi-line headlines stack with line-height = 1.15.
 */
function makeHeadlineSvg(text) {
  const lines = wrapHeadline(text);
  const lineHeight = HEADLINE_FONT_SIZE * 1.15;
  const totalHeight = lines.length * lineHeight;
  const startY = (HEADLINE_BLOCK_HEIGHT - totalHeight) / 2 + HEADLINE_FONT_SIZE * 0.85;

  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${CANVAS_WIDTH / 2}" y="${y}" text-anchor="middle">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return `<svg width="${CANVAS_WIDTH}" height="${HEADLINE_BLOCK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text font-family='${HEADLINE_FONT_FAMILY}'
          font-size="${HEADLINE_FONT_SIZE}"
          font-weight="700"
          fill="${HEADLINE_COLOR}"
          letter-spacing="-1.5">${tspans}</text>
  </svg>`;
}

/**
 * Build an SVG drop-shadow that sits under the screenshot.
 */
function makeShadowSvg(width, height) {
  return `<svg width="${width + SHADOW_BLUR * 2}" height="${height + SHADOW_BLUR * 2}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${SHADOW_BLUR / 2}" />
      </filter>
    </defs>
    <rect x="${SHADOW_BLUR}" y="${SHADOW_BLUR + 8}"
          width="${width}" height="${height}"
          rx="${SCREENSHOT_BORDER_RADIUS}" ry="${SCREENSHOT_BORDER_RADIUS}"
          fill="black" opacity="0.18"
          filter="url(#blur)" />
  </svg>`;
}

/**
 * Build an SVG mask for rounded corners (white = visible, black = transparent).
 */
function makeRoundedMaskSvg(width, height) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}"
          rx="${SCREENSHOT_BORDER_RADIUS}" ry="${SCREENSHOT_BORDER_RADIUS}"
          fill="white" />
  </svg>`;
}

/**
 * Compose one screenshot.
 */
async function composeOne(rawPath, headline, outPath) {
  // 1. Prepare the screenshot: resize + apply rounded corners.
  const raw = sharp(rawPath);
  const meta = await raw.metadata();
  const targetWidth = SCREENSHOT_WIDTH;
  const targetHeight = Math.round((meta.height / meta.width) * targetWidth);

  const resized = await sharp(rawPath)
    .resize({ width: targetWidth })
    .composite([
      {
        input: Buffer.from(makeRoundedMaskSvg(targetWidth, targetHeight)),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  // 2. Build the canvas: tinted background.
  const left = Math.round((CANVAS_WIDTH - targetWidth) / 2);

  const composed = await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      // Shadow under the screenshot.
      {
        input: Buffer.from(makeShadowSvg(targetWidth, targetHeight)),
        top: SCREENSHOT_TOP - SHADOW_BLUR,
        left: left - SHADOW_BLUR,
      },
      // Screenshot.
      {
        input: resized,
        top: SCREENSHOT_TOP,
        left,
      },
      // Headline at top.
      {
        input: Buffer.from(makeHeadlineSvg(headline)),
        top: HEADLINE_TOP,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(outPath, composed);
}

async function composeLocale(locale) {
  const copyPath = path.join(COPY_DIR, `${locale}.json`);
  if (!fs.existsSync(copyPath)) {
    console.warn(`  ⚠ skipping ${locale}: no copy/${locale}.json`);
    return;
  }
  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));

  const rawLocaleDir = path.join(RAW_DIR, locale);
  if (!fs.existsSync(rawLocaleDir)) {
    console.warn(`  ⚠ skipping ${locale}: no raw/${locale}/ directory (run capture first)`);
    return;
  }

  const outDir = path.join(COMPOSED_DIR, locale);
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(rawLocaleDir).filter((f) => f.endsWith('.png')).sort();
  for (const file of files) {
    const name = file.replace(/\.png$/, '');
    const entry = copy[name];
    if (!entry || !entry.headline) {
      console.warn(`  ⚠ no headline for "${name}" in copy/${locale}.json — skipping`);
      continue;
    }
    const rawPath = path.join(rawLocaleDir, file);
    const outPath = path.join(outDir, file);
    await composeOne(rawPath, entry.headline, outPath);
    console.log(`  ✓ composed ${locale}/${file}`);
  }
}

async function main() {
  const locales = (process.env.LOCALES || 'en,de').split(',').map((s) => s.trim()).filter(Boolean);
  for (const locale of locales) {
    console.log(`\nComposing ${locale}...`);
    await composeLocale(locale);
  }
  console.log(`\n✓ Done. Output: composed/`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('✗ compose failed:', err);
    process.exit(1);
  });
}

module.exports = { composeOne, composeLocale };
