# MoonShot MAGAX Presale Documentation

Welcome to the comprehensive documentation for the MoonShot MAGAX presale system. This documentation covers the smart contracts, their functionality, and how to interact with them.

## 📚 Documentation Structure

- **[Contract Overview](./contract-overview.md)** - High-level overview of the presale system
- **[Stage Management](./stage-management.md)** - Detailed guide to the 50-stage presale system
- **[Function Reference](./function-reference.md)** - Complete API documentation
- **[Integration Guide](./integration-guide.md)** - How to integrate with the contracts
- **[Security Features](./security-features.md)** - Security mechanisms and best practices
- **[Event Reference](./event-reference.md)** - All contract events and their usage
- **[Error Reference](./error-reference.md)** - Custom errors and troubleshooting
- **[Deployment Guide](./deployment-guide.md)** - Complete deployment and setup instructions
- **[Quick Reference](./quick-reference.md)** - Common functions and code snippets

## 🚀 Quick Start

The MoonShot MAGAX presale system consists of two main contracts:

1. **MoonShotMAGAX** - The ERC-20 token contract
2. **MAGAXPresaleReceipts** - The presale receipt tracking contract

### Key Features

- **50-Stage Presale System** with different pricing tiers
- **Comprehensive Security** with purchase limits and duplicate prevention
- **On-Chain Receipt Tracking** for transparency and auditability
- **Admin Controls** for stage management and emergency functions
- **Gas Optimized** with custom errors and efficient storage patterns

### Basic Flow

1. **Setup**: Admin configures and activates presale stages
2. **Purchase Recording**: Backend service records user purchases via RECORDER_ROLE
3. **Receipt Tracking**: All purchases stored on-chain with stage and pricing info
4. **Stage Progression**: Admin manages transitions between pricing stages
5. **Analytics**: Real-time presale statistics and user purchase history

## 🔗 Contract Addresses

### Testnet (Sepolia)

- MoonShotMAGAX: `TBD`
- MAGAXPresaleReceipts: `TBD`

### Mainnet

- MoonShotMAGAX: `TBD`
- MAGAXPresaleReceipts: `TBD`

## 📝 License

This project is licensed under the MIT License.
