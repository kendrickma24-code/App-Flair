import puppeteer from 'puppeteer';

const SIZE = 1024;

function starPath(cx, cy, R, r, rotation = 15) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const angle = (rotation + i * 45) * Math.PI / 180;
    const radius = i % 2 === 0 ? R : r;
    pts.push(`${cx + radius * Math.sin(angle)},${cy - radius * Math.cos(angle)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

const C = SIZE / 2;
const path = starPath(C, C, C * 0.62, C * 0.15, 15);

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${SIZE}px; height: ${SIZE}px; background: #040917; }
</style>
</head>
<body>
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <path d="${path}" fill="#ffffff"/>
</svg>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 200));

  const iconPath = '/Users/kendrick/Desktop/flightshare/assets/icon.png';
  await page.screenshot({ path: iconPath, type: 'png' });
  console.log('Saved to', iconPath);

  await browser.close();
})();
