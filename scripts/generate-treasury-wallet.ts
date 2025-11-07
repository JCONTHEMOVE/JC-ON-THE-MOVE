import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

console.log("\n🔐 GENERATING NEW SOLANA TREASURY WALLET\n");
console.log("=" .repeat(80));

// Generate new keypair
const keypair = Keypair.generate();

// Get public key
const publicKey = keypair.publicKey.toBase58();

// Get private key in base58 format (easier to store)
const privateKeyBase58 = bs58.encode(keypair.secretKey);

// Get private key as byte array (alternative format)
const privateKeyArray = Array.from(keypair.secretKey);

console.log("\n✅ Treasury Wallet Generated Successfully!\n");
console.log("PUBLIC KEY (Wallet Address):");
console.log(publicKey);
console.log("\n" + "=".repeat(80));
console.log("\n🔑 PRIVATE KEY (KEEP THIS SECRET!):");
console.log(privateKeyBase58);
console.log("\n" + "=".repeat(80));

console.log("\n📋 NEXT STEPS:\n");
console.log("1. Save these keys SECURELY - you'll need them!\n");
console.log("2. Add to Replit Secrets:");
console.log("   - Key: TREASURY_WALLET_PUBLIC_KEY");
console.log(`   - Value: ${publicKey}`);
console.log("\n   - Key: TREASURY_WALLET_PRIVATE_KEY");
console.log(`   - Value: ${privateKeyBase58}`);
console.log("\n3. Fund this wallet with SOL (for transaction fees)");
console.log("   and your JCMOVES tokens (for employee rewards)\n");
console.log("4. IMPORTANT: Never share the private key with anyone!");
console.log("   This key controls all funds in the wallet.\n");
console.log("=" .repeat(80));

// Also save to a file for backup (user should delete this after saving to secrets)
const walletData = {
  publicKey,
  privateKeyBase58,
  privateKeyArray,
  warning: "DELETE THIS FILE after copying keys to Replit Secrets!",
  generated: new Date().toISOString()
};

// Note: We're NOT actually writing the file to prevent accidental commits
console.log("\n💡 TIP: Copy the private key above and paste it into Replit Secrets");
console.log("   Do NOT save it anywhere else or commit it to git!\n");
