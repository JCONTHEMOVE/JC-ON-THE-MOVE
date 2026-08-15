import fs from "node:fs/promises";
import path from "node:path";
import {
  loadApprovedMarketingPhoto,
  renderMarketingCreativeBuffer,
} from "../server/services/marketingCreativeGenerator";

const outputDir = path.resolve(process.cwd(), ".local", "marketing-creative-preview");
const sourceBuffer = await loadApprovedMarketingPhoto("crew-ramp");
const overlay = {
  area: "Northwoods",
  focus: "U-Haul load/unload",
  promoCode: "YYSE09Z9",
};

await fs.mkdir(outputDir, { recursive: true });
await Promise.all([
  renderMarketingCreativeBuffer({ sourceBuffer, variant: "feed", overlay })
    .then((buffer) => fs.writeFile(path.join(outputDir, "facebook-feed-1080x1350.jpg"), buffer)),
  renderMarketingCreativeBuffer({ sourceBuffer, variant: "og", overlay })
    .then((buffer) => fs.writeFile(path.join(outputDir, "facebook-og-1200x630.jpg"), buffer)),
]);

console.log(`Rendered marketing creative previews in ${outputDir}`);
