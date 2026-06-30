import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(__dirname, '..', 'public', 'og-image.png');

const width = 1200;
const height = 630;

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f1a" />
      <stop offset="50%" stop-color="#121213" />
      <stop offset="100%" stop-color="#1a1a2e" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
    <linearGradient id="glow" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)" />

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" />

  <circle cx="900" cy="150" r="300" fill="#6366f1" opacity="0.04" />
  <circle cx="1000" cy="400" r="250" fill="#4f46e5" opacity="0.03" />
  <circle cx="200" cy="500" r="200" fill="#818cf8" opacity="0.03" />

  <rect x="420" y="170" width="6" height="60" rx="3" fill="url(#accent)" />

  <text x="450" y="220" font-family="'Outfit', 'Segoe UI', Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="-2" fill="#ffffff" text-transform="uppercase">
    Variant
  </text>

  <text x="450" y="270" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="24" font-weight="500" fill="#9ca3af" letter-spacing="2">
    Multiplayer Word Game
  </text>

  <line x1="450" y1="300" x2="650" y2="300" stroke="#6366f1" stroke-width="2" opacity="0.4" />

  <text x="450" y="350" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="16" fill="#6b7280">
    Daily challenges · Live races · Async play · Bot marathons
  </text>

  <rect x="450" y="380" width="160" height="36" rx="8" fill="none" stroke="#6366f1" stroke-width="1.5" opacity="0.5" />
  <text x="530" y="403" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="13" fill="#818cf8" text-anchor="middle" font-weight="600">
    wordle-variant.xyz
  </text>

  <rect x="80" y="460" width="320" height="3" rx="1.5" fill="#6366f1" opacity="0.3" />
  <rect x="80" y="460" width="120" height="3" rx="1.5" fill="url(#accent)" />
  <text x="80" y="490" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="12" fill="#4b5563" letter-spacing="1">
    WORDLE-VARIANT.XYZ
  </text>
</svg>
`;

await sharp(Buffer.from(svg)).png().toFile(output);
console.log('OG image generated:', output);
