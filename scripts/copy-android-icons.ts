import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Android icon sizes mapping
const ANDROID_ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Android splash screen sizes
const SPLASH_SIZES = {
  'drawable-land-mdpi': { width: 480, height: 320 },
  'drawable-land-hdpi': { width: 800, height: 480 },
  'drawable-land-xhdpi': { width: 1280, height: 720 },
  'drawable-land-xxhdpi': { width: 1600, height: 960 },
  'drawable-land-xxxhdpi': { width: 1920, height: 1280 },
  'drawable-port-mdpi': { width: 320, height: 480 },
  'drawable-port-hdpi': { width: 480, height: 800 },
  'drawable-port-xhdpi': { width: 720, height: 1280 },
  'drawable-port-xxhdpi': { width: 960, height: 1600 },
  'drawable-port-xxxhdpi': { width: 1280, height: 1920 }
};

const iconsDir = path.join(process.cwd(), 'public', 'icons');
const androidResDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

async function copyAndroidIcons() {
  console.log('Copying Android app icons...');

  // Read the base 512x512 PNG
  const baseIconPath = path.join(iconsDir, 'icon-512x512.png');
  const baseIcon = fs.readFileSync(baseIconPath);

  // Generate launcher icons for each density
  for (const [densityDir, size] of Object.entries(ANDROID_ICON_SIZES)) {
    try {
      const targetDir = path.join(androidResDir, densityDir);
      
      // Generate ic_launcher.png
      await sharp(baseIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));
      
      // Generate ic_launcher_round.png
      await sharp(baseIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));
      
      // Generate ic_launcher_foreground.png (for adaptive icon - with safe zone)
      // Adaptive icons need 66% foreground size for the safe zone
      const foregroundSize = Math.round(size * 0.66);
      const padding = Math.round((size - foregroundSize) / 2);
      
      const foregroundIcon = await sharp(baseIcon)
        .resize(foregroundSize, foregroundSize)
        .png()
        .toBuffer();
      
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        }
      })
        .composite([{
          input: foregroundIcon,
          top: padding,
          left: padding
        }])
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
      
      console.log(`✓ Generated icons for ${densityDir}`);
    } catch (error) {
      console.error(`Failed to generate icons for ${densityDir}:`, error);
    }
  }
}

async function generateSplashScreens() {
  console.log('\nGenerating splash screens...');

  const backgroundColor = '#2563eb'; // Blue theme color
  
  // Read a smaller icon for the splash screen logo
  const logoPath = path.join(iconsDir, 'icon-192x192.png');
  const logo = fs.readFileSync(logoPath);

  for (const [densityDir, dimensions] of Object.entries(SPLASH_SIZES)) {
    try {
      const targetDir = path.join(androidResDir, densityDir);
      
      // Create background
      const background = await sharp({
        create: {
          width: dimensions.width,
          height: dimensions.height,
          channels: 4,
          background: { r: 37, g: 99, b: 235, alpha: 1 }
        }
      }).png().toBuffer();
      
      // Calculate logo size (20% of smallest dimension)
      const logoSize = Math.round(Math.min(dimensions.width, dimensions.height) * 0.3);
      const logoResized = await sharp(logo).resize(logoSize, logoSize).png().toBuffer();
      
      // Center the logo
      const left = Math.round((dimensions.width - logoSize) / 2);
      const top = Math.round((dimensions.height - logoSize) / 2);
      
      // Composite logo on background
      await sharp(background)
        .composite([{
          input: logoResized,
          top: top,
          left: left
        }])
        .png()
        .toFile(path.join(targetDir, 'splash.png'));
      
      console.log(`✓ Generated splash screen for ${densityDir}`);
    } catch (error) {
      console.error(`Failed to generate splash for ${densityDir}:`, error);
    }
  }
}

async function main() {
  await copyAndroidIcons();
  await generateSplashScreens();
  console.log('\n✨ All Android assets generated successfully!');
}

main().catch(console.error);
