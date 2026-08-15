import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

function getObjectStorageClient() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    return new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      credentials: JSON.parse(credentialsJson),
    });
  }

  return new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
  });
}

// Uses standard Google Cloud credentials. Configure either
// GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_APPLICATION_CREDENTIALS_JSON, or ADC.
export const objectStorageClient = getObjectStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set it to comma-separated Google Cloud Storage paths like /bucket-name/public."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set it to a Google Cloud Storage path like /bucket-name/private."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
     
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Save a base64-encoded image to object storage and return the public URL
  async saveBase64Image(base64Data: string, fileExtension: string = 'jpg'): Promise<string> {
    // Extract the base64 content (remove data URL prefix if present)
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    
    // Decode base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Generate unique filename in the public directory
    const filename = `shop/${randomUUID()}.${fileExtension}`;
    const publicSearchPaths = this.getPublicObjectSearchPaths();
    const publicPath = publicSearchPaths[0]; // Use first public path
    const fullPath = `${publicPath}/${filename}`;
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    // Determine content type from extension
    const contentTypeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    const contentType = contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';
    
    // Upload the file
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Return the public URL path
    return `/public-objects/${filename}`;
  }

  // Save a base64-encoded video to object storage and return the public URL
  async saveBase64Video(base64Data: string, fileExtension: string = 'mp4'): Promise<string> {
    // Extract the base64 content (remove data URL prefix if present)
    const base64Match = base64Data.match(/^data:video\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    
    // Decode base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Generate unique filename in the public directory
    const filename = `shop/${randomUUID()}.${fileExtension}`;
    const publicSearchPaths = this.getPublicObjectSearchPaths();
    const publicPath = publicSearchPaths[0]; // Use first public path
    const fullPath = `${publicPath}/${filename}`;
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    // Determine content type from extension
    const contentTypeMap: { [key: string]: string } = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
    };
    const contentType = contentTypeMap[fileExtension.toLowerCase()] || 'video/mp4';
    
    // Upload the file
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Return the public URL path
    return `/public-objects/${filename}`;
  }

  // Save a raw Buffer directly (from multipart upload) to object storage
  async saveFileBuffer(buffer: Buffer, mimeType: string, fileExtension: string): Promise<string> {
    const isVideo = mimeType.startsWith('video/');
    const subdir = isVideo ? 'shop/videos' : 'shop';
    return this.savePublicFileBuffer(buffer, mimeType, fileExtension, subdir);
  }

  // Save a raw Buffer under an explicit public namespace. The namespace is
  // validated so callers cannot turn an upload into an arbitrary object path.
  async savePublicFileBuffer(
    buffer: Buffer,
    mimeType: string,
    fileExtension: string,
    subdir: string,
  ): Promise<string> {
    const safeSubdir = subdir.trim().replace(/^\/+|\/+$/g, '');
    if (!/^[a-z0-9][a-z0-9/_-]{0,120}$/i.test(safeSubdir) || safeSubdir.includes('..')) {
      throw new Error('Invalid public object namespace');
    }
    const safeExtension = fileExtension.trim().toLowerCase().replace(/^\./, '');
    if (!/^(jpe?g|png|webp|gif|mp4|webm|ogg|mov)$/.test(safeExtension)) {
      throw new Error('Unsupported public object extension');
    }
    const filename = `${safeSubdir}/${randomUUID()}.${safeExtension}`;
    const publicSearchPaths = this.getPublicObjectSearchPaths();
    const publicPath = publicSearchPaths[0];
    const fullPath = `${publicPath}/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    return `/public-objects/${filename}`;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}
