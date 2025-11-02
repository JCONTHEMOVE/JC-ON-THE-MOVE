import { db } from './db';
import { shopItems } from '@shared/schema';
import { ObjectStorageService } from './objectStorage';
import { eq } from 'drizzle-orm';

/**
 * Migration script to convert base64-encoded images in shop items to object storage URLs
 * 
 * This script:
 * 1. Fetches all shop items from the database
 * 2. For each item with base64 photos:
 *    - Extracts the base64 data
 *    - Saves it to object storage
 *    - Updates the database with the new public URL
 * 3. Logs progress and any errors
 */
async function migrateShopImages() {
  console.log('Starting migration of shop images to object storage...');
  
  const objectStorageService = new ObjectStorageService();
  
  try {
    // Fetch all shop items
    const items = await db.select().from(shopItems);
    console.log(`Found ${items.length} shop items to process`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const item of items) {
      try {
        // Check if photos exist and are base64
        if (!item.photos || !Array.isArray(item.photos) || item.photos.length === 0) {
          console.log(`Skipping ${item.id} - no photos`);
          skipped++;
          continue;
        }
        
        // Check if already migrated (URLs start with /public-objects/)
        const firstPhoto = item.photos[0] as string;
        if (firstPhoto.startsWith('/public-objects/') || firstPhoto.startsWith('http')) {
          console.log(`Skipping ${item.id} - already migrated`);
          skipped++;
          continue;
        }
        
        // Convert each base64 photo to object storage
        const newPhotoUrls: string[] = [];
        
        for (const photo of item.photos) {
          const photoStr = photo as string;
          
          // Determine if it's an image or video
          const isVideo = photoStr.startsWith('data:video/');
          
          // Extract file extension from data URL
          let extension = 'jpg';
          const match = photoStr.match(/^data:(image|video)\/(\w+);base64,/);
          if (match && match[2]) {
            extension = match[2];
          }
          
          // Save to object storage
          let publicUrl;
          if (isVideo) {
            publicUrl = await objectStorageService.saveBase64Video(photoStr, extension);
          } else {
            publicUrl = await objectStorageService.saveBase64Image(photoStr, extension);
          }
          
          newPhotoUrls.push(publicUrl);
        }
        
        // Update the database
        await db
          .update(shopItems)
          .set({
            photos: newPhotoUrls as any,
            updatedAt: new Date(),
          })
          .where(eq(shopItems.id, item.id));
        
        console.log(`✅ Migrated ${item.id} (${item.title}) - ${newPhotoUrls.length} photos`);
        migrated++;
        
      } catch (itemError) {
        console.error(`❌ Error migrating item ${item.id}:`, itemError);
        errors++;
      }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Total items: ${items.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateShopImages()
  .then(() => {
    console.log('\nMigration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
