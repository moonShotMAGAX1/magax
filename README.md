# MoonShot MAGAX Token

ERC-20 token contract for the MoonShot MAGAX ecosystem. Total supply is fixed at **1 trillion tokens**. Built using Solidity and deployed via Hardhat.

---

## 🧾 Token Details

- **Token Name:** MoonShot MagaX
- **Symbol:** MAGAX
- **Decimals:** 18
- **Total Supply:** 1,000,000,000,000 MAGAX

---

## ⚙️ Setup & Deployment

### 1. Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
```

### 2. Compile the Contract
```bash
npx hardhat compile
```

### 3. Deploy to Sepolia
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
