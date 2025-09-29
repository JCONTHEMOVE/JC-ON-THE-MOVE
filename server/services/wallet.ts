import { storage } from '../storage';
import type { 
  SupportedCurrency, 
  InsertSupportedCurrency, 
  UserWallet, 
  InsertUserWallet,
  WalletTransaction,
  InsertWalletTransaction 
} from '@shared/schema';
import { TREASURY_CONFIG } from '../constants';

/**
 * Crypto Wallet Service
 * Manages individual user crypto wallets for multiple currencies
 */
export class WalletService {
  
  /**
   * Initialize default supported currencies
   */
  async initializeDefaultCurrencies(): Promise<void> {
    try {
      const existingCurrencies = await storage.getSupportedCurrencies();
      
      if (existingCurrencies.length === 0) {
        // Initialize default currencies
        const defaultCurrencies: InsertSupportedCurrency[] = [
          {
            symbol: 'JCMOVES',
            name: 'JCMOVES Token',
            network: 'solana',
            contractAddress: TREASURY_CONFIG.TOKEN_ADDRESS,
            decimals: 8,
            isActive: true,
            minimumBalance: '0.00000001',
            withdrawalFeePercent: '2.00'
          },
          {
            symbol: 'SOL',
            name: 'Solana',
            network: 'solana',
            contractAddress: null, // Native token
            decimals: 9,
            isActive: true,
            minimumBalance: '0.001',
            withdrawalFeePercent: '1.00'
          },
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            network: 'bitcoin',
            contractAddress: null, // Native token
            decimals: 8,
            isActive: true,
            minimumBalance: '0.00001',
            withdrawalFeePercent: '0.50'
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            network: 'ethereum',
            contractAddress: null, // Native token
            decimals: 18,
            isActive: true,
            minimumBalance: '0.001',
            withdrawalFeePercent: '1.50'
          }
        ];

        for (const currency of defaultCurrencies) {
          await storage.createSupportedCurrency(currency);
        }
        
        console.log('✅ Initialized default supported currencies');
      }
    } catch (error) {
      console.error('Error initializing currencies:', error);
    }
  }

  /**
   * Generate a crypto wallet address (simplified for demo)
   * In production, this would use proper crypto libraries
   */
  private generateWalletAddress(network: string): { address: string; publicKey: string; privateKeyHash: string } {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    
    switch (network.toLowerCase()) {
      case 'solana':
        return {
          address: `Sol${timestamp}${random}`.substring(0, 44), // Solana addresses are ~44 chars
          publicKey: `pk_${timestamp}_${random}`,
          privateKeyHash: `enc_${timestamp}_${random}_hash` // In production: encrypted private key
        };
      case 'bitcoin':
        return {
          address: `1BTC${timestamp}${random}`.substring(0, 34), // Bitcoin addresses are ~34 chars
          publicKey: `pk_${timestamp}_${random}`,
          privateKeyHash: `enc_${timestamp}_${random}_hash`
        };
      case 'ethereum':
        return {
          address: `0x${timestamp}${random}`.substring(0, 42), // Ethereum addresses are 42 chars
          publicKey: `pk_${timestamp}_${random}`,
          privateKeyHash: `enc_${timestamp}_${random}_hash`
        };
      default:
        return {
          address: `${network}_${timestamp}_${random}`,
          publicKey: `pk_${timestamp}_${random}`,
          privateKeyHash: `enc_${timestamp}_${random}_hash`
        };
    }
  }

  /**
   * Create a wallet for a user for a specific currency
   */
  async createUserWallet(userId: string, currencySymbol: string): Promise<UserWallet> {
    const currency = await storage.getSupportedCurrencyBySymbol(currencySymbol);
    if (!currency) {
      throw new Error(`Currency ${currencySymbol} not supported`);
    }

    // Check if wallet already exists
    const existingWallet = await storage.getUserWallet(userId, currency.id);
    if (existingWallet) {
      return existingWallet;
    }

    // Generate wallet address
    const walletData = this.generateWalletAddress(currency.network);

    const walletInsert: InsertUserWallet = {
      userId,
      currencyId: currency.id,
      walletAddress: walletData.address,
      publicKey: walletData.publicKey,
      privateKeyHash: walletData.privateKeyHash,
      balance: '0.00000000',
      isActive: true,
      walletType: 'custodial',
      metadata: {
        network: currency.network,
        currencySymbol: currency.symbol,
        createdBy: 'system',
        derivationPath: null // For HD wallets in production
      }
    };

    const wallet = await storage.createUserWallet(walletInsert);
    console.log(`✅ Created ${currencySymbol} wallet for user ${userId}: ${walletData.address}`);
    
    return wallet;
  }

  /**
   * Create wallets for all supported currencies for a new user
   */
  async createAllWalletsForUser(userId: string): Promise<UserWallet[]> {
    const currencies = await storage.getSupportedCurrencies();
    const wallets: UserWallet[] = [];

    for (const currency of currencies.filter(c => c.isActive)) {
      try {
        const wallet = await this.createUserWallet(userId, currency.symbol);
        wallets.push(wallet);
      } catch (error) {
        console.error(`Failed to create ${currency.symbol} wallet for user ${userId}:`, error);
      }
    }

    return wallets;
  }

  /**
   * Get all wallets for a user
   */
  async getUserWallets(userId: string): Promise<(UserWallet & { currency: SupportedCurrency })[]> {
    return await storage.getUserWalletsWithCurrency(userId);
  }

  /**
   * Get wallet balance for a specific currency
   */
  async getWalletBalance(userId: string, currencySymbol: string): Promise<{ balance: string; currency: SupportedCurrency } | null> {
    const currency = await storage.getSupportedCurrencyBySymbol(currencySymbol);
    if (!currency) return null;

    const wallet = await storage.getUserWallet(userId, currency.id);
    if (!wallet) return null;

    return {
      balance: wallet.balance,
      currency
    };
  }

  /**
   * Record a wallet transaction (deposit, withdrawal, reward, etc.)
   */
  async recordTransaction(
    userWalletId: string,
    transactionType: 'deposit' | 'withdrawal' | 'reward' | 'transfer',
    amount: string,
    metadata?: any
  ): Promise<WalletTransaction> {
    const wallet = await storage.getUserWalletById(userWalletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const currentBalance = parseFloat(wallet.balance);
    const transactionAmount = parseFloat(amount);
    
    // Calculate new balance
    let newBalance: number;
    if (transactionType === 'deposit' || transactionType === 'reward') {
      newBalance = currentBalance + transactionAmount;
    } else {
      newBalance = currentBalance - transactionAmount;
      if (newBalance < 0) {
        throw new Error('Insufficient balance');
      }
    }

    const transactionInsert: InsertWalletTransaction = {
      userWalletId,
      transactionType,
      amount,
      balanceAfter: newBalance.toFixed(8),
      status: 'confirmed',
      confirmations: 1,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    };

    // Create transaction and update wallet balance atomically
    const transaction = await storage.createWalletTransaction(transactionInsert);
    await storage.updateUserWalletBalance(userWalletId, newBalance.toFixed(8));

    return transaction;
  }

  /**
   * Transfer tokens between internal wallets
   */
  async internalTransfer(
    fromUserId: string,
    toUserId: string,
    currencySymbol: string,
    amount: string,
    note?: string
  ): Promise<{ sent: WalletTransaction; received: WalletTransaction }> {
    const currency = await storage.getSupportedCurrencyBySymbol(currencySymbol);
    if (!currency) {
      throw new Error(`Currency ${currencySymbol} not supported`);
    }

    const fromWallet = await storage.getUserWallet(fromUserId, currency.id);
    const toWallet = await storage.getUserWallet(toUserId, currency.id);

    if (!fromWallet || !toWallet) {
      throw new Error('One or both wallets not found');
    }

    // Record outgoing transaction
    const sentTx = await this.recordTransaction(
      fromWallet.id,
      'transfer',
      amount,
      {
        transferType: 'outgoing',
        recipientUserId: toUserId,
        recipientWalletId: toWallet.id,
        note
      }
    );

    // Record incoming transaction
    const receivedTx = await this.recordTransaction(
      toWallet.id,
      'transfer',
      amount,
      {
        transferType: 'incoming',
        senderUserId: fromUserId,
        senderWalletId: fromWallet.id,
        note,
        relatedTransactionId: sentTx.id
      }
    );

    return { sent: sentTx, received: receivedTx };
  }
}

export const walletService = new WalletService();

// Initialize default currencies on service startup
walletService.initializeDefaultCurrencies().catch(console.error);