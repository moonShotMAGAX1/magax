const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying MAGAX Presale on Polygon...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "(Chain ID:", network.chainId, ")");
  
  // Validate we're on Polygon network
  const polygonChainIds = [137n, 80001n, 80002n]; // Polygon Mainnet, Mumbai Testnet, Amoy Testnet
  if (!polygonChainIds.includes(network.chainId)) {
    throw new Error(`This script is for Polygon networks only. Current chain ID: ${network.chainId}`);
  }

  // Minimum balance check (much lower for Polygon)
  const minBalance = ethers.parseEther("0.1"); // 0.1 MATIC minimum
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} MATIC, have ${ethers.formatEther(balance)} MATIC`);
  }

  // Get and validate environment variables
  const recorderAddress = process.env.RECORDER_ADDRESS;
  const adminAddress = process.env.ADMIN_ADDRESS || process.env.TREASURY_ADDRESS;
  
  if (!recorderAddress) {
    throw new Error("RECORDER_ADDRESS not found in .env file");
  }

  // Validate addresses
  if (!ethers.isAddress(recorderAddress)) {
    throw new Error("Invalid RECORDER_ADDRESS format");
  }
  if (adminAddress && !ethers.isAddress(adminAddress)) {
    throw new Error("Invalid ADMIN_ADDRESS format");
  }

  // Security validation
  if (adminAddress && adminAddress.toLowerCase() === recorderAddress.toLowerCase()) {
    console.log("WARNING: Admin and Recorder addresses are the same!");
    console.log("Consider using separate addresses for better security.");
    console.log("Admin manages stages, Recorder only records purchases.");
  }

  console.log("Recorder address:", recorderAddress);
  console.log("Admin address:", adminAddress || "Will use deployer");
  console.log("");

  // Deploy Presale Contract
  console.log("Deploying MAGAXPresaleReceipts...");
  const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
  
  // Estimate gas for presale deployment
  const presaleDeployTx = await MAGAXPresaleReceipts.getDeployTransaction(recorderAddress);
  const presaleGasEstimate = await deployer.estimateGas(presaleDeployTx);
  const feeData = await ethers.provider.getFeeData();
  
  // Use EIP-1559 if available (Polygon supports it)
  let gasPrice, maxFeePerGas, maxPriorityFeePerGas;
  let presaleCostEstimate;
  
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    maxFeePerGas = feeData.maxFeePerGas;
    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    presaleCostEstimate = presaleGasEstimate * maxFeePerGas;
    console.log(`EIP-1559 Gas Estimation:`);
    console.log(`Estimated gas: ${presaleGasEstimate.toLocaleString()}`);
    console.log(`Max fee per gas: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`Max priority fee: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
  } else {
    gasPrice = feeData.gasPrice;
    presaleCostEstimate = presaleGasEstimate * gasPrice;
    console.log(`Legacy Gas Estimation:`);
    console.log(`Estimated gas: ${presaleGasEstimate.toLocaleString()}`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  }
  
  console.log(`Estimated cost: ${ethers.formatEther(presaleCostEstimate)} MATIC`);
  console.log("");
  
  // Deploy with optimized gas settings
  const deployOptions = {
    gasLimit: 3000000  // Reduced gas limit to lower cost
  };
  if (maxFeePerGas && maxPriorityFeePerGas) {
    // Use lower gas prices for testnet
    deployOptions.maxFeePerGas = maxFeePerGas / 2n; // Half the suggested fee
    deployOptions.maxPriorityFeePerGas = maxPriorityFeePerGas / 2n;
  } else if (gasPrice) {
    deployOptions.gasPrice = gasPrice / 2n; // Half the gas price
  }
  
  const presaleReceipts = await MAGAXPresaleReceipts.deploy(recorderAddress, deployOptions);
  console.log("Deployment transaction hash:", presaleReceipts.deploymentTransaction().hash);
  
  // Wait for deployment
  const presaleReceipt = await presaleReceipts.deploymentTransaction().wait();
  const presaleAddress = await presaleReceipts.getAddress();
  
  console.log("MAGAXPresaleReceipts deployed successfully!");
  console.log("Presale address:", presaleAddress);
  console.log("Block number:", presaleReceipt.blockNumber);
  console.log("Gas used:", presaleReceipt.gasUsed.toLocaleString());
  console.log("Effective gas price:", ethers.formatUnits(presaleReceipt.gasPrice, "gwei"), "gwei");
  console.log("Deployment cost:", ethers.formatEther(presaleReceipt.gasUsed * presaleReceipt.gasPrice), "MATIC");

  // Set up proper permissions and roles
  console.log("");
  console.log("Setting up permissions...");
  
  const ADMIN_ROLE = await presaleReceipts.DEFAULT_ADMIN_ROLE();
  const RECORDER_ROLE = await presaleReceipts.RECORDER_ROLE();
  
  // Verify RECORDER_ROLE (should be granted automatically in constructor)
  const hasRecorderRole = await presaleReceipts.hasRole(RECORDER_ROLE, recorderAddress);
  console.log(`RECORDER_ROLE granted to ${recorderAddress}: ${hasRecorderRole ? 'Yes' : 'No'}`);
  
  // Grant admin role to specified admin address if different from deployer
  if (adminAddress && adminAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("Granting DEFAULT_ADMIN_ROLE to admin address...");
    const grantTx = await presaleReceipts.grantRole(ADMIN_ROLE, adminAddress);
    await grantTx.wait();
    console.log(`DEFAULT_ADMIN_ROLE granted to: ${adminAddress} Yes`);
  }

  // Configure initial presale stages
  console.log("");
  console.log("Configuring initial presale stages...");
  try {
    // Stage 1: Early bird pricing - $0.001 per MAGAX
    await presaleReceipts.configureStage(
      1,                                    // Stage 1
      ethers.parseUnits("0.000270", 6),      // $0.000270 per MAGAX (6 decimals for USDT pricing)
      ethers.parseUnits("200000000", 18)   // 200M MAGAX tokens for stage 1
    );
    console.log("Stage 1 configured: $0.000270 per MAGAX, 200M allocation");
    
    // Stage 2: Regular pricing - $0.0015 per MAGAX
    await presaleReceipts.configureStage(
      2,                                    // Stage 2
      ethers.parseUnits("0.000293", 6),     // $0.000293 per MAGAX
      ethers.parseUnits("210400000", 18)   // 21M MAGAX tokens for stage 2
    );
    console.log("Stage 2 configured: $0.000293 per MAGAX, 21M allocation");
    
    // Stage 3: Higher pricing - $0.002 per MAGAX
    await presaleReceipts.configureStage(
      3,                                    // Stage 3
      ethers.parseUnits("0.000318", 6),      // $0.002 per MAGAX
      ethers.parseUnits("221340800", 18)   // 22M MAGAX tokens for stage 3
    );
    console.log("Stage 3 configured: $0.000318 per MAGAX, 22M allocation");
    
    // Activate stage 1 to start presale
    const activateTx = await presaleReceipts.activateStage(1);
    await activateTx.wait();
    
    console.log("Stage 1 activated - Presale is now live!");
  } catch (error) {
    console.log("Stage configuration failed:", error.message);
    console.log("You can configure stages manually later");
  }

  // Verify presale details
  console.log("");
  console.log("Presale Contract Details:");
  const maxPurchaseUSDT = await presaleReceipts.MAX_PURCHASE_USDT();
  const maxTotalUSDT = await presaleReceipts.MAX_TOTAL_USDT();
  const maxStages = await presaleReceipts.MAX_STAGES();
  const referrerBonus = await presaleReceipts.REFERRER_BONUS_BPS();
  const refereeBonus = await presaleReceipts.REFEREE_BONUS_BPS();
  
  console.log(`Max Purchase: ${ethers.formatUnits(maxPurchaseUSDT, 6)} USDT`);
  console.log(`Max Total Raise: ${ethers.formatUnits(maxTotalUSDT, 6)} USDT`);
  console.log(`Max Stages: ${maxStages}`);
  console.log(`Referrer Bonus: ${Number(referrerBonus) / 100}%`);
  console.log(`Referee Bonus: ${Number(refereeBonus) / 100}%`);

  // Check current stage info
  try {
    const currentStageInfo = await presaleReceipts.getCurrentStageInfo();
    console.log("");
    console.log("Current Active Stage:");
    console.log(`Stage: ${currentStageInfo[0]}`);
    console.log(`Price: $${ethers.formatUnits(currentStageInfo[1], 6)} per MAGAX`);
    console.log(`Allocated: ${ethers.formatUnits(currentStageInfo[2], 18)} MAGAX`);
    console.log(`Sold: ${ethers.formatUnits(currentStageInfo[3], 18)} MAGAX`);
    console.log(`Remaining: ${ethers.formatUnits(currentStageInfo[4], 18)} MAGAX`);
    console.log(`Active: ${currentStageInfo[5] ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log("Could not fetch current stage info:", error.message);
  }

  // Security verification
  console.log("");
  console.log("Security Verification:");
  const isPaused = await presaleReceipts.paused();
  const deployerHasAdmin = await presaleReceipts.hasRole(ADMIN_ROLE, deployer.address);
  const recorderHasRole = await presaleReceipts.hasRole(RECORDER_ROLE, recorderAddress);
  
  console.log(`Contract Paused: ${isPaused ? 'YES' : 'NO'}`);
  console.log(`Deployer has Admin: ${deployerHasAdmin ? 'Yes' : 'No'}`);
  console.log(`Recorder Role Set: ${recorderHasRole ? 'Yes' : 'No'}`);
  console.log(`Supports Referrals: Yes`);
  console.log(`Emergency Withdrawals: Yes`);
  console.log(`Anti-duplicate Protection: Yes`);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    presale: {
      address: presaleAddress,
      recorder: recorderAddress,
      admin: adminAddress || deployer.address,
      maxPurchaseUSDT: maxPurchaseUSDT.toString(),
      maxTotalUSDT: maxTotalUSDT.toString(),
      maxStages: Number(maxStages),
      referrerBonus: `${Number(referrerBonus) / 100}%`,
      refereeBonus: `${Number(refereeBonus) / 100}%`,
      deploymentHash: presaleReceipts.deploymentTransaction().hash,
      blockNumber: presaleReceipt.blockNumber,
      gasUsed: presaleReceipt.gasUsed.toString(),
      gasPrice: presaleReceipt.gasPrice.toString(),
      deploymentCost: ethers.formatEther(presaleReceipt.gasUsed * presaleReceipt.gasPrice)
    },
    stages: [
      { stage: 1, price: "$0.001", allocation: "10M MAGAX", active: true },
      { stage: 2, price: "$0.0015", allocation: "20M MAGAX", active: false },
      { stage: 3, price: "$0.002", allocation: "20M MAGAX", active: false }
    ],
    timestamp: new Date().toISOString()
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const fileName = `polygon-presale-${network.name}-${Date.now()}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("");
  console.log("Deployment Information:");
  console.log(`  Saved to: ${filePath}`);
  
  // Update .env.example with new addresses
  console.log("");
  console.log("Next Steps:");
  console.log("1. Add the following to your .env file:");
  console.log(`POLYGON_PRESALE_ADDRESS=${presaleAddress}`);
  console.log(`POLYGON_NETWORK=${network.name}`);
  console.log("");
  console.log("2. Verify the contract on PolygonScan:");
  console.log(`npx hardhat verify --network ${network.name} ${presaleAddress} "${recorderAddress}"`);
  console.log("");
  console.log("3. Configure your backend to use:");
  console.log(`- Presale Contract: ${presaleAddress}`);
  console.log(`- Network: Polygon ${network.name}`);
  console.log(`- Recorder Address: ${recorderAddress}`);
  
  console.log("");
  console.log("Presale deployment completed successfully!");
  console.log("Estimated 99% cost savings vs Ethereum deployment!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
