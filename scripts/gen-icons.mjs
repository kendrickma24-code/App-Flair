// Generates icon.png (1024x1024), adaptive-icon.png (1024x1024),
// splash-icon.png (200x200), and favicon.png (64x64)
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets');

// Star path lives in a 200x200 viewBox, rotated 12deg around center (100,100)
// Inner waist at ±14 from center
const STAR_PATH = 'M 100 18 L 114 86 L 186 100 L 114 114 L 100 182 L 86 114 L 14 100 L 86 86 Z';

function iconSvg(size) {
  const rx = Math.round(size * 0.22);
  // Star mark at 58% of icon, centered
  const pad = Math.round(size * 0.21);
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6B5BFF"/>
      <stop offset="40%" stop-color="#9B5CE8"/>
      <stop offset="72%" stop-color="#E255B0"/>
      <stop offset="100%" stop-color="#FFB46B"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="url(#bg)"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 200 200">
    <g transform="rotate(12 100 100)">
      <path d="${STAR_PATH}" fill="rgba(255,255,255,0.95)"/>
    </g>
  </svg>
</svg>`;
}

function adaptiveSvg(size) {
  // Foreground only — Android puts this on its own background
  // Use gradient mark, no bg rect
  const pad = Math.round(size * 0.21);
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6B5BFF"/>
      <stop offset="50%" stop-color="#E255B0"/>
      <stop offset="100%" stop-color="#FFB46B"/>
    </linearGradient>
  </defs>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 200 200">
    <g transform="rotate(12 100 100)">
      <path d="${STAR_PATH}" fill="url(#g)"/>
    </g>
  </svg>
</svg>`;
}

function splashSvg(size) {
  // Gradient mark on transparent background
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6B5BFF"/>
      <stop offset="50%" stop-color="#E255B0"/>
      <stop offset="100%" stop-color="#FFB46B"/>
    </linearGradient>
  </defs>
  <g transform="rotate(12 100 100)">
    <path d="${STAR_PATH}" fill="url(#g)"/>
  </g>
</svg>`;
}

// Tight viewBox cropped to the star's actual rotated bounds (~16–184 x, ~20–180 y)
// Gives ~4px margin → star fills ~96% of rendered image instead of ~84%
const MARK_VIEWBOX = '12 12 176 176';

function markWhiteSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">
  <g transform="rotate(12 100 100)">
    <path d="${STAR_PATH}" fill="#ffffff"/>
  </g>
</svg>`;
}

async function generate() {
  await sharp(Buffer.from(iconSvg(1024))).png().toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png  (1024×1024)');

  await sharp(Buffer.from(adaptiveSvg(1024))).png().toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png  (1024×1024)');

  await sharp(Buffer.from(splashSvg(200))).png().toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png  (200×200)');

  await sharp(Buffer.from(iconSvg(64))).png().toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png  (64×64)');

  // White star at 3 sizes for in-app use (tab button, header, onboarding)
  for (const px of [56, 80, 120]) {
    await sharp(Buffer.from(markWhiteSvg(px))).png().toFile(path.join(ASSETS, `mark-white-${px}.png`));
    console.log(`✓ mark-white-${px}.png`);
  }

  // Gradient star at 3 sizes — use tight viewBox so star fills the image
  for (const px of [56, 80, 120]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${MARK_VIEWBOX}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6B5BFF"/>
      <stop offset="50%" stop-color="#E255B0"/>
      <stop offset="100%" stop-color="#FFB46B"/>
    </linearGradient>
  </defs>
  <g transform="rotate(12 100 100)">
    <path d="${STAR_PATH}" fill="url(#g)"/>
  </g>
</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, `mark-gradient-${px}.png`));
    console.log(`✓ mark-gradient-${px}.png`);
  }
}

generate().catch(e => { console.error(e); process.exit(1); });
