require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    // Ethereum Networks
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://mainnet.infura.io/v3/",
      accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    // Polygon Networks
    amoy: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-amoy.infura.io/v3/3e5d87a372154785964c8beae188a399",
      accounts: process.env.POLYGON_DEPLOYER_PRIVATE_KEY ? [process.env.POLYGON_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 50000000000, // 50 Gwei - above minimum requirement
      maxFeePerGas: 60000000000, // 60 Gwei
      maxPriorityFeePerGas: 50000000000, // 50 Gwei - above minimum
      chainId: 80002
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: true
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
};