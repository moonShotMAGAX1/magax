const { ethers } = require("hardhat");

async function main() {
  console.log("Checking current gas prices...\n");

  try {
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    
    // Prevent accidental hardhat deployments
    if (network.name === "hardhat") {
      console.log("Running on local hardhat network");
      console.log("Use --network sepolia or --network polygon for real deployments");
      process.exit(1);
    }
    
    // Determine network type and costs
    const isPolygon = [137n, 80001n, 80002n].includes(network.chainId); // Polygon, Mumbai, Amoy
    const isEthereum = [1n, 11155111n].includes(network.chainId); // Mainnet, Sepolia
    const currency = isPolygon ? "MATIC" : "ETH";
    
    console.log("Network:", network.name, "(Chain ID:", Number(network.chainId), ")");
    console.log("Currency:", currency);
    
    // Get EIP-1559 fee data instead of legacy gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const maxFeePerGas = feeData.maxFeePerGas;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    
    console.log("Current Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");
    
    if (maxFeePerGas && maxPriorityFeePerGas) {
      console.log("Max Fee Per Gas:", ethers.formatUnits(maxFeePerGas, "gwei"), "Gwei");
      console.log("Priority Fee:", ethers.formatUnits(maxPriorityFeePerGas, "gwei"), "Gwei");
    }
    
    const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");
    
    console.log("Current Gas Price:", gasPriceGwei, "Gwei");
    
    // Different gas price recommendations for different networks
    let recommendations;
    
    if (isPolygon) {
      recommendations = {
        "Low (Fast)": { gwei: "< 50", description: "Fast transactions, low cost" },
        "Standard": { gwei: "50-150", description: "Normal network conditions" },
        "High": { gwei: "150-300", description: "Network congestion" },
        "Very High": { gwei: "> 300", description: "High demand periods" }
      };
    } else {
      recommendations = {
        "Low (Safe)": { gwei: "< 20", description: "Good for non-urgent transactions" },
        "Standard": { gwei: "20-50", description: "Normal network conditions" },
        "High": { gwei: "50-100", description: "Congested network" },
        "Very High": { gwei: "> 100", description: "Network congestion or high demand" }
      };
    }
    
    console.log("\nGas Price Recommendations for", currency + ":");
    console.log("─".repeat(50));
    
    let currentLevel = "Very High";
    const gasPriceNum = parseFloat(gasPriceGwei);
    
    if (isPolygon) {
      if (gasPriceNum < 50) currentLevel = "Low (Fast)";
      else if (gasPriceNum < 150) currentLevel = "Standard";
      else if (gasPriceNum < 300) currentLevel = "High";
    } else {
      if (gasPriceNum < 20) currentLevel = "Low (Safe)";
      else if (gasPriceNum < 50) currentLevel = "Standard";
      else if (gasPriceNum < 100) currentLevel = "High";
    }
    
    Object.entries(recommendations).forEach(([level, info]) => {
      const indicator = level === currentLevel ? "👉" : "  ";
      console.log(`${indicator} ${level}: ${info.gwei} Gwei - ${info.description}`);
    });
    
    console.log("\nEstimated Deployment Costs:");
    console.log("─".repeat(50));
    
    // Different contracts deployed on different networks
    if (isEthereum) {
      // Only token contract on Ethereum
      const tokenGasEstimate = 1800000; // ~1.8M gas for token with all features
      const totalCostWei = gasPrice * BigInt(tokenGasEstimate);
      const totalCostEth = ethers.formatEther(totalCostWei);
      
      console.log("MAGAX Token Contract:", tokenGasEstimate.toLocaleString(), "gas");
      console.log("Estimated Cost:", totalCostEth, currency);
      console.log("Contract: MoonShotMAGAX (ERC20 + Capped + Permit)");
      
    } else if (isPolygon) {
      // Only presale contract on Polygon
      const presaleGasEstimate = 2500000; // ~2.5M gas for presale with all features
      const totalCostWei = gasPrice * BigInt(presaleGasEstimate);
      const totalCostMatic = ethers.formatEther(totalCostWei);
      
      console.log("MAGAX Presale Contract:", presaleGasEstimate.toLocaleString(), "gas");
      console.log("Estimated Cost:", totalCostMatic, currency);
      console.log("Contract: MAGAXPresaleReceipts (50 stages + referrals)");
      
      // Show cost comparison with Ethereum
      const ethereumCostEstimate = ethers.formatEther(gasPrice * BigInt(presaleGasEstimate) * 30n);
      console.log("");
      console.log("Cost Comparison:");
      console.log(`Polygon: ${totalCostMatic} ${currency}`);
      console.log(`Ethereum: ~${ethereumCostEstimate} ETH (estimated)`);
      console.log(`Savings: ~97% by using Polygon!`);
    }
    
    const totalCostWei = gasPrice * BigInt(isEthereum ? 1800000 : 2500000);
    const totalCost = ethers.formatEther(totalCostWei);
    
    
    // Network-specific operational costs
    if (isEthereum) {
      console.log("Token Operations (Ethereum):");
      const operations = [
        { name: "Token Transfer", gas: 21000 },
        { name: "Token Approval", gas: 46000 },
        { name: "Burn Tokens", gas: 35000 },
        { name: "Pause Contract", gas: 30000 }
      ];
      
      operations.forEach(op => {
        const cost = ethers.formatEther(gasPrice * BigInt(op.gas));
        console.log(`   ${op.name}: ${op.gas.toLocaleString()} gas = ${cost} ${currency}`);
      });
      
    } else if (isPolygon) {
      console.log("Presale Operations (Polygon):");
      const operations = [
        { name: "Record Purchase", gas: 120000 },   
        { name: "Record w/ Referral", gas: 160000 },
        { name: "Configure Stage", gas: 70000 },     
        { name: "Activate Stage", gas: 45000 },     
        { name: "Emergency Pause", gas: 30000 }
      ];
      
      operations.forEach(op => {
        const cost = ethers.formatEther(gasPrice * BigInt(op.gas));
        console.log(`   ${op.name}: ${op.gas.toLocaleString()} gas = ${cost} ${currency}`);
      });
    }
    
    // Cost comparison at different gas prices
    console.log("\nCost at Different Gas Prices:");
    console.log("─".repeat(50));
    
    const gasPrices = isPolygon ? [30, 50, 100, 200, 300] : [10, 20, 30, 50, 100];
    const contractGas = isEthereum ? 1800000 : 2500000;
    
    gasPrices.forEach(gwei => {
      const gasWei = ethers.parseUnits(gwei.toString(), "gwei");
      const costWei = gasWei * BigInt(contractGas);
      const cost = ethers.formatEther(costWei);
      const indicator = Math.abs(gwei - gasPriceNum) < 10 ? "👉" : "  ";
      console.log(`${indicator} ${gwei} Gwei: ${cost} ${currency}`);
    });
    
    // Deployment recommendation based on network
    console.log("\nDeployment Recommendation:");
    console.log("─".repeat(50));
    
    if (isPolygon) {
      if (gasPriceNum < 100) {
        console.log("EXCELLENT TIME TO DEPLOY");
        console.log("Polygon gas prices are very low");
        console.log("Perfect for presale contract deployment");
      } else if (gasPriceNum < 200) {
        console.log("GOOD CONDITIONS");
        console.log("Still very affordable compared to Ethereum");
      } else {
        console.log("MODERATE PRICES");
        console.log("Consider waiting or deploy if urgent");
      }
    } else {
      if (gasPriceNum < 30) {
        console.log("GOOD TIME TO DEPLOY");
        console.log("Gas prices are reasonable for Ethereum deployment");
      } else if (gasPriceNum < 60) {
        console.log("MODERATE CONDITIONS");
        console.log("Consider waiting for lower gas prices or deploy if urgent");
      } else {
        console.log("HIGH GAS PRICES");
        console.log("Consider waiting for network congestion to reduce");
        console.log("Monitor gas prices at etherscan.io/gastracker");
      }
    }
    
    console.log("\nAdditional Resources:");
    if (isEthereum) {
      console.log("ETH Gas Station: https://ethgasstation.info/");
      console.log("Gas Tracker: https://etherscan.io/gastracker");
      console.log("Gas Now: https://www.gasnow.org/");
    } else if (isPolygon) {
      console.log("Polygon Gas Tracker: https://polygonscan.com/gastracker");
      console.log("Gas Station: https://gasstation-mainnet.matic.network/");
    }
    
  } catch (error) {
    console.error("Error checking gas prices:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
