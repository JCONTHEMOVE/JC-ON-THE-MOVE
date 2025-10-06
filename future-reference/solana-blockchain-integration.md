# Solana Blockchain Integration Guide

## Overview
Instructions for linking the JC ON THE MOVE application to the Solana blockchain for cryptocurrency functionality and smart contract integration.

## Prerequisites
To link your application to the Solana blockchain, you will need to use Solana's Wallet Adapter for web applications to allow users to connect their wallets, or an RPC endpoint provided by services like Alchemy to interact with the blockchain programmatically. The core steps involve setting up your development environment, integrating the Wallet Adapter library into your frontend, and then using the adapter to handle user wallet connections and transaction signing.

## 1. Set Up Your Development Environment

### Choose a Developer Platform
- Sign up for an account on a developer platform like **Alchemy** to get access to an API Key and an RPC URL for connecting to the Solana blockchain.

### Select a Network
- Use **Solana Devnet** or **Testnet** to test your programs and interact with a test network before deploying to the mainnet.

## 2. Integrate Solana's Wallet Adapter

### Install Libraries
Add the necessary Wallet Adapter packages to your project. For React applications, you'll need:
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui` (for UI components)

### Configure the Adapter
Set up the Wallet Adapter in your frontend application to provide users with options to connect their wallets.

## 3. Handle User Connections and Transactions

### Implement Wallet Connections
- Use the components provided by the Wallet Adapter to allow users to connect their chosen wallets to your application.

### Sign Transactions
- The Wallet Adapter handles the secure communication with the user's wallet, ensuring they never need to expose their secret key to your application when signing transactions.

## 4. Write and Deploy Programs (Smart Contracts)

### Write in Rust
- Develop your programs, or smart contracts, on Solana using **Rust**.

### Test Thoroughly
- Use **Anchor**, a framework that facilitates building and interacting with Solana programs
- Write tests to ensure your programs function as expected.

### Deploy to the Network
- Test your programs on the **Devnet** or **Testnet** before deploying to the Solana mainnet.

## Security Considerations
- Never expose private keys or secret keys in your application
- Use environment variables for API keys and RPC endpoints
- Implement proper error handling for blockchain transactions
- Test all smart contracts thoroughly before mainnet deployment

## Resources
- Solana Documentation: https://docs.solana.com
- Wallet Adapter: https://github.com/solana-labs/wallet-adapter
- Anchor Framework: https://www.anchor-lang.com
- Alchemy Solana API: https://www.alchemy.com/solana

---

## Part 2: System-Generated Wallet Addresses on Solana

Yes, you can use system-generated wallet addresses on the Solana blockchain by using the Solana command-line tools to generate a new keypair, which produces a public address and private key. Users can access this system-generated address through programs like MetaMask or dedicated Solana wallets such as Phantom, allowing them to interact with the Solana network, hold assets, and sign transactions.

### How to Create a System-Generated Solana Wallet

#### 1. Install the Solana Tool Suite
Download and install the Solana command-line interface (CLI) tools.

#### 2. Generate a Keypair
Use the command `solana-keygen new --outfile ~/my-keypair.json` to create a new keypair and save it to a file. This command will output a public key (the wallet address) and a private key.

#### 3. Access the Wallet

**File System Wallet:** Use the my-keypair.json file to sign transactions and access your account balance.

**Dedicated Solana Wallets:** Import the keypair or seed phrase into a browser-based wallet like Phantom to manage your account within the wallet interface.

**MetaMask:** For users familiar with MetaMask, it can be configured to interact with the Solana network by creating a new Solana account using an existing seed phrase.

### Key Concepts

**Keypair:** A private key and its corresponding public key. The public key is the wallet address you share, while the private key is used to sign transactions and authorize access to your funds.

**Seed Phrase:** A series of words that can be used to derive your private key and wallet address.

**Program Derived Addresses (PDAs):** Another type of address that is not directly controlled by a user's private key but is derived from a seed and a specific program. While these are system-generated, they have different purposes than user-controlled wallets.

### Treasury Transfer Data (For Future Blockchain Migration)

**Current Simulated Custodial Wallet System:**
- **JCMOVES Wallet Address:** `34e5eAwb6Eh6zgyARSrk7RX1bkK2rVX5bazCHYXKtRM7`
- **Total JCMOVES Received:** 3,289,590.39 tokens
- **Total JCMOVES Withdrawn to Treasury:** 3,190,131 tokens
- **Current Personal Balance:** 99,459.39 JCMOVES
- **Treasury Token Reserve:** 5,698,818 JCMOVES

**Important:** These transfers need to be replicated on the real Solana blockchain when transitioning from the simulated custodial system to actual blockchain wallets. The treasury funding transactions must be properly recorded on-chain to maintain accurate accounting.

---
*Last Updated: October 6, 2025*
