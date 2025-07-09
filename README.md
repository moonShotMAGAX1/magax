# MoonShot MAGAX

## 🪙 Token Details

- **Token Name:** MoonShot MAGAX

Complete ecosystem for the MoonShot MAGAX token, including the ERC-20 token contract and presale receipt tracking system. Built using Solidity and deployed via Hardhat.

---

## 📋 Project Overview

This project consists of two main smart contracts:

### 1. **MoonShotMAGAX Token**

- ERC-20 token with fixed supply
- Standard token functionality

### 2. **MAGAXPresaleReceipts**

- On-chain presale tracking system
- Records purchase receipts for transparency
- Role-based access control

---

## � Token Details

- **Token Name:** MoonShot MagaX
- **Symbol:** MAGAX
- **Decimals:** 18
- **Total Supply:** 1,000,000,000,000 MAGAX (1 Trillion)

---

## 🎫 Presale System

The presale receipt system provides:

- **Transparent tracking** of all presale purchases
- **On-chain receipts** showing USDT paid and MAGAX allocated
- **Role-based security** with RECORDER_ROLE for authorized purchase recording
- **Pausable functionality** for emergency control
- **Multi-purchase support** per buyer

### Key Features

- ✅ Records USDT amount (6 decimals) and MAGAX amount (18 decimals)
- ✅ Timestamp tracking for each purchase
- ✅ Total supply tracking (totalUSDT & totalMAGAX)
- ✅ Access control with admin and recorder roles
- ✅ Emergency pause/unpause functionality

---

## ⚙️ Setup & Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment template and fill in your values:

```bash
cp env.example .env
```

Required environment variables:

```env
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id
TREASURY_ADDRESS=0xYourTreasuryWalletAddress
RECORDER_ADDRESS=0xYourRecorderWalletAddress
```

### 3. Compile Contracts

```bash
npx hardhat compile
```

### 4. Run Tests

```bash
npx hardhat test
```

### 5. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 🧪 Testing

The project includes comprehensive tests covering:

- ✅ Contract deployment and initialization
- ✅ Purchase recording functionality
- ✅ Access control and security
- ✅ Pause/unpause mechanisms
- ✅ Edge cases and error handling

Run all tests:

```bash
npx hardhat test
```

---

## 🔐 Security Features

### Access Control Roles

- **DEFAULT_ADMIN_ROLE**: Can pause/unpause contract, grant/revoke roles
- **RECORDER_ROLE**: Can record presale purchases (typically backend or multisig)

### Security Measures

- Role-based access control using OpenZeppelin
- Pausable functionality for emergency stops
- Input validation and proper event emission
- Comprehensive test coverage

---

## 📁 Project Structure

```text
magax/
├── contracts/
│   ├── MoonShotMAGAX.sol       # ERC-20 token contract
│   └── PreSaleOnChain.sol      # Presale receipt tracking
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   └── MAGAXPresaleReceipts.test.js  # Test suite
├── hardhat.config.js           # Hardhat configuration
├── package.json                # Dependencies
├── .env                        # Environment variables (not committed)
└── env.example                 # Environment template
```

---

## 🚀 Usage Example

### Recording a Presale Purchase

```solidity
// Only addresses with RECORDER_ROLE can call this
presaleReceipts.recordPurchase(
    buyerAddress,           // Buyer's wallet address
    100000000,              // 100 USDT (6 decimals)
    1000000000000000000000  // 1000 MAGAX (18 decimals)
);
```

### Viewing Purchase History

```solidity
// Anyone can view receipts
Receipt[] memory receipts = presaleReceipts.getReceipts(buyerAddress);
```

---

## 📊 Gas Usage

| Function | Gas Usage |
|----------|-----------|
| Deploy Contract | ~1.05M gas |
| Record Purchase | ~83k-163k gas |
| Pause/Unpause | ~25k-47k gas |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

## ⚠️ Important Notes

- **Never commit your `.env` file** - it contains sensitive private keys
- **Test thoroughly on testnets** before mainnet deployment
- **Use a multisig wallet** for the RECORDER_ROLE in production
- **Keep your private keys secure** and never share them
