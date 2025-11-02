import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(process.cwd(), 'public', 'icons');

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Read the 512x512 SVG as the base
  const svgPath = path.join(iconsDir, 'icon-512x512.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    try {
      // Generate regular icon
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      
      console.log(`✓ Generated icon-${size}x${size}.png`);

      // Generate maskable icon (with padding for safe zone)
      const paddedSize = Math.round(size * 0.8); // 80% size leaves 10% safe zone on each side
      const padding = Math.round((size - paddedSize) / 2);
      
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 37, g: 99, b: 235, alpha: 1 } // #2563eb
        }
      })
        .composite([{
          input: await sharp(svgBuffer).resize(paddedSize, paddedSize).png().toBuffer(),
          top: padding,
          left: padding
        }])
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}-maskable.png`));
      
      console.log(`✓ Generated icon-${size}x${size}-maskable.png`);
    } catch (error) {
      console.error(`Failed to generate ${size}x${size}:`, error);
    }
  }

  console.log('\n✨ All icons generated successfully!');
}

generateIcons().catch(console.error);
