import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const ICON = '../assets/icon.png';

// --- sample the icon's brand teal (solid area near top-center) ---
async function sampleTeal() {
  const { data, info } = await sharp(ICON).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const [r, g, b] = px(512, 130);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// --- 1. Feature graphic 1024x500 ---
async function featureGraphic(teal) {
  const W = 1024, H = 500;
  const cream = '#f4efe4';
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${teal}"/>
    <text x="470" y="205" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="62" font-weight="700" fill="${cream}">Open Working</text>
    <text x="470" y="278" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="62" font-weight="700" fill="${cream}">Hours</text>
    <text x="472" y="345" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="31" font-weight="400" fill="${cream}" opacity="0.92">Automatic working-hours tracking</text>
    <text x="472" y="388" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="26" font-weight="400" fill="${cream}" opacity="0.78">Privacy-first &#183; for healthcare workers</text>
  </svg>`;
  const iconSize = 330;
  const icon = await sharp(ICON).resize(iconSize, iconSize).png().toBuffer();
  await sharp(Buffer.from(svg))
    .composite([{ input: icon, left: 95, top: (H - iconSize) / 2 }])
    .png()
    .toFile('play/feature-graphic-1024x500.png');
  console.log('  feature graphic -> play/feature-graphic-1024x500.png');
}

// --- 2. Pad screenshots to <= 2:1 (1320x2868 -> 1480x2868) ---
async function padScreenshots() {
  const TARGET_W = 1480; // 2868/1480 = 1.938 <= 2:1
  for (const locale of ['en', 'de']) {
    const srcDir = `composed/${locale}`;
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.png'));
    for (const f of files) {
      const src = `${srcDir}/${f}`;
      const meta = await sharp(src).metadata();
      if (meta.width !== 1320) { console.log(`  skip ${src} (w=${meta.width})`); continue; }
      // sample this image's top-left corner to pad seamlessly
      const { data } = await sharp(src).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      const bg = { r: data[0], g: data[1], b: data[2], alpha: 1 };
      const pad = Math.round((TARGET_W - meta.width) / 2);
      const out = `play/screenshots/${locale}/${f}`;
      mkdirSync(dirname(out), { recursive: true });
      await sharp(src)
        .extend({ left: pad, right: TARGET_W - meta.width - pad, top: 0, bottom: 0, background: bg })
        .png()
        .toFile(out);
    }
    console.log(`  ${locale}: padded ${files.length} screenshots -> play/screenshots/${locale}/ (1480x2868)`);
  }
}

mkdirSync('play', { recursive: true });
const teal = await sampleTeal();
console.log('brand teal:', teal);
await featureGraphic(teal);
await padScreenshots();
console.log('done');
