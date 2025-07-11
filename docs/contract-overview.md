# Contract Overview

## System Architecture

The MoonShot MAGAX presale system is built on two main smart contracts that work together to provide a secure, transparent, and efficient presale experience.

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Frontend/UI   │    │    Backend Service   │    │   Blockchain    │
│                 │    │                      │    │                 │
│ • User Purchase │◄──►│ • Purchase Processing│◄──►│ • Smart Contract│
│ • Receipt View  │    │ • Payment Validation │    │ • On-chain Data │
│ • Stage Info    │    │ • RECORDER_ROLE      │    │ • Events/Logs   │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## Contract Components

### 1. MoonShotMAGAX Token Contract

**Purpose**: Standard ERC-20 token with enhanced security features

**Key Features**:

- 1 Trillion token max supply
- Pausable transfers for emergency situations
- Burn functionality to reduce supply
- Owner-controlled minting restrictions

### 2. MAGAXPresaleReceipts Contract

**Purpose**: On-chain presale receipt tracking with 50-stage pricing system

**Key Features**:

- 50-stage presale with different pricing tiers
- Comprehensive purchase receipt tracking
- Security limits and duplicate prevention
- Real-time analytics and reporting

## Data Flow

### Purchase Recording Flow

```
1. User initiates purchase on frontend
2. Backend processes payment (off-chain)
3. Backend calls recordPurchase() with RECORDER_ROLE
4. Contract validates stage, limits, and duplicates
5. Receipt stored on-chain with stage and pricing info
6. Events emitted for real-time updates
7. Frontend displays confirmation and receipt
```

### Stage Management Flow

```

1. Admin configures stage (price, allocation)
2. Admin activates stage (deactivates previous)
3. Contract enforces new pricing and limits
4. Purchase recording uses active stage info
5. Stage progression continues until presale completion
```

## Core Data Structures

### Receipt Structure

```solidity
struct Receipt {
    uint128 usdt;          // USDT amount (6 decimals)
    uint128 magax;         // MAGAX tokens allocated (18 decimals)
    uint40  time;          // Purchase timestamp
    uint8   stage;         // Presale stage (1-50)
    uint128 pricePerToken; // Exact price paid per token
}
```

### Stage Information

```solidity
struct StageInfo {
    uint128 pricePerToken;    // USDT per MAGAX token
    uint128 tokensAllocated;  // Total tokens for this stage
    uint128 tokensSold;       // Tokens sold in this stage
    bool isActive;            // Whether stage is active
}
```

## Security Architecture

### Access Control

- **DEFAULT_ADMIN_ROLE**: Contract owner, can manage stages and emergency functions
- **RECORDER_ROLE**: Backend service, can record purchases
- **Role Separation**: Clear separation of concerns for security

### Purchase Limits

- **Individual Limit**: 1M USDT max per purchase
- **Total Limit**: 10M USDT total presale cap
- **Stage Limit**: Cannot exceed allocated tokens per stage

### Anti-Fraud Measures

- **Duplicate Prevention**: Hash-based purchase uniqueness
- **Reentrancy Protection**: All state-changing functions protected
- **Input Validation**: Comprehensive validation on all inputs

## Gas Optimization

### Efficient Storage

- **Packed Structs**: Optimized storage slots
- **Cached Totals**: Avoid expensive loops
- **Custom Errors**: Gas-efficient error handling

### Batch Operations

- **Ready for Scaling**: Designed for high-volume operations
- **Minimal Storage Reads**: Efficient data access patterns
- **Event-Driven Updates**: Real-time data without constant polling

## Integration Points

### For Frontend Applications

- **Read Functions**: Get receipts, stage info, user stats
- **Event Listening**: Real-time purchase updates
- **Stage Information**: Current pricing and availability

### For Backend Services

- **Purchase Recording**: Main integration point via RECORDER_ROLE
- **Stage Management**: Admin functions for presale progression
- **Analytics**: Comprehensive stats and reporting

### For Analytics & Monitoring

- **Event Logs**: Complete purchase history
- **Real-time Stats**: Presale progress and metrics
- **User Analytics**: Individual purchase patterns

## Next Steps

1. **[Stage Management](./stage-management.md)** - Learn how to configure and manage the 50-stage system
2. **[Function Reference](./function-reference.md)** - Detailed API documentation
3. **[Integration Guide](./integration-guide.md)** - Step-by-step integration instructions
