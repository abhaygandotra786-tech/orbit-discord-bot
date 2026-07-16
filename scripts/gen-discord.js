/**
 * Generate Discord-ready brand images from the Orbit mascot.
 * Outputs to web/public/assets/discord/
 *   - icon.png         512x512  (bot avatar + server icon)
 *   - server-banner.png 960x540 (Discord server banner)
 *   - bot-banner.png   680x240  (bot profile banner)
 * Run: node scripts/gen-discord.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.join(__dirname, "../web/public/assets/discord");
fs.mkdirSync(outDir, { recursive: true });

// Shared gradient defs.
const DEFS = `
  <radialGradient id="mBody" cx="38%" cy="30%" r="78%">
    <stop offset="0%" stop-color="#FFCC7A"/>
    <stop offset="46%" stop-color="#FF7A3D"/>
    <stop offset="100%" stop-color="#E73B27"/>
  </radialGradient>
  <linearGradient id="mRing" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FFB648"/>
    <stop offset="100%" stop-color="#FF4D2D"/>
  </linearGradient>
  <linearGradient id="word" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FFCE86"/>
    <stop offset="55%" stop-color="#FF7A3D"/>
    <stop offset="100%" stop-color="#FF4D2D"/>
  </linearGradient>`;

// Mascot art authored in a ~260x270 box (centre ~130,132).
const MASCOT = `
  <g transform="rotate(-18 130 150)">
    <ellipse cx="130" cy="150" rx="118" ry="34" fill="none" stroke="url(#mRing)" stroke-width="9" opacity="0.85"/>
  </g>
  <circle cx="130" cy="132" r="74" fill="url(#mBody)"/>
  <ellipse cx="106" cy="104" rx="26" ry="18" fill="#fff" opacity="0.16"/>
  <circle cx="102" cy="156" r="10" fill="#E73B27" opacity="0.32"/>
  <circle cx="162" cy="110" r="7" fill="#E73B27" opacity="0.28"/>
  <circle cx="152" cy="164" r="5" fill="#E73B27" opacity="0.28"/>
  <circle cx="96" cy="146" r="8" fill="#fff" opacity="0.22"/>
  <circle cx="166" cy="146" r="8" fill="#fff" opacity="0.22"/>
  <ellipse cx="111" cy="126" rx="11" ry="13" fill="#3a1f14"/>
  <ellipse cx="151" cy="126" rx="11" ry="13" fill="#3a1f14"/>
  <circle cx="115" cy="121" r="3.4" fill="#fff"/>
  <circle cx="155" cy="121" r="3.4" fill="#fff"/>
  <path d="M114 150 Q131 166 148 150" fill="none" stroke="#3a1f14" stroke-width="4.5" stroke-linecap="round"/>
  <g transform="rotate(-18 130 150)">
    <path d="M 12 150 A 118 34 0 0 0 248 150" fill="none" stroke="url(#mRing)" stroke-width="9" stroke-linecap="round"/>
  </g>`;

const spark = (x, y, s, c, o = 0.9) =>
    `<path d="M${x} ${y} l${s} ${s * 2} ${s * 2} ${s} -${s * 2} ${s} -${s} ${s * 2} -${s} -${s * 2} -${s * 2} -${s} ${s * 2} -${s} z" fill="${c}" opacity="${o}"/>`;

// --- Icon (avatar / server icon), circle-safe --------------------
const icon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${DEFS}
    <radialGradient id="bgd" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#241511"/>
      <stop offset="100%" stop-color="#100b0a"/>
    </radialGradient>
    <radialGradient id="iglow" cx="50%" cy="46%" r="46%">
      <stop offset="0%" stop-color="#FF6A3D" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FF6A3D" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgd)"/>
  <circle cx="256" cy="236" r="200" fill="url(#iglow)"/>
  <g transform="translate(51 50) scale(1.65)">${MASCOT}</g>
  ${spark(430, 96, 6, "#FFB648")}
  ${spark(78, 150, 5, "#FFCC7A", 0.8)}
</svg>`;

// --- Server banner 960x540 ---------------------------------------
const serverBanner = `<svg width="960" height="540" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${DEFS}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1210"/>
      <stop offset="100%" stop-color="#100b0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF6A3D" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#FF6A3D" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <ellipse cx="720" cy="270" rx="360" ry="320" fill="url(#glow)"/>
  <text x="80" y="286" font-family="Arial, Helvetica, sans-serif" font-size="118" font-weight="800" fill="url(#word)" letter-spacing="2">ORBIT</text>
  <text x="84" y="338" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#FFD9A6" letter-spacing="8">CONNECT · DISCOVER · GROW</text>
  <g transform="translate(590 130) scale(1.16)">${MASCOT}</g>
  ${spark(560, 120, 7, "#FFB648")}
  ${spark(890, 430, 5, "#FFCC7A", 0.8)}
</svg>`;

// --- Bot profile banner 680x240 ----------------------------------
const botBanner = `<svg width="680" height="240" viewBox="0 0 680 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${DEFS}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1210"/>
      <stop offset="100%" stop-color="#100b0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF6A3D" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#FF6A3D" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="680" height="240" fill="url(#bg)"/>
  <ellipse cx="530" cy="120" rx="230" ry="180" fill="url(#glow)"/>
  <text x="54" y="132" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="url(#word)" letter-spacing="1">ORBIT</text>
  <text x="57" y="166" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#FFD9A6" letter-spacing="6">CONNECT · DISCOVER · GROW</text>
  <g transform="translate(430 26) scale(0.72)">${MASCOT}</g>
</svg>`;

async function render(svg, name, width) {
    await sharp(Buffer.from(svg), { density: 384 })
        .resize({ width })
        .png()
        .toFile(path.join(outDir, name));
    console.log("wrote", name);
}

(async () => {
    await render(icon, "icon.png", 512);
    await render(serverBanner, "server-banner.png", 960);
    await render(botBanner, "bot-banner.png", 680);
})();
