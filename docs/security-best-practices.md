# Security Best Practices for MAGAX Project

## Address Separation Strategy

### Overview

The MAGAX project uses separate addresses for different roles to minimize security risks and follow the principle of least privilege.

### Address Roles

#### 1. Treasury Address (Token Holder)

- **Purpose**: Holds the initial token supply
- **Visibility**: Public on blockchain explorers
- **Security Level**: Highest (recommended multi-sig)
- **Permissions**: Token ownership, no contract admin rights

**Production Recommendations:**

- Use 3-of-5 multi-signature wallet (Gnosis Safe)
- Hardware wallet signers
- Geographically distributed signers
- Regular security audits

#### 2. Recorder Address (Backend Service)

- **Purpose**: Records presale purchases on-chain
- **Visibility**: Public on blockchain explorers  
- **Security Level**: Medium (dedicated service wallet)
- **Permissions**: RECORDER_ROLE only

**Security Measures:**

- Dedicated wallet for backend service
- Environment variable storage
- Regular key rotation
- Monitoring for unusual activity
- No access to treasury funds

#### 3. Admin Address (Contract Management)

- **Purpose**: Contract administration and emergency functions
- **Security Level**: Highest (recommended multi-sig)
- **Permissions**: Contract admin functions, pause/unpause

#### 4. Deployer Address (Deployment Only)

- **Purpose**: One-time contract deployment
- **Security Level**: Medium
- **Permissions**: Deployment only, admin rights transferred

## Environment Configuration

### Development (.env for local testing)

```bash
# Deployment Configuration
DEPLOYER_PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...

# Use test addresses for development
TREASURY_ADDRESS=0xYourTestTreasuryAddress
RECORDER_ADDRESS=0xYourTestRecorderAddress
ADMIN_ADDRESS=0xYourTestAdminAddress
```

### Production (GitHub Secrets)

```bash
# Separate keys for different networks
SEPOLIA_DEPLOYER_PRIVATE_KEY=0x...
MAINNET_DEPLOYER_PRIVATE_KEY=0x...

# Production addresses (should be multi-sig)
TREASURY_ADDRESS=0xMultiSigTreasuryAddress
RECORDER_ADDRESS=0xDedicatedBackendWallet
ADMIN_ADDRESS=0xMultiSigAdminAddress
```

## Security Validation Checklist

### Pre-Deployment

- [ ] All addresses are different
- [ ] Private keys stored securely
- [ ] Multi-sig wallets configured (mainnet)
- [ ] Test deployment on testnet
- [ ] Security audit completed (mainnet)

### Post-Deployment

- [ ] Verify correct role assignments
- [ ] Test role permissions
- [ ] Set up monitoring alerts
- [ ] Document emergency procedures
- [ ] Transfer admin rights if needed

## Multi-Signature Setup

### For Treasury (Mainnet)

1. **Create Gnosis Safe**
   - 3-of-5 signers recommended
   - Use hardware wallets
   - Distribute signers geographically

2. **Signer Distribution**
   - Core team members: 2-3 signers
   - Trusted advisors: 1-2 signers
   - Emergency backup: 1 signer

3. **Transaction Policy**
   - Require 3 confirmations for token transfers
   - Time delays for large transactions
   - Emergency procedures documented

### For Admin Functions

1. **2-of-3 Multi-Sig**
   - Contract management
   - Emergency pause functions
   - Stage configuration

## Monitoring and Alerts

### Address Monitoring

- Set up alerts for large transactions
- Monitor for unusual activity patterns
- Track role assignments and changes

### Smart Contract Events

- Purchase recordings
- Role assignments/revocations
- Stage activations
- Emergency pauses

## Emergency Procedures

### If Recorder Address is Compromised

1. **Immediate Actions**

   ```bash
   # Revoke RECORDER_ROLE from compromised address
   await presaleContract.revokeRole(RECORDER_ROLE, compromisedAddress);
   
   # Grant role to new address
   await presaleContract.grantRole(RECORDER_ROLE, newBackendAddress);
   ```

2. **Investigation**
   - Review transaction history
   - Identify suspicious activities
   - Update backend configuration

3. **Recovery**
   - Deploy new backend service
   - Update environment variables
   - Resume operations

### If Treasury Address is Compromised

1. **Emergency Response**
   - Pause all contract operations
   - Contact multi-sig signers
   - Assess damage and exposure

2. **Recovery Planning**
   - Multi-sig replacement procedures
   - Token recovery strategies
   - Community communication

## Code Security Features

### Access Control

```solidity
// Role-based access control
bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

// Only specific roles can perform actions
modifier onlyRole(bytes32 role) {
    require(hasRole(role, msg.sender), "AccessControl: account missing role");
    _;
}
```

### Input Validation

```solidity
// Comprehensive input validation
require(amount > 0, "Amount must be greater than zero");
require(buyer != address(0), "Invalid buyer address");
require(stage > 0 && stage <= MAX_STAGES, "Invalid stage");
```

### Emergency Controls

```solidity
// Emergency pause functionality
function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
}

function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
}
```

## Risk Assessment Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Recorder key compromise | Medium | Low | Role revocation, key rotation |
| Treasury key compromise | Low | High | Multi-sig, hardware wallets |
| Smart contract bug | Low | High | Audits, testing, emergency pause |
| Frontend attack | Medium | Medium | Backend validation, monitoring |

## Regular Security Tasks

### Weekly

- [ ] Review transaction logs
- [ ] Check for unusual activities
- [ ] Verify system health

### Monthly

- [ ] Rotate recorder keys
- [ ] Review access permissions
- [ ] Update monitoring systems

### Quarterly

- [ ] Security audit review
- [ ] Emergency procedure testing
- [ ] Team security training

## Contact Information

### Security Team

- Primary Contact: [Security Lead Email]
- Emergency Contact: [24/7 Security Line]
- Multi-Sig Signers: [List of signer contacts]

### Incident Response

1. **Immediate**: Pause contracts if possible
2. **15 minutes**: Contact security team
3. **1 hour**: Assess damage and plan response
4. **24 hours**: Implement recovery procedures

---

*This document should be reviewed and updated regularly as the project evolves and new security threats emerge.*
