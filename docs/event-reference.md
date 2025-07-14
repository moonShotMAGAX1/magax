# Event Reference

Complete reference for all events emitted by the MAGAXPresaleReceipts contract.

## Purchase Events

### PurchaseRecorded

Emitted when a new purchase is successfully recorded.

```solidity
event PurchaseRecorded(
    address indexed buyer,
    uint128 usdt,
    uint128 magax,
    uint40  time,
    uint8   stage,
    uint128 pricePerToken,
    uint256 totalUserPurchases,
    bool isNewBuyer
);
```

**Parameters:**

- `buyer` (indexed): Address of the token purchaser
- `usdt`: Amount of USDT paid (6 decimals)
- `magax`: Amount of MAGAX tokens allocated (18 decimals)
- `time`: Timestamp of the purchase
- `stage`: Presale stage number when purchase was made
- `pricePerToken`: Exact USDT price per MAGAX token (6 decimals)
- `totalUserPurchases`: Total number of purchases made by this user
- `isNewBuyer`: Whether this is the user's first purchase

**Use Cases:**

- Real-time purchase notifications
- User dashboard updates
- Analytics and reporting
- Purchase history reconstruction

**Example Listening:**

```javascript
presaleContract.on('PurchaseRecorded', (buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer, event) => {
    console.log(`New purchase by ${buyer}:`);
    console.log(`  Amount: ${ethers.formatUnits(usdt, 6)} USDT`);
    console.log(`  Tokens: ${ethers.formatUnits(magax, 18)} MAGAX`);
    console.log(`  Stage: ${stage}`);
    console.log(`  Price: $${ethers.formatUnits(pricePerToken, 6)}/token`);
    console.log(`  New buyer: ${isNewBuyer}`);
    console.log(`  Transaction: ${event.transactionHash}`);
});
```

## Stage Management Events

### StageConfigured

Emitted when a presale stage is configured with pricing and allocation.

```solidity
event StageConfigured(
    uint8 indexed stage,
    uint128 pricePerToken,
    uint128 tokensAllocated
);
```

**Parameters:**

- `stage` (indexed): Stage number (1-50)
- `pricePerToken`: USDT price per MAGAX token (6 decimals)
- `tokensAllocated`: Total MAGAX tokens allocated to this stage (18 decimals)

**Use Cases:**

- Track stage setup progress
- Audit stage configurations
- Frontend stage info updates

**Example:**

```javascript
presaleContract.on('StageConfigured', (stage, pricePerToken, tokensAllocated, event) => {
    console.log(`Stage ${stage} configured:`);
    console.log(`  Price: $${ethers.formatUnits(pricePerToken, 6)}/MAGAX`);
    console.log(`  Allocation: ${ethers.formatUnits(tokensAllocated, 18)} MAGAX`);
});
```

### StageActivated

Emitted when a stage is activated for purchases.

```solidity
event StageActivated(uint8 indexed stage);
```

**Parameters:**

- `stage` (indexed): Stage number that was activated

**Use Cases:**

- Update frontend pricing displays
- Notify users of stage changes
- Analytics tracking

**Example:**

```javascript
presaleContract.on('StageActivated', (stage, event) => {
    console.log(`Stage ${stage} is now active`);
    // Update UI to show new pricing and availability
});
```

### StageDeactivated

Emitted when a stage is deactivated (usually when activating a new stage).

```solidity
event StageDeactivated(uint8 indexed stage);
```

**Parameters:**

- `stage` (indexed): Stage number that was deactivated

**Use Cases:**

- Track stage transitions
- Audit stage changes
- Update stage status displays

**Example:**

```javascript
presaleContract.on('StageDeactivated', (stage, event) => {
    console.log(`Stage ${stage} deactivated`);
});
```

## Administrative Events

### EmergencyTokenWithdraw

Emitted when admin withdraws accidentally sent tokens.

```solidity
event EmergencyTokenWithdraw(
    address indexed token,
    address indexed to,
    uint256 amount
);
```

**Parameters:**

- `token` (indexed): Address of the withdrawn token contract
- `to` (indexed): Recipient address of withdrawn tokens
- `amount`: Amount of tokens withdrawn

**Use Cases:**

- Security monitoring
- Administrative audit trail
- Alert systems for emergency actions

**Example:**

```javascript
presaleContract.on('EmergencyTokenWithdraw', (token, to, amount, event) => {
    console.log('EMERGENCY: Token withdrawal detected');
    console.log(`  Token: ${token}`);
    console.log(`  Recipient: ${to}`);
    console.log(`  Amount: ${amount.toString()}`);
    // Trigger security alerts
});
```

## Event Filtering and Querying

### Filter by Buyer Address

```javascript
async function getPurchaseHistoryForUser(userAddress) {
    const filter = presaleContract.filters.PurchaseRecorded(userAddress);
    const events = await presaleContract.queryFilter(filter);
    
    return events.map(event => ({
        usdt: ethers.formatUnits(event.args.usdt, 6),
        magax: ethers.formatUnits(event.args.magax, 18),
        timestamp: new Date(Number(event.args.time) * 1000),
        stage: event.args.stage,
        pricePerToken: ethers.formatUnits(event.args.pricePerToken, 6),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
    }));
}
```

### Filter by Stage

```javascript
async function getPurchasesForStage(stageNumber) {
    const filter = presaleContract.filters.PurchaseRecorded();
    const events = await presaleContract.queryFilter(filter);
    
    // Filter by stage (not indexed, so filter after query)
    return events.filter(event => event.args.stage === stageNumber);
}
```

### Filter by Time Range

```javascript
async function getPurchasesInRange(fromBlock, toBlock) {
    const filter = presaleContract.filters.PurchaseRecorded();
    const events = await presaleContract.queryFilter(filter, fromBlock, toBlock);
    
    return events.map(event => ({
        buyer: event.args.buyer,
        usdt: ethers.formatUnits(event.args.usdt, 6),
        magax: ethers.formatUnits(event.args.magax, 18),
        stage: event.args.stage,
        blockNumber: event.blockNumber,
        timestamp: new Date(Number(event.args.time) * 1000)
    }));
}
```

## Real-time Event Monitoring

### Comprehensive Event Listener

```javascript
class PresaleEventMonitor {
    constructor(contract) {
        this.contract = contract;
        this.handlers = new Map();
    }
    
    // Register event handlers
    onPurchase(handler) {
        this.handlers.set('PurchaseRecorded', handler);
        return this;
    }
    
    onStageChange(handler) {
        this.handlers.set('StageActivated', handler);
        return this;
    }
    
    onStageConfigured(handler) {
        this.handlers.set('StageConfigured', handler);
        return this;
    }
    
    onEmergencyAction(handler) {
        this.handlers.set('EmergencyTokenWithdraw', handler);
        return this;
    }
    
    // Start monitoring all events
    startMonitoring() {
        // Purchase events
        if (this.handlers.has('PurchaseRecorded')) {
            this.contract.on('PurchaseRecorded', (...args) => {
                const event = args[args.length - 1]; // Last argument is event object
                const [buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer] = args.slice(0, -1);
                
                this.handlers.get('PurchaseRecorded')({
                    buyer,
                    usdt: ethers.formatUnits(usdt, 6),
                    magax: ethers.formatUnits(magax, 18),
                    timestamp: new Date(Number(time) * 1000),
                    stage: Number(stage),
                    pricePerToken: ethers.formatUnits(pricePerToken, 6),
                    totalUserPurchases: Number(totalUserPurchases),
                    isNewBuyer,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            });
        }
        
        // Stage activation events
        if (this.handlers.has('StageActivated')) {
            this.contract.on('StageActivated', (stage, event) => {
                this.handlers.get('StageActivated')({
                    stage: Number(stage),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            });
        }
        
        // Stage configuration events
        if (this.handlers.has('StageConfigured')) {
            this.contract.on('StageConfigured', (stage, pricePerToken, tokensAllocated, event) => {
                this.handlers.get('StageConfigured')({
                    stage: Number(stage),
                    pricePerToken: ethers.formatUnits(pricePerToken, 6),
                    tokensAllocated: ethers.formatUnits(tokensAllocated, 18),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            });
        }
        
        // Emergency events
        if (this.handlers.has('EmergencyTokenWithdraw')) {
            this.contract.on('EmergencyTokenWithdraw', (token, to, amount, event) => {
                this.handlers.get('EmergencyTokenWithdraw')({
                    token,
                    recipient: to,
                    amount: amount.toString(),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            });
        }
    }
    
    // Stop monitoring
    stopMonitoring() {
        this.contract.removeAllListeners();
    }
}

// Usage
const monitor = new PresaleEventMonitor(presaleContract);

monitor
    .onPurchase((data) => {
        console.log('New purchase:', data);
        updateDashboard(data);
    })
    .onStageChange((data) => {
        console.log('Stage changed:', data);
        refreshStageInfo();
    })
    .onEmergencyAction((data) => {
        console.log('EMERGENCY ACTION:', data);
        sendAlert(data);
    })
    .startMonitoring();
```

## Event-Based Analytics

### Real-time Statistics

```javascript
class PresaleAnalytics {
    constructor(contract) {
        this.contract = contract;
        this.stats = {
            totalPurchases: 0,
            totalUSDT: 0,
            totalMAGAX: 0,
            uniqueBuyers: new Set(),
            stageStats: new Map()
        };
    }
    
    startTracking() {
        this.contract.on('PurchaseRecorded', (buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer, event) => {
            // Update global stats
            this.stats.totalPurchases++;
            this.stats.totalUSDT += Number(ethers.formatUnits(usdt, 6));
            this.stats.totalMAGAX += Number(ethers.formatUnits(magax, 18));
            this.stats.uniqueBuyers.add(buyer);
            
            // Update stage stats
            const stageNumber = Number(stage);
            if (!this.stats.stageStats.has(stageNumber)) {
                this.stats.stageStats.set(stageNumber, {
                    purchases: 0,
                    usdt: 0,
                    magax: 0,
                    buyers: new Set()
                });
            }
            
            const stageData = this.stats.stageStats.get(stageNumber);
            stageData.purchases++;
            stageData.usdt += Number(ethers.formatUnits(usdt, 6));
            stageData.magax += Number(ethers.formatUnits(magax, 18));
            stageData.buyers.add(buyer);
            
            // Emit updated stats
            this.onStatsUpdate(this.getStats());
        });
    }
    
    getStats() {
        return {
            global: {
                totalPurchases: this.stats.totalPurchases,
                totalUSDT: this.stats.totalUSDT,
                totalMAGAX: this.stats.totalMAGAX,
                uniqueBuyers: this.stats.uniqueBuyers.size
            },
            stages: Array.from(this.stats.stageStats.entries()).map(([stage, data]) => ({
                stage,
                purchases: data.purchases,
                usdt: data.usdt,
                magax: data.magax,
                uniqueBuyers: data.buyers.size
            }))
        };
    }
    
    onStatsUpdate(callback) {
        this.onStatsUpdate = callback;
    }
}
```

## Event Storage and Archival

### Event Database Schema

```sql
-- Purchase events table
CREATE TABLE purchase_events (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    usdt_amount DECIMAL(20, 6) NOT NULL,
    magax_amount DECIMAL(30, 18) NOT NULL,
    purchase_time TIMESTAMP NOT NULL,
    stage INTEGER NOT NULL,
    price_per_token DECIMAL(20, 6) NOT NULL,
    total_user_purchases INTEGER NOT NULL,
    is_new_buyer BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stage events table
CREATE TABLE stage_events (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'configured', 'activated', 'deactivated'
    stage INTEGER NOT NULL,
    price_per_token DECIMAL(20, 6),
    tokens_allocated DECIMAL(30, 18),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency events table
CREATE TABLE emergency_events (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    amount VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Event Indexer

```javascript
class EventIndexer {
    constructor(contract, database) {
        this.contract = contract;
        this.db = database;
    }
    
    async indexPurchaseEvents(fromBlock = 0) {
        const filter = this.contract.filters.PurchaseRecorded();
        const events = await this.contract.queryFilter(filter, fromBlock);
        
        for (const event of events) {
            await this.db.query(`
                INSERT INTO purchase_events (
                    transaction_hash, block_number, buyer_address,
                    usdt_amount, magax_amount, purchase_time,
                    stage, price_per_token, total_user_purchases, is_new_buyer
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (transaction_hash) DO NOTHING
            `, [
                event.transactionHash,
                event.blockNumber,
                event.args.buyer,
                ethers.formatUnits(event.args.usdt, 6),
                ethers.formatUnits(event.args.magax, 18),
                new Date(Number(event.args.time) * 1000),
                Number(event.args.stage),
                ethers.formatUnits(event.args.pricePerToken, 6),
                Number(event.args.totalUserPurchases),
                event.args.isNewBuyer
            ]);
        }
    }
    
    async startRealTimeIndexing() {
        this.contract.on('PurchaseRecorded', async (...args) => {
            const event = args[args.length - 1];
            const [buyer, usdt, magax, time, stage, pricePerToken, totalUserPurchases, isNewBuyer] = args.slice(0, -1);
            
            await this.db.query(`
                INSERT INTO purchase_events (
                    transaction_hash, block_number, buyer_address,
                    usdt_amount, magax_amount, purchase_time,
                    stage, price_per_token, total_user_purchases, is_new_buyer
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                event.transactionHash,
                event.blockNumber,
                buyer,
                ethers.formatUnits(usdt, 6),
                ethers.formatUnits(magax, 18),
                new Date(Number(time) * 1000),
                Number(stage),
                ethers.formatUnits(pricePerToken, 6),
                Number(totalUserPurchases),
                isNewBuyer
            ]);
        });
    }
}
```

## Next Steps

- **[Error Reference](./error-reference.md)** - Custom errors and troubleshooting
- **[Integration Guide](./integration-guide.md)** - Implementation examples
- **[Security Features](./security-features.md)** - Security monitoring with events
