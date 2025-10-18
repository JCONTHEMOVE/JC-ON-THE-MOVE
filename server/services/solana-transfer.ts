import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import { 
  getOrCreateAssociatedTokenAccount, 
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

/**
 * Solana Token Transfer Service
 * Handles sending JCMOVES tokens to external Solana wallet addresses
 */
export class SolanaTransferService {
  private connection: Connection;
  private treasuryKeypair: Keypair;
  private jcmovesTokenMint: PublicKey;

  constructor() {
    const rpcUrl = process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    
    // Initialize treasury wallet keypair from private key
    const privateKey = process.env.TREASURY_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('TREASURY_WALLET_PRIVATE_KEY not found in environment variables');
    }
    
    try {
      // Decode base58 private key
      const decodedKey = bs58.decode(privateKey);
      this.treasuryKeypair = Keypair.fromSecretKey(decodedKey);
    } catch (error) {
      console.error('Failed to initialize treasury keypair:', error);
      throw new Error('Invalid treasury private key format');
    }

    // JCMOVES token mint address
    const tokenAddress = process.env.MOONSHOT_TOKEN_ADDRESS || 'AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp';
    this.jcmovesTokenMint = new PublicKey(tokenAddress);
  }

  /**
   * Send JCMOVES tokens to an external Solana wallet address
   * @param toAddress - Recipient's Solana wallet address
   * @param amount - Amount of tokens to send (in base units)
   * @returns Transaction signature
   */
  async sendTokens(toAddress: string, amount: number): Promise<string> {
    try {
      console.log(`🚀 Initiating token transfer:`);
      console.log(`   To: ${toAddress}`);
      console.log(`   Amount: ${amount.toLocaleString()} JCMOVES`);

      // Validate recipient address
      let recipientPublicKey: PublicKey;
      try {
        recipientPublicKey = new PublicKey(toAddress);
      } catch (error) {
        throw new Error('Invalid recipient wallet address');
      }

      // Get or create treasury's token account
      const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.treasuryKeypair,
        this.jcmovesTokenMint,
        this.treasuryKeypair.publicKey
      );

      console.log(`   Treasury token account: ${treasuryTokenAccount.address.toString()}`);

      // Check treasury balance
      const treasuryBalance = Number(treasuryTokenAccount.amount);
      const amountInBaseUnits = Math.floor(amount * 1_000_000); // Convert to base units (6 decimals)

      if (treasuryBalance < amountInBaseUnits) {
        throw new Error(`Insufficient treasury balance. Required: ${amountInBaseUnits}, Available: ${treasuryBalance}`);
      }

      // Get or create recipient's token account
      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.treasuryKeypair, // Payer for account creation
        this.jcmovesTokenMint,
        recipientPublicKey
      );

      console.log(`   Recipient token account: ${recipientTokenAccount.address.toString()}`);

      // Create transfer instruction
      const transaction = new Transaction().add(
        createTransferInstruction(
          treasuryTokenAccount.address, // Source
          recipientTokenAccount.address, // Destination
          this.treasuryKeypair.publicKey, // Owner of source account
          amountInBaseUnits, // Amount in base units
          [], // Multi-signers (none)
          TOKEN_PROGRAM_ID
        )
      );

      // Send and confirm transaction
      console.log(`   Sending transaction...`);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.treasuryKeypair],
        {
          commitment: 'confirmed',
          maxRetries: 3
        }
      );

      console.log(`✅ Token transfer successful!`);
      console.log(`   Signature: ${signature}`);
      console.log(`   Explorer: https://solscan.io/tx/${signature}`);

      return signature;
    } catch (error: any) {
      console.error('❌ Token transfer failed:', error);
      throw new Error(`Token transfer failed: ${error.message}`);
    }
  }

  /**
   * Get treasury token balance
   * @returns Current JCMOVES balance in treasury wallet
   */
  async getTreasuryBalance(): Promise<number> {
    try {
      const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.treasuryKeypair,
        this.jcmovesTokenMint,
        this.treasuryKeypair.publicKey
      );

      const balance = Number(treasuryTokenAccount.amount) / 1_000_000; // Convert from base units
      return balance;
    } catch (error) {
      console.error('Failed to get treasury balance:', error);
      return 0;
    }
  }

  /**
   * Validate a Solana wallet address
   * @param address - Address to validate
   * @returns True if valid, false otherwise
   */
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get treasury wallet public key
   */
  getTreasuryAddress(): string {
    return this.treasuryKeypair.publicKey.toString();
  }
}

// Singleton instance
export const solanaTransferService = new SolanaTransferService();
