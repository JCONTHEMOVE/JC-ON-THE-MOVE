import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  /**
   * Generate encryption key from password and salt
   */
  private static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(password, salt, EncryptionService.KEY_LENGTH)) as Buffer;
  }

  /**
   * Get encryption password from environment
   * In production, this should come from a secure key management service
   */
  private static getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY || 'dev-fallback-key-not-secure-for-production';
    if (key === 'dev-fallback-key-not-secure-for-production') {
      console.warn('⚠️  Using fallback encryption key. Set ENCRYPTION_KEY environment variable for production.');
    }
    return key;
  }

  /**
   * Encrypt sensitive data
   * Returns base64 encoded string containing salt, iv, authTag, and encrypted data
   */
  static async encrypt(plaintext: string): Promise<string> {
    try {
      const password = EncryptionService.getEncryptionKey();
      
      // Generate random salt and IV
      const salt = randomBytes(EncryptionService.SALT_LENGTH);
      const iv = randomBytes(EncryptionService.IV_LENGTH);
      
      // Derive encryption key
      const key = await EncryptionService.deriveKey(password, salt);
      
      // Create cipher and encrypt
      const cipher = createCipheriv(EncryptionService.ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components
      const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * Accepts base64 encoded string and returns original plaintext
   */
  static async decrypt(encryptedData: string): Promise<string> {
    try {
      const password = EncryptionService.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.subarray(0, EncryptionService.SALT_LENGTH);
      const iv = combined.subarray(
        EncryptionService.SALT_LENGTH, 
        EncryptionService.SALT_LENGTH + EncryptionService.IV_LENGTH
      );
      const authTag = combined.subarray(
        EncryptionService.SALT_LENGTH + EncryptionService.IV_LENGTH,
        EncryptionService.SALT_LENGTH + EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH
      );
      const encrypted = combined.subarray(
        EncryptionService.SALT_LENGTH + EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH
      );
      
      // Derive decryption key
      const key = await EncryptionService.deriveKey(password, salt);
      
      // Create decipher and decrypt
      const decipher = createDecipheriv(EncryptionService.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt bank details for secure storage
   */
  static async encryptBankDetails(bankDetails: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
    bankName: string;
  }): Promise<string> {
    const sensitiveData = JSON.stringify({
      accountNumber: bankDetails.accountNumber,
      routingNumber: bankDetails.routingNumber,
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      encryptedAt: new Date().toISOString()
    });
    
    return await EncryptionService.encrypt(sensitiveData);
  }

  /**
   * Decrypt bank details from secure storage
   */
  static async decryptBankDetails(encryptedData: string): Promise<{
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
    bankName: string;
    encryptedAt?: string;
  }> {
    const decrypted = await EncryptionService.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }

  /**
   * Get masked bank details for display (last 4 digits only)
   */
  static async getMaskedBankDetails(encryptedData: string): Promise<{
    accountNumberLast4: string;
    accountHolderName: string;
    bankName: string;
  }> {
    const bankDetails = await EncryptionService.decryptBankDetails(encryptedData);
    
    return {
      accountNumberLast4: bankDetails.accountNumber.slice(-4),
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName
    };
  }
}