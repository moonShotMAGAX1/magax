# Multi-Sig Setup Guide for MAGAX Presale

## Overview

This guide outlines the multi-sig wallet setup for maximum security in the MAGAX presale system.

## Required Multi-Sig Wallets

### 1. Core Team Multi-Sig (3-of-5)

**Purpose**: Primary governance and treasury management

**Threshold**: 3 signatures required out of 5 signers

**Signers**:

- Founder/CEO
- CTO/Technical Lead
- CFO/Financial Lead
- Community Manager  
- External Legal/Security Advisor

**Used For**:

- Timelock proposer role
- Treasury address
- Emergency multi-sig backup

### 2. Operations Multi-Sig (2-of-3)

**Purpose**: Day-to-day operational decisions
**Threshold**: 2 signatures required out of 3 signers

**Signers**:

- Operations Lead
- Technical Lead
- Community Manager

**Used For**:

- Timelock executor role
- Emergency response coordination

## Address Assignment

```javascript
// In your .env file
TREASURY_ADDRESS=0x...CoreTeamMultiSig          // 3-of-5 multi-sig
TIMELOCK_PROPOSERS=0x...CoreTeamMultiSig,0x...OperationsMultiSig
TIMELOCK_EXECUTORS=0x...OperationsMultiSig,0x...CoreTeamMultiSig

// Single EOAs for operational efficiency
RECORDER_ADDRESS=0x...HardwareWalletEOA         // For Go backend
STAGE_MANAGER_ADDRESS=0x...HardwareWalletEOA    // For stage management
```

## Multi-Sig Creation Process

### Using Gnosis Safe:

1. **Create Multi-Sig Wallet**:
   ```
   - Go to app.safe.global
   - Connect wallet of first signer
   - Choose "Create new Safe"
   - Add all signer addresses
   - Set threshold (e.g., 3-of-5)
   - Deploy multi-sig contract
   ```

2. **Share Multi-Sig Address**:
   ```
   - Copy deployed multi-sig address
   - Share with all signers
   - Each signer adds wallet to their Safe app
   - Test with small transaction first
   ```

3. **Transaction Flow**:
   ```
   Signer 1: Proposes transaction
   Signer 2: Reviews and approves
   Signer 3: Reviews and approves (threshold met)
   Transaction: Auto-executes
   ```

## Security Best Practices

### Signer Distribution:

- **Geographic**: Spread signers across different locations
- **Technical**: Mix technical and non-technical signers
- **Independence**: Ensure signers are independent entities
- **Backup**: Have backup signers for critical roles

### Key Management:

- **Hardware Wallets**: All signers use hardware wallets (Ledger/Trezor)
- **Seed Phrase Security**: Store seed phrases in bank safety deposit boxes
- **Regular Audits**: Review signer list quarterly
- **Emergency Procedures**: Document emergency signer replacement process

### Transaction Verification:

- **Simulation**: Use simulation tools before signing
- **Documentation**: Require detailed transaction descriptions
- **Review Period**: Implement 24-hour review period for large transactions
- **Communication**: Use secure channels for coordination

## Emergency Procedures

### Compromised Signer:

1. Immediately create proposal to remove compromised signer
2. Add replacement signer address
3. Execute change with remaining signers
4. Update all documentation

### Lost Hardware Wallet:

1. Signer reports loss immediately
2. Use seed phrase to recover on new device
3. Consider rotating to new address for security

### Critical Emergency Response:

1. Use emergency multi-sig for immediate response
2. Coordinate through secure communication channels
3. Document all emergency actions taken
4. Review and improve procedures post-incident

## Testing Protocol

### Before Production:

1. **Testnet Testing**:
   - Deploy multi-sig on testnet
   - Test all transaction types
   - Verify all signers can participate
   - Practice emergency procedures

2. **Small Value Testing**:
   - Start with small transactions on mainnet
   - Verify transaction flow works correctly
   - Confirm all signers understand process

3. **Documentation Review**:
   - All signers review and confirm procedures
   - Emergency contact information verified
   - Backup procedures tested

## Monitoring and Maintenance

### Regular Reviews:

- **Monthly**: Review pending transactions
- **Quarterly**: Audit signer list and permissions
- **Annually**: Full security review and procedure update

### Monitoring Tools:

- Set up alerts for multi-sig transactions
- Monitor for unusual activity patterns
- Track transaction approval times
- Maintain activity logs

## Cost Considerations

### Multi-Sig Costs:

- **Creation**: ~$50-200 in gas fees
- **Transactions**: 2-3x normal gas costs
- **Maintenance**: Minimal ongoing costs

### ROI Analysis:

- Security benefits far outweigh costs
- Prevents single point of failure
- Builds community trust
- Required for institutional investment

This multi-sig setup provides enterprise-grade security while maintaining operational efficiency for the MAGAX presale system.
