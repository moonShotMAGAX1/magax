const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("MAGAX Multi-Chain Deployment Script");
  console.log("====================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;
  const chainId = network.chainId;
  
  console.log("Network:", networkName, "(Chain ID:", chainId, ")");
  
  // Determine native currency
  const isPolygon = [137n, 80001n, 80002n].includes(chainId); // Polygon Mainnet, Mumbai, Amoy
  const isEthereum = [1n, 11155111n].includes(chainId); // Mainnet, Sepolia
  const currency = isPolygon ? "MATIC" : "ETH";
  
  console.log("Account balance:", ethers.formatEther(balance), currency);

  // Set minimum balance based on network
  const minBalance = isPolygon ? ethers.parseEther("0.3") : ethers.parseEther("0.05");
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ${currency}, have ${ethers.formatEther(balance)} ${currency}`);
  }

  // Get and validate environment variables
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const recorderAddress = process.env.RECORDER_ADDRESS;
  const adminAddress = process.env.ADMIN_ADDRESS || treasuryAddress;
  
  console.log("");
  console.log("Configuration:");
  console.log("Treasury address:", treasuryAddress || "Not set");
  console.log("Recorder address:", recorderAddress || "Not set");
  console.log("Admin address:", adminAddress || "Not set");

  // Decide what to deploy based on network
  if (isEthereum) {
    console.log("");
    console.log("Deploying on Ethereum Network");
    console.log("Will deploy: MAGAX Token Contract");
    
    if (!treasuryAddress) {
      throw new Error("TREASURY_ADDRESS required for Ethereum deployment");
    }
    if (!ethers.isAddress(treasuryAddress)) {
      throw new Error("Invalid TREASURY_ADDRESS format");
    }
    
    await deployToken(treasuryAddress, deployer, network, currency);
    
  } else if (isPolygon) {
    console.log("");
    console.log("Deploying on Polygon Network");
    console.log("Will deploy: MAGAX Presale Contract");
    
    if (!recorderAddress) {
      throw new Error("RECORDER_ADDRESS required for Polygon deployment");
    }
    if (!ethers.isAddress(recorderAddress)) {
      throw new Error("Invalid RECORDER_ADDRESS format");
    }
    
    await deployPresale(recorderAddress, adminAddress, deployer, network, currency);
    
  } else {
    throw new Error(`Unsupported network. Chain ID: ${chainId}. Use Ethereum (1, 11155111) or Polygon (137, 80001, 80002)`);
  }
}

async function deployToken(treasuryAddress, deployer, network, currency) {
  console.log("");
  console.log("Deploying MAGAX Token...");
  
  const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
  
  // Estimate gas
  const tokenDeployTx = await MoonShotMAGAX.getDeployTransaction(treasuryAddress);
  const tokenGasEstimate = await deployer.estimateGas(tokenDeployTx);
  const feeData = await ethers.provider.getFeeData();
  
  await logGasEstimation(tokenGasEstimate, feeData, currency);
  
  // Deploy with optimized gas settings
  const deployOptions = getOptimizedGasOptions(feeData);
  const token = await MoonShotMAGAX.deploy(treasuryAddress, deployOptions);
  
  console.log("Deployment transaction hash:", token.deploymentTransaction().hash);
  
  const tokenReceipt = await token.deploymentTransaction().wait();
  const tokenAddress = await token.getAddress();
  
  console.log("Token deployed successfully!");
  console.log("Address:", tokenAddress);
  await logDeploymentResults(tokenReceipt, currency);

  // Verify token details
  await verifyTokenDetails(token, treasuryAddress);
  
  // Save deployment info
  const deploymentInfo = await createTokenDeploymentInfo(token, tokenReceipt, network, treasuryAddress);
  await saveDeploymentInfo(deploymentInfo, `ethereum-token-${network.name}`);
  
  logNextSteps(network, tokenAddress, 'token', treasuryAddress);
}

async function deployPresale(recorderAddress, adminAddress, deployer, network, currency) {
  console.log("");
  console.log("Deploying MAGAX Presale...");
  
  const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
  
  // Estimate gas
  const presaleDeployTx = await MAGAXPresaleReceipts.getDeployTransaction(recorderAddress);
  const presaleGasEstimate = await deployer.estimateGas(presaleDeployTx);
  const feeData = await ethers.provider.getFeeData();
  
  await logGasEstimation(presaleGasEstimate, feeData, currency);
  
  // Deploy with optimized gas settings and increased gas limit
  const deployOptions = {
    gasLimit: 4000000, // 4M gas limit for large presale contract
    ...getOptimizedGasOptions(feeData)
  };
  const presale = await MAGAXPresaleReceipts.deploy(recorderAddress, deployOptions);
  
  console.log("Deployment transaction hash:", presale.deploymentTransaction().hash);
  
  const presaleReceipt = await presale.deploymentTransaction().wait();
  const presaleAddress = await presale.getAddress();
  
  console.log("Presale deployed successfully!");
  console.log("Address:", presaleAddress);
  await logDeploymentResults(presaleReceipt, currency);

  // Setup permissions and configure stages
  await setupPresalePermissions(presale, recorderAddress, adminAddress, deployer);
  await configureInitialStages(presale);
  
  // Verify presale details
  await verifyPresaleDetails(presale);
  
  // Save deployment info
  const deploymentInfo = await createPresaleDeploymentInfo(presale, presaleReceipt, network, recorderAddress, adminAddress);
  await saveDeploymentInfo(deploymentInfo, `polygon-presale-${network.name}`);
  
  logNextSteps(network, presaleAddress, 'presale', recorderAddress);
}

// Helper functions
async function logGasEstimation(gasEstimate, feeData, currency) {
  let costEstimate;
  
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    costEstimate = gasEstimate * feeData.maxFeePerGas;
    console.log("EIP-1559 Gas Estimation:");
    console.log(`  Gas: ${gasEstimate.toLocaleString()}`);
    console.log(`  Max fee: ${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei`);
    console.log(`  Priority: ${ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")} gwei`);
  } else {
    costEstimate = gasEstimate * feeData.gasPrice;
    console.log("Legacy Gas Estimation:");
    console.log(`  Gas: ${gasEstimate.toLocaleString()}`);
    console.log(`  Price: ${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  }
  
  console.log(`  Cost: ${ethers.formatEther(costEstimate)} ${currency}`);
}

async function logDeploymentResults(receipt, currency) {
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toLocaleString());
  console.log("Effective gas price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
  console.log("Total cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), currency);
}

function getOptimizedGasOptions(feeData) {
  const deployOptions = {};
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    deployOptions.maxFeePerGas = feeData.maxFeePerGas;
    deployOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  } else if (feeData.gasPrice) {
    deployOptions.gasPrice = feeData.gasPrice;
  }
  return deployOptions;
}

async function verifyTokenDetails(token, treasuryAddress) {
  console.log("");
  console.log("Token Details:");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const maxSupply = await token.getMaxSupply();
  const treasuryBalance = await token.balanceOf(treasuryAddress);
  const owner = await token.owner();

  console.log(`  Name: ${name}`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  Decimals: ${decimals}`);
  console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(`  Max Supply: ${ethers.formatUnits(maxSupply, decimals)} ${symbol}`);
  console.log(`  Treasury: ${ethers.formatUnits(treasuryBalance, decimals)} ${symbol}`);
  console.log(`  Owner: ${owner}`);
}

async function setupPresalePermissions(presale, recorderAddress, adminAddress, deployer) {
  console.log("");
  console.log("Setting up permissions...");
  
  const ADMIN_ROLE = await presale.DEFAULT_ADMIN_ROLE();
  const RECORDER_ROLE = await presale.RECORDER_ROLE();
  
  const hasRecorderRole = await presale.hasRole(RECORDER_ROLE, recorderAddress);
  console.log(`  Recorder role: ${hasRecorderRole ? 'Yes' : 'No'}`);
  
  if (adminAddress && adminAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Granting admin role...");
    await presale.grantRole(ADMIN_ROLE, adminAddress);
    console.log("  Admin role granted: Yes");
  }
}

async function configureInitialStages(presale) {
  console.log("");
  console.log("Configuring stages...");
  
  try {
    // Stage 1: $0.001 per MAGAX, 10M allocation
    await presale.configureStage(1, ethers.parseUnits("0.001", 6), ethers.parseUnits("10000000", 18));
    console.log("  Stage 1: Configured");
    
    // Stage 2: $0.0015 per MAGAX, 20M allocation  
    await presale.configureStage(2, ethers.parseUnits("0.0015", 6), ethers.parseUnits("20000000", 18));
    console.log("  Stage 2: Configured");
    
    // Stage 3: $0.002 per MAGAX, 20M allocation
    await presale.configureStage(3, ethers.parseUnits("0.002", 6), ethers.parseUnits("20000000", 18));
    console.log("  Stage 3: Configured");
    
    // Activate stage 1
    await presale.activateStage(1);
    console.log("  Stage 1 activated: Yes");
    
  } catch (error) {
    console.log("  Stage setup failed:", error.message);
  }
}

async function verifyPresaleDetails(presale) {
  console.log("");
  console.log("Presale Details:");
  const maxPurchase = await presale.MAX_PURCHASE_USDT();
  const maxTotal = await presale.MAX_TOTAL_USDT();
  const referrerBonus = await presale.REFERRER_BONUS_BPS();
  const refereeBonus = await presale.REFEREE_BONUS_BPS();
  
  console.log(`  Max Purchase: ${ethers.formatUnits(maxPurchase, 6)} USDT`);
  console.log(`  Max Raise: ${ethers.formatUnits(maxTotal, 6)} USDT`);
  console.log(`  Referrer Bonus: ${Number(referrerBonus) / 100}%`);
  console.log(`  Referee Bonus: ${Number(refereeBonus) / 100}%`);
}

async function createTokenDeploymentInfo(token, receipt, network, treasuryAddress) {
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const maxSupply = await token.getMaxSupply();
  const owner = await token.owner();
  const tokenAddress = await token.getAddress();

  return {
    type: 'token',
    network: network.name,
    chainId: Number(network.chainId),
    token: {
      name, symbol, decimals: Number(decimals),
      address: tokenAddress,
      totalSupply: totalSupply.toString(),
      maxSupply: maxSupply.toString(),
      owner, treasury: treasuryAddress,
      deploymentHash: token.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      deploymentCost: ethers.formatEther(receipt.gasUsed * receipt.gasPrice)
    },
    timestamp: new Date().toISOString()
  };
}

async function createPresaleDeploymentInfo(presale, receipt, network, recorderAddress, adminAddress) {
  const presaleAddress = await presale.getAddress();
  const maxPurchase = await presale.MAX_PURCHASE_USDT();
  const maxTotal = await presale.MAX_TOTAL_USDT();

  return {
    type: 'presale',
    network: network.name,
    chainId: Number(network.chainId),
    presale: {
      address: presaleAddress,
      recorder: recorderAddress,
      admin: adminAddress,
      maxPurchaseUSDT: maxPurchase.toString(),
      maxTotalUSDT: maxTotal.toString(),
      deploymentHash: presale.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      deploymentCost: ethers.formatEther(receipt.gasUsed * receipt.gasPrice)
    },
    timestamp: new Date().toISOString()
  };
}

async function saveDeploymentInfo(deploymentInfo, filePrefix) {
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const fileName = `${filePrefix}-${Date.now()}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("");
  console.log("Deployment saved:", filePath);
}

function logNextSteps(network, contractAddress, contractType, roleAddress) {
  console.log("");
  console.log("Next Steps:");
  console.log("1. Add to .env file:");
  
  if (contractType === 'token') {
    console.log(`   ETHEREUM_TOKEN_ADDRESS=${contractAddress}`);
    console.log(`   ETHEREUM_NETWORK=${network.name}`);
  } else {
    console.log(`   POLYGON_PRESALE_ADDRESS=${contractAddress}`);
    console.log(`   POLYGON_NETWORK=${network.name}`);
  }
  
  console.log("");
  console.log("2. Verify contract:");
  const verifyArgs = contractType === 'token' ? `"${roleAddress}"` : `"${roleAddress}"`;
  console.log(`   npx hardhat verify --network ${network.name} ${contractAddress} ${verifyArgs}`);
  
  console.log("");
  if (contractType === 'token') {
    console.log("3. Deploy presale on Polygon:");
    console.log("   npx hardhat run scripts/deploy-presale.js --network polygon");
  } else {
    console.log("3. Configure your backend with the presale address");
    console.log("4. Test with small purchases before going live");
  }
  
  console.log("");
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });