# Future Plans: Real Solana Blockchain Integration

## Overview
Upgrade the JC ON THE MOVE application from simulated wallet balances to real Solana blockchain integration with JCMOVES as an actual SPL token deployed via Moonshot app.

## Current Status
- ✅ JCMOVES token deployed on Solana via Moonshot app
- ✅ Simulated custodial wallets with generated addresses
- ✅ Database-tracked balances for JCMOVES, SOL, BTC, ETH
- ✅ FaucetPay API integration for faucet functionality
- ⚠️ Moonshot API integration (currently 404 errors for token BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon)

## Goal
Transform the wallet system to enable:
- Real deposits: Users send JCMOVES from external wallets (Phantom, Solflare) to their app wallet address
- Real withdrawals: Users send JCMOVES from app wallet to external addresses
- Auto-detection of incoming blockchain transactions
- Integration with Moonshot for liquidity and real-time pricing
- Blockchain explorer links for transaction verification

---

## Implementation Plan

### Phase 1: Core Blockchain Functionality

#### 1.1 Wallet Management (Custodial Architecture)
**Approach**: Custodial wallet service with secure key management

**Components**:
- Solana key-management microservice backed by HSM or KMS (AWS KMS or HashiCorp Vault)
- Per-user associated token accounts for the SPL JCMOVES mint
- Server-side transaction signing only (keys never exposed to client)
- Migration path to non-custodial export if needed later

**Security**:
- Encrypted-at-rest key storage
- Scoped service roles with minimal permissions
- Isolated signer service from public API
- Rate limiting on all wallet operations
- Withdrawal approvals/2FA for large amounts
- Continuous monitoring for anomalous flows
- Dependency integrity audits

#### 1.2 Solana Blockchain Integration
**Setup Requirements**:
- Service account that owns the JCMOVES SPL mint on mainnet
- Solana Web3.js SDK for backend operations
- RPC provider: Helius, Triton, QuickNode, or Moonshot's endpoint
- Commitment levels: `confirmed` for balance reads, `finalized` for payouts

**Core Operations**:
- Mint authority management
- Token account creation for new users
- Transaction crafting and signing
- Balance querying and reconciliation

#### 1.3 Transaction Monitoring
**Deposit Detection**:
- Subscribe to RPC provider webhooks/websockets
- Poll with `signaturesForAddress` for inbound transfers
- Persist pending transaction states
- Confirm after required block commitment (finalized)
- Capture metadata: signature, slot, source address, timestamp

**Transaction Flow**:
1. User sends JCMOVES from external wallet → app wallet address
2. Webhook/polling detects pending transaction
3. System creates pending deposit record in database
4. Wait for finalized commitment (~32 slots, ~15 seconds)
5. Update user balance and mark transaction as confirmed
6. Display in transaction history with Solscan/Solana Explorer link

#### 1.4 Deposit UI/UX
**Replace Current Manual Logging**:
- Remove "Record Deposit" form
- Show wallet address prominently with QR code
- Add "Copy Address" button with clipboard functionality
- Display instructions: "Send JCMOVES to this address"
- Show pending deposits with confirmation progress
- Real-time balance updates when deposits confirm

**Features**:
- QR code generation for wallet address
- Address verification (checksums)
- Recent transaction list from blockchain
- Blockchain explorer integration (Solscan links)

#### 1.5 Withdrawal (Send) Functionality
**New Send Dialog**:
- Recipient Solana address input with validation
- Amount input with:
  - Balance validation (can't send more than you have)
  - Maximum button (send all)
  - Minimum amount checks
- Network fee display (SOL cost for transaction)
- Estimated total deduction
- Confirmation step with summary

**Backend Process**:
1. Validate recipient address format
2. Check user has sufficient balance + network fee
3. Create and sign transaction server-side
4. Broadcast to Solana network
5. Deduct balance immediately (pending)
6. Monitor for confirmation
7. Update status and create transaction record
8. Handle failures/reversals if needed

**Transaction Record**:
- Store: recipient address, amount, network fee, transaction signature
- Status: pending → confirmed / failed
- Link to blockchain explorer
- Timestamp of initiation and confirmation

---

### Phase 2: Moonshot Integration

#### 2.1 API Configuration
**Required Information**:
- Correct JCMOVES SPL token mint address (current: BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon - needs verification)
- Moonshot API credentials/keys
- Valid API endpoints for:
  - Token pricing
  - Liquidity data
  - Trading/swap functionality

#### 2.2 Pricing Integration
- Real-time JCMOVES price feeds from Moonshot
- Display USD value of holdings
- Price charts and historical data
- Market cap and liquidity stats

#### 2.3 Liquidity & Trading
- Integration with Moonshot's liquidity pools
- Enable token swaps through Moonshot platform
- Bridge withdrawal requests into Moonshot accounts
- Fee management and optimization

#### 2.4 Fix Current 404 Errors
- Validate actual Moonshot token address
- Confirm correct API paths
- Test API authentication
- Handle API rate limits gracefully

---

### Phase 3: Advanced Features

#### 3.1 Non-Custodial Export
- Allow users to export their private keys
- Secure export process with warnings
- Migration guide to external wallets
- Backup/recovery procedures

#### 3.2 Multi-Currency Support
- Extend real blockchain functionality to SOL, BTC, ETH
- Multi-signature withdrawals for enhanced security
- Cross-chain bridging if needed

#### 3.3 Enhanced Security
- KYC/AML compliance for larger transactions
- Withdrawal limits and velocity checks
- Suspicious activity detection
- Insurance/loss protection considerations

---

## Technical Architecture

### Backend Services

#### Wallet Service (`server/services/wallet.ts`)
**New Methods**:
- `createSolanaWallet(userId)` - Generate new keypair and token account
- `getWalletBalance(address)` - Query real blockchain balance
- `sendTokens(fromWallet, toAddress, amount)` - Create and broadcast transaction
- `monitorDeposits(walletAddress)` - Subscribe to incoming transactions
- `syncBlockchainBalance(userId)` - Reconcile database with blockchain

#### Transaction Monitor Service (New)
**Responsibilities**:
- Poll/subscribe to RPC for new transactions
- Maintain transaction confirmation queue
- Update database on confirmations
- Handle reorgs and failed transactions
- Retry logic for network issues

#### Key Management Service (New)
**Security Layer**:
- Interface with KMS/vault for key operations
- Sign transactions without exposing keys
- Key rotation and backup procedures
- Audit logging of all key usage

### Database Schema Updates

#### user_wallets table
**Add columns**:
- `blockchain_synced_at` - Last time balance verified on-chain
- `pending_deposits` - JSON array of unconfirmed deposits
- `derivation_path` - HD wallet derivation path
- `encryption_version` - Track key encryption method

#### wallet_transactions table
**Already has required fields**:
- `transaction_hash` - Blockchain transaction signature
- `from_address` - Sender address
- `to_address` - Recipient address
- `network_fee` - SOL fee paid
- `block_number` - Block height
- `confirmations` - Number of confirmations
- `confirmed_at` - Timestamp of finalization

### Frontend Updates

#### Wallets Page
**Deposit Section**:
- Replace manual form with address display
- QR code component
- Copy button with toast notification
- "Check for Deposits" refresh button
- Pending deposits list with progress

**Send Section**:
- New send dialog component
- Address input with validation
- Amount selector with balance check
- Fee estimation display
- Transaction confirmation modal
- Success/error handling

**Transaction History**:
- Real-time updates from blockchain
- Status badges (pending/confirmed/failed)
- Explorer links (Solscan)
- Filter by type (deposit/withdrawal)
- Export transaction history

---

## Infrastructure Requirements

### RPC Provider
**Options**:
- Helius (recommended, $49-299/month)
- QuickNode ($49-999/month)
- Triton ($40-2000/month)
- Public RPC (free but rate limited)

**Features Needed**:
- Websocket support for real-time monitoring
- High request limits (10k-100k+ per day)
- Enhanced APIs for token account queries
- Transaction simulation
- Archive node access for history

### Key Management
**Options**:
- AWS KMS (~$1-5/month + usage)
- HashiCorp Vault (self-hosted or cloud)
- Google Cloud KMS
- Azure Key Vault

**Requirements**:
- Hardware security module (HSM) backing
- Encryption at rest
- Access control and audit logs
- Automatic key rotation
- Disaster recovery/backup

### Environment Variables Needed
```
SOLANA_RPC_URL=https://...
SOLANA_NETWORK=mainnet-beta
JCMOVES_MINT_ADDRESS=...
MASTER_WALLET_PRIVATE_KEY=encrypted...
KMS_KEY_ID=...
MOONSHOT_API_KEY=...
MOONSHOT_API_URL=...
```

---

## Cost Estimates

### Monthly Infrastructure
- RPC Provider: $50-300/month
- Key Management: $5-50/month
- Monitoring/Alerting: $10-30/month
- **Total**: ~$65-380/month

### Transaction Costs
- Solana transaction fee: ~$0.00025 per transaction
- Expected volume: 1000 transactions/month = $0.25
- Negligible compared to infrastructure

### Development Time
- Phase 1: 2-3 weeks (core blockchain integration)
- Phase 2: 1-2 weeks (Moonshot integration)
- Phase 3: 2-3 weeks (advanced features)
- **Total**: ~5-8 weeks for complete implementation

---

## Next Steps & Required Information

### Immediate Needs
1. **JCMOVES Token Details**:
   - Correct SPL token mint address
   - Token decimals (usually 9 for Solana)
   - Total supply and circulation
   - Moonshot dashboard access

2. **API Access**:
   - Moonshot API credentials
   - Confirmed API endpoint URLs
   - Rate limits and usage quotas

3. **Infrastructure Decisions**:
   - Choose RPC provider (Helius recommended)
   - Select key management solution (AWS KMS for simplicity)
   - Set up accounts and credentials

4. **Compliance Planning**:
   - KYC/AML requirements based on jurisdiction
   - Withdrawal limits policy
   - Terms of service updates for real money handling

### Implementation Checklist

#### Week 1-2: Foundation
- [ ] Set up RPC provider account
- [ ] Configure key management system
- [ ] Create wallet service with Solana Web3.js
- [ ] Implement wallet generation and storage
- [ ] Test deposit monitoring on devnet

#### Week 3-4: Core Features
- [ ] Implement transaction monitoring service
- [ ] Build withdrawal/send functionality
- [ ] Update frontend deposit UI
- [ ] Create send dialog component
- [ ] Add transaction history from blockchain

#### Week 5-6: Moonshot Integration
- [ ] Fix Moonshot API connection
- [ ] Integrate real-time pricing
- [ ] Add liquidity data display
- [ ] Test end-to-end flows

#### Week 7-8: Testing & Launch
- [ ] Security audit
- [ ] Load testing
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Gradual rollout to users

---

## Risk Mitigation

### Technical Risks
- **Private key compromise**: Use HSM, regular security audits
- **RPC provider downtime**: Implement fallback providers
- **Transaction failures**: Retry logic and clear error messages
- **Balance inconsistencies**: Regular reconciliation jobs

### Business Risks
- **Regulatory compliance**: Consult legal counsel, implement KYC
- **User losses**: Insurance, clear ToS, educational materials
- **Liquidity issues**: Monitor Moonshot pool depth
- **Cost overruns**: Set budgets, monitor usage closely

### Operational Risks
- **Support burden**: Comprehensive documentation, automated responses
- **Scaling challenges**: Horizontal scaling of monitoring services
- **Recovery procedures**: Regular backups, tested disaster recovery

---

## Success Metrics

### Technical KPIs
- Transaction confirmation time: < 30 seconds average
- Deposit detection latency: < 15 seconds
- System uptime: > 99.9%
- Failed transaction rate: < 0.1%

### Business KPIs
- Daily active wallets
- Total transaction volume
- User retention after blockchain migration
- Support ticket volume related to wallet issues

### User Experience KPIs
- Time to complete first deposit: < 2 minutes
- Withdrawal success rate: > 99%
- User satisfaction score: > 4.5/5

---

## Documentation Needs

### User Documentation
- How to deposit JCMOVES
- How to withdraw/send JCMOVES
- Understanding transaction fees
- Security best practices
- Troubleshooting guide

### Developer Documentation
- Wallet service API reference
- Transaction monitoring architecture
- Key management procedures
- Deployment guide
- Incident response playbook

---

## Notes from Architecture Review

**Recommended Approach**: Custodial wallet service with managed key custody, Moonshot liquidity hooks, and on-chain monitoring to deliver real JCMOVES deposits and withdrawals.

**Key Decisions**:
- Custodial approach chosen over non-custodial for better UX in v1
- Migration path to non-custodial export preserved for future
- Server-side signing eliminates client-side key management complexity
- Phased rollout reduces risk and allows iterative improvement

**Security Priority**: Private key protection is paramount - use HSM/KMS, never log keys, implement comprehensive audit trail, and isolate signing service from public API.

---

## Conclusion

This migration from simulated to real blockchain wallets represents a significant upgrade that will:
- Legitimize the JCMOVES token economy
- Enable real trading and value creation
- Improve user trust and engagement
- Open doors to DeFi integrations
- Position the platform for future growth

The phased approach allows for careful implementation and testing at each stage while maintaining existing functionality until blockchain features are proven stable.

**Status**: Ready to begin implementation pending confirmation of:
1. JCMOVES mint address
2. Moonshot API access
3. RPC provider selection
4. Key management infrastructure choice
