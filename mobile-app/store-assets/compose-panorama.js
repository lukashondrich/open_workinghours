#!/usr/bin/env node
/**
 * Panorama composition: turn raw screenshots into the 5-slot panoramic
 * App Store set (2 two-panel panoramas + 1 single card).
 *
 * Geometry: a panorama canvas is 2 panels + 1 gutter band wide
 * (2*1320 + 60 = 2700 x 2868). Panel 1 is sliced from columns 0-1320,
 * panel 2 from 1380-2700; the 60px band falls into the App Store's
 * gallery gutter, so contours (tilted phones, the zoomed stat card)
 * stay aligned across the physical gap on the product page.
 *
 * GUTTER verified 2026-08-12 against a live panoramic set (Calm, DE store):
 * solving the seam-contour continuity of their tilted phone across slots 1-2
 * gives a designed gutter of ~62px at 1320-scale (4.7% of a slot; second
 * contour: 68px with a noisier slope). 60 is within measurement error — keep.
 *
 * Layout percentages mirror the approved sketch (see the "Panorama-Galerie"
 * design artifact / project chat 2026-08-12). Headlines never enter the
 * gutter band; phones and the zoom card are the only seam-crossing elements.
 *
 * Run:
 *   node compose-panorama.js              # all locales -> composed/{locale}/
 *   LOCALES=en node compose-panorama.js
 *
 * The classic one-card-per-screen pipeline remains in compose.js.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ── Geometry ────────────────────────────────────────────────────────────────
const PANEL_W = 1320;
const PANEL_H = 2868;
const GUTTER = 60;                       // store gallery gap at export scale (estimate — tune)
const PANO_W = PANEL_W * 2 + GUTTER;     // 2700
const MARGIN = 400;                      // working margin so rotated/bleeding phones can overflow

// ── Phone treatment ─────────────────────────────────────────────────────────
const PHONE_RADIUS = Math.round(0.036 * PANO_W);   // ~97px device corner
const BEZEL_INNER = 11;                            // dark bezel ring
const BEZEL_OUTER = 5;                             // lighter outer edge
const BEZEL_INNER_COLOR = '#16211f';
const BEZEL_OUTER_COLOR = '#2c3a37';
const SHADOW_OFFSET_X = Math.round(0.011 * PANO_W);
const SHADOW_OFFSET_Y = Math.round(0.022 * PANO_W);
const SHADOW_BLUR = Math.round(0.017 * PANO_W);
const SHADOW_OPACITY = 0.30;

// ── Type ────────────────────────────────────────────────────────────────────
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const HL_PRIMARY_SIZE = Math.round(0.038 * PANO_W);   // ~103px
const HL_SUB_SIZE = Math.round(0.0295 * PANO_W);      // ~80px
const HL_SINGLE_SIZE = Math.round(0.069 * PANEL_W);   // ~91px
const HL_LIGHT_COLOR = '#0f5c55';
const HL_DARK_COLOR = '#d7f5ec';

// ── Layout definitions (fractions of the panorama canvas / single panel) ────
const PANORAMAS = [
  {
    name: 'tracking',
    outNames: ['01-pano-tracking-left.png', '02-pano-tracking-right.png'],
    background: `
      <linearGradient id="lg" x1="0%" y1="20%" x2="100%" y2="80%">
        <stop offset="0%" stop-color="#eafaf4"/>
        <stop offset="46%" stop-color="#d8f2e9"/>
        <stop offset="100%" stop-color="#f0fdfa"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="58%" r="38%">
        <stop offset="0%" stop-color="rgba(15,118,110,0.16)"/>
        <stop offset="100%" stop-color="rgba(15,118,110,0)"/>
      </radialGradient>`,
    headlineColor: HL_LIGHT_COLOR,
    headlines: [
      { copyKey: 'pano-tracking-1', left: 0.045, top: 0.045, width: 0.40, size: HL_PRIMARY_SIZE },
      { copyKey: 'pano-tracking-2', left: 0.56, top: 0.052, width: 0.38, size: HL_SUB_SIZE, opacity: 0.88 },
    ],
    phones: [
      // left offset keeps the "+Xh" overtime stat fully inside panel 1
      // while the phone body still crosses the gutter band
      { raw: '03-status-dashboard', width: 0.45, left: 0.06, top: 0.19, rotate: -7 },
      { raw: '01-geofence', width: 0.36, left: 0.555, top: 0.36, rotate: 5 },
    ],
    zoom: null,
  },
  {
    name: 'privacy',
    outNames: ['04-pano-privacy-left.png', '05-pano-privacy-right.png'],
    background: `
      <linearGradient id="lg" x1="0%" y1="20%" x2="100%" y2="80%">
        <stop offset="0%" stop-color="#0e3f39"/>
        <stop offset="52%" stop-color="#11574e"/>
        <stop offset="100%" stop-color="#0b332d"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="55%" r="40%">
        <stop offset="0%" stop-color="rgba(94,234,212,0.20)"/>
        <stop offset="100%" stop-color="rgba(94,234,212,0)"/>
      </radialGradient>`,
    headlineColor: HL_DARK_COLOR,
    headlines: [
      { copyKey: 'pano-privacy-1', left: 0.045, top: 0.045, width: 0.41, size: HL_PRIMARY_SIZE },
      { copyKey: 'pano-privacy-2', left: 0.565, top: 0.052, width: 0.38, size: HL_SUB_SIZE, opacity: 0.88 },
    ],
    phones: [
      { raw: '06-collective-insights', width: 0.42, left: 0.065, top: 0.20, rotate: -5 },
      { raw: '05-privacy', width: 0.35, left: 0.595, top: 0.34, rotate: 4 },
    ],
    // Enlarged "Du vs. Gruppe" card, floating across the gutter band.
    // Crop fractions are relative to the raw 06 screenshot.
    zoom: {
      raw: '06-collective-insights',
      crop: { left: 0.043, top: 0.1415, width: 0.912, height: 0.25 },
      width: 0.34, left: 0.36, top: 0.58, rotate: 2,
    },
  },
];

const SINGLE = {
  raw: '02-calendar-week-template',
  outName: '03-calendar-single.png',
  copyKey: 'single-calendar',
  background: `
    <linearGradient id="lg" x1="0%" y1="0%" x2="8%" y2="100%">
      <stop offset="0%" stop-color="#eafaf4"/>
      <stop offset="100%" stop-color="#f0fdfa"/>
    </linearGradient>`,
  headlineColor: HL_LIGHT_COLOR,
  phone: { width: 0.70, left: 0.15, top: 0.175 },
};

const COPY_DIR = path.join(__dirname, 'copy');
const RAW_DIR = path.join(__dirname, 'raw');
const COMPOSED_DIR = path.join(__dirname, 'composed');

// ── Helpers ─────────────────────────────────────────────────────────────────
function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapHeadline(text, maxCharsPerLine) {
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
 * SVG text block at (leftPx, topPx), wrapped to fit widthPx.
 * centered=true anchors on the block's horizontal center (single card).
 */
function headlineSvg(canvasW, text, { leftPx, topPx, widthPx, size, color, opacity = 1, centered = false }) {
  const maxChars = Math.max(10, Math.floor(widthPx / (size * 0.52)));
  const lines = wrapHeadline(text, maxChars);
  const lineHeight = size * 1.13;
  const anchorX = centered ? leftPx + widthPx / 2 : leftPx;
  const anchor = centered ? 'middle' : 'start';
  const tspans = lines
    .map((line, i) => {
      const y = topPx + size * 0.9 + i * lineHeight;
      return `<tspan x="${anchorX}" y="${y}" text-anchor="${anchor}">${escapeXml(line)}</tspan>`;
    })
    .join('');
  return `<text font-family='${FONT_FAMILY}' font-size="${size}" font-weight="800"
      fill="${color}" fill-opacity="${opacity}" letter-spacing="-1.5">${tspans}</text>`;
}

/** Rounded-corner mask for a screenshot. */
function roundedMaskSvg(w, h, r) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/></svg>`);
}

/**
 * Build a framed phone: screenshot with rounded corners inside a two-ring
 * dark bezel. Returns { buffer, width, height } (unrotated).
 */
async function buildPhone(rawPath, targetWidth) {
  const meta = await sharp(rawPath).metadata();
  const imgW = targetWidth;
  const imgH = Math.round((meta.height / meta.width) * imgW);
  const screenshot = await sharp(rawPath)
    .resize({ width: imgW })
    .composite([{ input: roundedMaskSvg(imgW, imgH, PHONE_RADIUS), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const b = BEZEL_INNER + BEZEL_OUTER;
  const w = imgW + 2 * b;
  const h = imgH + 2 * b;
  const bezel = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${PHONE_RADIUS + b}" ry="${PHONE_RADIUS + b}" fill="${BEZEL_OUTER_COLOR}"/>
    <rect x="${BEZEL_OUTER}" y="${BEZEL_OUTER}" width="${w - 2 * BEZEL_OUTER}" height="${h - 2 * BEZEL_OUTER}"
          rx="${PHONE_RADIUS + BEZEL_INNER}" ry="${PHONE_RADIUS + BEZEL_INNER}" fill="${BEZEL_INNER_COLOR}"/>
  </svg>`);

  const buffer = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bezel, top: 0, left: 0 },
      { input: screenshot, top: b, left: b },
    ])
    .png()
    .toBuffer();
  return { buffer, width: w, height: h };
}

/**
 * Soft drop shadow for a (possibly rotated) rounded rect, drawn on a
 * full working-canvas SVG so rotation needs no extra bookkeeping.
 * cx/cy = center of the element in working-canvas coordinates.
 */
function shadowSvg(canvasW, canvasH, { cx, cy, w, h, r, rotate }) {
  return Buffer.from(`<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="b" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${SHADOW_BLUR / 2}"/></filter></defs>
    <g transform="rotate(${rotate} ${cx} ${cy})">
      <rect x="${cx - w / 2 + SHADOW_OFFSET_X}" y="${cy - h / 2 + SHADOW_OFFSET_Y}"
            width="${w}" height="${h}" rx="${r}" ry="${r}"
            fill="black" opacity="${SHADOW_OPACITY}" filter="url(#b)"/>
    </g></svg>`);
}

/** Rotate a buffer around its center; returns placement for a fixed center point. */
async function rotateForCenter(buffer, rotate, cx, cy) {
  const rotated = await sharp(buffer)
    .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(rotated).metadata();
  return { input: rotated, left: Math.round(cx - meta.width / 2), top: Math.round(cy - meta.height / 2) };
}

/**
 * Composite one panorama onto its working canvas and slice it into two panels.
 */
async function composePanorama(pano, copy, rawLocaleDir, outDir) {
  const workW = PANO_W + 2 * MARGIN;
  const workH = PANEL_H + 2 * MARGIN;
  const layers = [];

  // Background (drawn only over the final visible region).
  layers.push({
    input: Buffer.from(`<svg width="${PANO_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>${pano.background}</defs>
      <rect width="${PANO_W}" height="${PANEL_H}" fill="url(#lg)"/>
      <rect width="${PANO_W}" height="${PANEL_H}" fill="url(#glow)"/>
    </svg>`),
    left: MARGIN,
    top: MARGIN,
  });

  // Phones: shadow first (all), then bodies, so overlaps stay clean.
  const built = [];
  for (const spec of pano.phones) {
    const rawPath = path.join(rawLocaleDir, `${spec.raw}.png`);
    const phone = await buildPhone(rawPath, Math.round(spec.width * PANO_W));
    const cx = MARGIN + spec.left * PANO_W + phone.width / 2;
    const cy = MARGIN + spec.top * PANEL_H + phone.height / 2;
    built.push({ spec, phone, cx, cy });
    layers.push({
      input: shadowSvg(workW, workH, { cx, cy, w: phone.width, h: phone.height, r: PHONE_RADIUS, rotate: spec.rotate }),
      left: 0,
      top: 0,
    });
  }
  for (const { spec, phone, cx, cy } of built) {
    layers.push(await rotateForCenter(phone.buffer, spec.rotate, cx, cy));
  }

  // Zoomed UI card (privacy panorama): crop, enlarge, white ring, rotate.
  if (pano.zoom) {
    const z = pano.zoom;
    const rawPath = path.join(rawLocaleDir, `${z.raw}.png`);
    const meta = await sharp(rawPath).metadata();
    const crop = {
      left: Math.round(z.crop.left * meta.width),
      top: Math.round(z.crop.top * meta.height),
      width: Math.round(z.crop.width * meta.width),
      height: Math.round(z.crop.height * meta.height),
    };
    const cardW = Math.round(z.width * PANO_W);
    const cardR = Math.round(0.016 * PANO_W);
    const cardH = Math.round((crop.height / crop.width) * cardW);
    const ring = 4;
    const card = await sharp(rawPath)
      .extract(crop)
      .resize({ width: cardW })
      .composite([{ input: roundedMaskSvg(cardW, cardH, cardR), blend: 'dest-in' }])
      .png()
      .toBuffer();
    const ringed = await sharp({ create: { width: cardW + 2 * ring, height: cardH + 2 * ring, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        {
          input: Buffer.from(`<svg width="${cardW + 2 * ring}" height="${cardH + 2 * ring}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${cardW + 2 * ring}" height="${cardH + 2 * ring}" rx="${cardR + ring}" ry="${cardR + ring}"
                  fill="rgba(255,255,255,0.55)"/></svg>`),
          top: 0,
          left: 0,
        },
        { input: card, top: ring, left: ring },
      ])
      .png()
      .toBuffer();
    const cx = MARGIN + z.left * PANO_W + (cardW + 2 * ring) / 2;
    const cy = MARGIN + z.top * PANEL_H + (cardH + 2 * ring) / 2;
    layers.push({
      input: shadowSvg(workW, workH, { cx, cy, w: cardW, h: cardH, r: cardR, rotate: z.rotate }),
      left: 0,
      top: 0,
    });
    layers.push(await rotateForCenter(ringed, z.rotate, cx, cy));
  }

  // Headlines (panel-local, never inside the gutter band).
  const texts = pano.headlines
    .map((hl) => {
      const entry = copy[hl.copyKey];
      if (!entry || !entry.headline) {
        console.warn(`  ⚠ missing copy key "${hl.copyKey}"`);
        return '';
      }
      return headlineSvg(PANO_W, entry.headline, {
        leftPx: hl.left * PANO_W,
        topPx: hl.top * PANEL_H,
        widthPx: hl.width * PANO_W,
        size: hl.size,
        color: pano.headlineColor,
        opacity: hl.opacity ?? 1,
      });
    })
    .join('');
  layers.push({
    input: Buffer.from(`<svg width="${PANO_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`),
    left: MARGIN,
    top: MARGIN,
  });

  const full = await sharp({ create: { width: workW, height: workH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();

  // Crop to the visible canvas, then slice either side of the gutter band.
  const visible = await sharp(full)
    .extract({ left: MARGIN, top: MARGIN, width: PANO_W, height: PANEL_H })
    .png()
    .toBuffer();

  const slices = [
    { left: 0, out: pano.outNames[0] },
    { left: PANEL_W + GUTTER, out: pano.outNames[1] },
  ];
  for (const s of slices) {
    await sharp(visible)
      .extract({ left: s.left, top: 0, width: PANEL_W, height: PANEL_H })
      .removeAlpha() // App Store rejects screenshots with an alpha channel
      .png()
      .toFile(path.join(outDir, s.out));
    console.log(`  ✓ ${s.out}`);
  }
}

/**
 * The single (non-panorama) card — slot 3.
 */
async function composeSingle(single, copy, rawLocaleDir, outDir) {
  const entry = copy[single.copyKey];
  if (!entry || !entry.headline) {
    console.warn(`  ⚠ missing copy key "${single.copyKey}" — skipping single`);
    return;
  }
  const rawPath = path.join(rawLocaleDir, `${single.raw}.png`);
  const phone = await buildPhone(rawPath, Math.round(single.phone.width * PANEL_W));
  const left = Math.round(single.phone.left * PANEL_W) - (BEZEL_INNER + BEZEL_OUTER);
  const top = Math.round(single.phone.top * PANEL_H) - (BEZEL_INNER + BEZEL_OUTER);
  const cx = left + phone.width / 2;
  const cy = top + phone.height / 2;

  await sharp({ create: { width: PANEL_W, height: PANEL_H, channels: 4, background: '#f0fdfa' } })
    .composite([
      {
        input: Buffer.from(`<svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
          <defs>${single.background}</defs>
          <rect width="${PANEL_W}" height="${PANEL_H}" fill="url(#lg)"/></svg>`),
        left: 0,
        top: 0,
      },
      { input: shadowSvg(PANEL_W, PANEL_H, { cx, cy, w: phone.width, h: phone.height, r: PHONE_RADIUS, rotate: 0 }), left: 0, top: 0 },
      { input: phone.buffer, left, top },
      {
        input: Buffer.from(`<svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
          ${headlineSvg(PANEL_W, entry.headline, {
            leftPx: 0.06 * PANEL_W,
            topPx: 0.045 * PANEL_H,
            widthPx: 0.88 * PANEL_W,
            size: HL_SINGLE_SIZE,
            color: single.headlineColor,
            centered: true,
          })}</svg>`),
        left: 0,
        top: 0,
      },
    ])
    .removeAlpha()
    .png()
    .toFile(path.join(outDir, single.outName));
  console.log(`  ✓ ${single.outName}`);
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
  const outDir = path.join(COMPOSED_DIR, locale, 'panorama');
  fs.mkdirSync(outDir, { recursive: true });

  for (const pano of PANORAMAS) {
    await composePanorama(pano, copy, rawLocaleDir, outDir);
  }
  await composeSingle(SINGLE, copy, rawLocaleDir, outDir);
}

async function main() {
  const locales = (process.env.LOCALES || 'en,de').split(',').map((s) => s.trim()).filter(Boolean);
  for (const locale of locales) {
    console.log(`\nComposing panorama set: ${locale}...`);
    await composeLocale(locale);
  }
  console.log(`\n✓ Done. Output: composed/{locale}/panorama/`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('✗ compose-panorama failed:', err);
    process.exit(1);
  });
}

module.exports = { composeLocale, PANORAMAS, SINGLE, GUTTER };
