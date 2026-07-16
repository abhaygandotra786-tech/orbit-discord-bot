/**
 * Rasterize the mascot SVG sources into PNGs for Discord embeds.
 * Run: node scripts/gen-assets.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dir = path.join(__dirname, "../web/public/assets");

async function render(svgName, pngName, width) {
    const svg = fs.readFileSync(path.join(dir, svgName));
    await sharp(svg, { density: 384 })
        .resize({ width })
        .png()
        .toFile(path.join(dir, pngName));
    console.log("wrote", pngName);
}

(async () => {
    await render("logo.svg", "logo.png", 512);
    await render("banner.svg", "banner.png", 1200);
})();
