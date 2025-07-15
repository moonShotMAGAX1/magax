require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true
        }
      }
    ]
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    // Ethereum Networks
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://mainnet.infura.io/v3/",
      accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    // Polygon Networks
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.POLYGON_DEPLOYER_PRIVATE_KEY ? [process.env.POLYGON_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    polygonMumbai: {
      url: process.env.POLYGON_MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.POLYGON_DEPLOYER_PRIVATE_KEY ? [process.env.POLYGON_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    amoy: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-amoy.infura.io/v3/",
      accounts: process.env.POLYGON_DEPLOYER_PRIVATE_KEY ? [process.env.POLYGON_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto",
      chainId: 80002
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-amoy.infura.io/v3/",
      accounts: process.env.POLYGON_DEPLOYER_PRIVATE_KEY ? [process.env.POLYGON_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto",
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      amoy: process.env.POLYGONSCAN_API_KEY,
      polygonAmoy: process.env.POLYGONSCAN_API_KEY
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
};
