# Android Deployment Guide - Google Play Store

This guide explains how to build and deploy the JC ON THE MOVE mobile app to the Google Play Store.

## Prerequisites

Before you begin, ensure you have:

1. **Android Studio** installed on your computer
   - Download from: https://developer.android.com/studio
   - Install Android SDK and build tools

2. **Google Play Developer Account** ($25 one-time fee)
   - Sign up at: https://play.google.com/console

3. **Java Development Kit (JDK) 17** or later
   - Required for Android builds

## Quick Start

### 1. Regenerate Android Assets (First Time or After Icon Changes)

```bash
npx tsx scripts/copy-android-icons.ts
```

This generates:
- App icons for all Android densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- Adaptive icon foregrounds with proper safe zones
- Splash screens for all orientations and densities

**Note**: Only needed when you update the base icon files in `public/icons/`.

### 2. Build the Production Web App

```bash
npm run build
```

This creates an optimized production build in `dist/public/`.

### 3. Sync to Android Platform

```bash
npx cap sync android
```

This copies the web assets to the Android project.

### 4. Open in Android Studio

```bash
npx cap open android
```

This opens the project in Android Studio.

## Building the APK/AAB

### For Testing (APK)

1. In Android Studio, go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for the build to complete
3. The APK will be in: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
4. Install on your device for testing: `adb install app-release.apk`

### For Play Store (AAB - Android App Bundle)

1. In Android Studio, go to **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Click **Next**

#### First Time: Create a Keystore

1. Click **Create new...**
2. Fill in the form:
   - **Key store path**: Choose a secure location (e.g., `~/keystores/jc-mobile.jks`)
   - **Password**: Create a strong password (save this securely!)
   - **Key alias**: `jc-mobile-key`
   - **Key password**: Same or different from keystore password
   - **Certificate**: Fill in your organization details
     - Name: Your name
     - Organizational Unit: Mobile Development
     - Organization: JC ON THE MOVE LLC
     - City/Locality: Your city
     - State/Province: Your state
     - Country Code: US
3. Click **OK**
4. **IMPORTANT**: Backup your keystore file securely! You'll need it for all future updates.

#### Subsequent Builds: Use Existing Keystore

1. Click **Choose existing...**
2. Navigate to your keystore file
3. Enter your keystore password
4. Select the key alias
5. Enter the key password
6. Click **Next**

### Build Configuration

1. Select **release** as the build variant
2. Click **Finish**
3. Wait for the build to complete (may take 5-10 minutes)
4. The AAB file will be in: `android/app/build/outputs/bundle/release/app-release.aab`

## Preparing for Play Store

### 1. App Information

- **App Name**: JC ON THE MOVE - Mobile Lead Management
- **Package Name**: `com.jconthemove.mobile`
- **Version Code**: 1 (increment for each release)
- **Version Name**: 1.0

### 2. Required Assets

All assets are already generated and located in:
- **App Icons**: `android/app/src/main/res/mipmap-*/`
- **Splash Screens**: `android/app/src/main/res/drawable-*/splash.png`

You'll also need for Play Store listing:

#### Screenshots (Required)
- **Phone**: At least 2 screenshots (1080x1920 or 1440x2560)
- **7-inch Tablet**: Optional but recommended
- **10-inch Tablet**: Optional but recommended

Take screenshots of:
1. Home page / Login screen
2. Dashboard (employee or admin view)
3. Job listing page
4. Job details page
5. Mining/rewards page

#### Feature Graphic (Required)
- **Size**: 1024 x 500 pixels
- **Format**: PNG or JPEG
- **Content**: Eye-catching banner with app name and tagline

#### App Icon (512x512)
- Already available at: `public/icons/icon-512x512.png`

### 3. Privacy Policy (Required)

You must host a privacy policy URL. Create a page on your website:
- Example: `https://jconthemove.com/privacy-policy`
- Must explain data collection, usage, and user rights

### 4. App Content Rating

Complete the content rating questionnaire in Play Console to receive ratings (Everyone, Teen, etc.)

## Uploading to Play Store

### 1. Create App Listing

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in basic information:
   - **App name**: JC ON THE MOVE
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
4. Accept declarations and click **Create app**

### 2. Set Up Store Listing

1. Navigate to **Store presence → Main store listing**
2. Fill in:
   - **App name**: JC ON THE MOVE - Mobile Lead Management
   - **Short description**: Professional moving & junk removal - Mobile lead management for on-the-go operations
   - **Full description**:
     ```
     JC ON THE MOVE provides professional moving and junk removal services with cutting-edge mobile lead management.
     
     Features:
     • Real-time job tracking and management
     • Customer quote requests and communications
     • Employee job assignments and progress updates
     • Integrated rewards and gamification system
     • Live token pricing and treasury management
     • Comprehensive review and rating system
     • E-commerce marketplace for moving supplies
     
     Perfect for movers, employees, and customers to stay connected on the go!
     ```
   - **App icon**: Upload `public/icons/icon-512x512.png`
   - **Feature graphic**: Upload your 1024x500 banner
   - **Phone screenshots**: Upload 2-8 screenshots
   - **Category**: Business or Productivity
   - **Contact details**: Your email and website
   - **Privacy policy**: Your privacy policy URL

3. Click **Save**

### 3. Upload Release

1. Navigate to **Release → Production**
2. Click **Create new release**
3. Upload your signed AAB file: `app-release.aab`
4. Review and accept any warnings
5. Enter **Release name**: `1.0 - Initial Release`
6. Enter **Release notes**:
   ```
   Initial release of JC ON THE MOVE mobile app!
   
   Features:
   - Customer quote requests
   - Employee job management
   - Real-time notifications
   - Rewards and gamification
   - E-commerce marketplace
   - Admin dashboard
   ```
7. Click **Next**

### 4. Complete Setup Tasks

Before you can publish, complete all required tasks in Play Console:
- ✅ App access (if login required, provide test credentials)
- ✅ Ads (declare if your app shows ads)
- ✅ Content rating (complete questionnaire)
- ✅ Target audience (select age groups)
- ✅ News apps (select "No" if not a news app)
- ✅ COVID-19 contact tracing (select "No")
- ✅ Data safety (declare data collection practices)
- ✅ Government apps (select "No" if not a government app)

### 5. Review and Publish

1. Navigate to **Publishing overview**
2. Review all sections for completion
3. Click **Send for review**
4. Wait for Google's review (typically 1-7 days)

## Updating the App

When you need to release an update:

### 1. Update Version Numbers

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2  // Increment by 1
    versionName "1.1"  // Your version number
}
```

### 2. Build New Version

```bash
# 1. Make your code changes
# 2. Build production web app
npm run build

# 3. Sync to Android
npx cap sync android

# 4. Open Android Studio and build signed AAB
npx cap open android
```

### 3. Upload to Play Console

1. Go to **Release → Production**
2. Click **Create new release**
3. Upload new AAB
4. Add release notes describing what's new
5. Submit for review

## Testing Before Release

### Internal Testing Track

1. Upload AAB to **Internal testing** track first
2. Add email addresses of testers
3. Share the test link with your team
4. Get feedback and fix issues
5. Then promote to Production

### Alpha/Beta Testing

For wider testing before public release:
1. Use **Closed testing (alpha)** for small group
2. Use **Open testing (beta)** for public beta
3. Collect feedback and analytics
4. Fix issues before Production release

## Troubleshooting

### Build Errors

**Problem**: Gradle sync failed
- **Solution**: Update Android Studio and SDK tools

**Problem**: Icon resources not found
- **Solution**: Run `npx tsx scripts/copy-android-icons.ts` to regenerate icons

**Problem**: Keystore password forgotten
- **Solution**: You cannot recover the keystore. Create a new one and publish as a new app (different package name)

### Upload Errors

**Problem**: "You need to use a different version code"
- **Solution**: Increment `versionCode` in `build.gradle`

**Problem**: "You uploaded a debuggable APK"
- **Solution**: Build a release AAB, not debug APK

## Important Files

- **`capacitor.config.ts`**: Capacitor configuration
- **`android/app/build.gradle`**: Android build settings and versions
- **`android/app/src/main/AndroidManifest.xml`**: App permissions and metadata
- **`android/app/src/main/res/`**: All app resources (icons, splash screens, etc.)
- **Your keystore file**: **BACKUP THIS SECURELY!** Required for all future updates

## Support

For issues:
- Capacitor docs: https://capacitorjs.com/docs/android
- Android Studio: https://developer.android.com/studio/intro
- Play Console: https://support.google.com/googleplay/android-developer

## Quick Command Reference

```bash
# Install dependencies
npm install

# Build production web app
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Regenerate Android icons
npx tsx scripts/copy-android-icons.ts

# Regenerate PWA icons
npx tsx scripts/generate-pwa-icons.ts
```

---

**Note**: Keep your keystore file and passwords in a secure location. Losing them means you cannot update your app - you'd have to publish a completely new app with a different package name!
