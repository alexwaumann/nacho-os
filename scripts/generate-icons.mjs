// Renders the Nacho OS app icon (the NachoLogo mark from TopBar) into resources/ and public/.
// Usage: bun scripts/generate-icons.mjs   (sharp is a devDependency)

import sharp from "sharp";
import { mkdirSync } from "node:fs";

const root = process.argv[2] ?? new URL("..", import.meta.url).pathname;
const mode = process.argv[3] ?? "final";

function oklchToHex(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h),
    b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((c) => {
        c = Math.min(1, Math.max(0, c));
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(v * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export const colors = {
  primary: oklchToHex(0.59, 0.14, 242),
  darkBg: oklchToHex(0.13, 0.028, 261.692),
  slate900: oklchToHex(0.208, 0.042, 265.755),
  amber400: oklchToHex(0.828, 0.189, 84.429),
  amber500: oklchToHex(0.769, 0.188, 70.08),
  sky500: oklchToHex(0.685, 0.169, 237.323),
};
console.log(colors);

// Glyph in lucide's 24-unit space: Triangle rotated 180deg + chip dot at the tip (cy=23, r=3 incl. 1px ring)
// Bounds (incl. 2.5 stroke): x ~0.8..23.2, y ~1.75..26
function svg(size, bg, glyphFrac, ring) {
  const gx0 = 0.75,
    gx1 = 23.25,
    gy0 = 1.75,
    gy1 = 26;
  const gw = gx1 - gx0,
    gh = gy1 - gy0;
  const scale = (size * glyphFrac) / Math.max(gw, gh);
  const tx = size / 2 - ((gx0 + gx1) / 2) * scale;
  const ty = size / 2 - ((gy0 + gy1) / 2) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="sh" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
      <feDropShadow dx="0" dy="${0.5}" stdDeviation="${0.5}" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})" filter="url(#sh)">
    <path transform="rotate(180 12 12)" d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
      fill="${colors.amber400}" stroke="${colors.amber500}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="23" r="2.5" fill="${colors.sky500}" stroke="${ring}" stroke-width="1"/>
  </g>
</svg>`;
}

async function render(file, size, bg, frac, ring) {
  await sharp(Buffer.from(svg(size, bg, frac, ring)))
    .flatten({ background: bg })
    .removeAlpha()
    .png()
    .toFile(file);
  console.log("wrote", file);
}

if (mode === "final") {
  const bg = colors.primary,
    ring = "#ffffff";
  mkdirSync(`${root}/resources`, { recursive: true });
  await render(`${root}/resources/icon.png`, 1024, bg, 0.66, ring);
  await render(`${root}/resources/splash.png`, 2732, bg, 0.2, ring);
  await render(`${root}/public/logo512.png`, 512, bg, 0.66, ring);
  await render(`${root}/public/logo192.png`, 192, bg, 0.66, ring);
  await render(`${root}/public/apple-touch-icon.png`, 180, bg, 0.66, ring);
}
