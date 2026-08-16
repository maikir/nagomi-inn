/**
 * Regenerates the footer Instagram QR from the handle in src/config/site.ts.
 * Styled: rounded "dot" modules in sumi ink, with the Instagram camera glyph
 * (brand gradient) knocked out of the centre. Generated at error-correction
 * level H (~30% recoverable) so the centre logo never breaks scannability.
 *
 * Run after changing the handle:  bun run qr
 */
import { writeFileSync } from "node:fs";
import QRCode from "qrcode";
import { site } from "../src/config/site";

const url = `https://instagram.com/${site.contact.instagram}`;
const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
const N = qr.modules.size;
const data = qr.modules.data;
const margin = 2;
const total = N + margin * 2;

const ink = "#1a1e21";

// Rounded module dots.
let rects = "";
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    if (data[r * N + c]) {
      rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" rx="0.3"/>`;
    }
  }
}

// Centre Instagram glyph on a white knockout (well within the H recovery budget).
const cx = total / 2;
const rWhite = total * 0.165;
const gb = total * 0.2; // glyph box side
const gx = cx - gb / 2;
const inset = gb * 0.13;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}">
<defs>
  <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#feda75"/>
    <stop offset="0.25" stop-color="#fa7e1e"/>
    <stop offset="0.5" stop-color="#d62976"/>
    <stop offset="0.75" stop-color="#962fbf"/>
    <stop offset="1" stop-color="#4f5bd5"/>
  </linearGradient>
</defs>
<g fill="${ink}">${rects}</g>
<circle cx="${cx}" cy="${cx}" r="${rWhite}" fill="#ffffff"/>
<g fill="none" stroke="url(#ig)" stroke-width="${gb * 0.085}" stroke-linecap="round" stroke-linejoin="round">
  <rect x="${gx + inset}" y="${gx + inset}" width="${gb - inset * 2}" height="${gb - inset * 2}" rx="${gb * 0.26}"/>
  <circle cx="${cx}" cy="${cx}" r="${gb * 0.2}"/>
</g>
<circle cx="${gx + gb * 0.74}" cy="${gx + gb * 0.26}" r="${gb * 0.05}" fill="url(#ig)"/>
</svg>`;

writeFileSync("public/images/instagram-qr.svg", svg);
console.log(`instagram-qr.svg written (${N}×${N}, level H) for ${url}`);
