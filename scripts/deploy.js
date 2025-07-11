const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying MAGAX Token and Presale Contracts...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "(Chain ID:", network.chainId, ")");

  // Minimum balance check
  const minBalance = ethers.parseEther("0.01"); // 0.01 ETH minimum
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ETH, have ${ethers.formatEther(balance)} ETH`);
  }

  // Get and validate environment variables
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const recorderAddress = process.env.RECORDER_ADDRESS;
  
  if (!treasuryAddress || !recorderAddress) {
    throw new Error("TREASURY_ADDRESS or RECORDER_ADDRESS not found in .env file");
  }

  // Validate addresses
  if (!ethers.isAddress(treasuryAddress)) {
    throw new Error("Invalid TREASURY_ADDRESS format");
  }
  if (!ethers.isAddress(recorderAddress)) {
    throw new Error("Invalid RECORDER_ADDRESS format");
  }

  console.log("Treasury address:", treasuryAddress);
  console.log("Recorder address:", recorderAddress);
  console.log("");

  // Deploy MAGAX Token
  console.log(" Deploying MoonShotMAGAX token...");
  const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
  
  // Estimate gas for token deployment
  const tokenDeployTx = await MoonShotMAGAX.getDeployTransaction(treasuryAddress);
  const tokenGasEstimate = await ethers.provider.estimateGas(tokenDeployTx);
  const gasPrice = await ethers.provider.getGasPrice();
  const tokenCostEstimate = tokenGasEstimate * gasPrice;
  
  console.log(`Estimated gas: ${tokenGasEstimate.toLocaleString()}`);
  console.log(`Estimated cost: ${ethers.formatEther(tokenCostEstimate)} ETH`);
  
  const token = await MoonShotMAGAX.deploy(treasuryAddress);
  await token.waitForDeployment();
  
  const tokenAddress = await token.getAddress();
  console.log(" MoonShotMAGAX token deployed to:", tokenAddress);

  // Deploy Presale Receipts
  console.log("\n Deploying MAGAXPresaleReceipts...");
  const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
  
  // Estimate gas for presale deployment
  const presaleDeployTx = await MAGAXPresaleReceipts.getDeployTransaction(recorderAddress);
  const presaleGasEstimate = await ethers.provider.estimateGas(presaleDeployTx);
  const presaleCostEstimate = presaleGasEstimate * gasPrice;
  
  console.log(`Estimated gas: ${presaleGasEstimate.toLocaleString()}`);
  console.log(`Estimated cost: ${ethers.formatEther(presaleCostEstimate)} ETH`);
  
  const presaleReceipts = await MAGAXPresaleReceipts.deploy(recorderAddress);
  await presaleReceipts.waitForDeployment();

  const presaleAddress = await presaleReceipts.getAddress();
  console.log(" MAGAXPresaleReceipts deployed to:", presaleAddress);

  // Configure initial stage (optional but recommended)
  console.log("\n Configuring initial presale stage...");
  try {
    // Stage 1: Early bird pricing
    await presaleReceipts.configureStage(
      1,                                    // Stage 1
      ethers.parseUnits("0.001", 6),      // $0.001 per MAGAX (6 decimals for USDT)
      ethers.parseUnits("1000000", 18)    // 1M MAGAX tokens (18 decimals)
    );
    
    // Activate stage 1
    await presaleReceipts.activateStage(1);
    
    console.log(" Stage 1 configured and activated");
    console.log("   Price: $0.001 per MAGAX");
    console.log("   Allocation: 1,000,000 MAGAX");
  } catch (error) {
    console.log(" Stage configuration failed:", error.message);
    console.log("   You can configure stages manually later");
  }

  // Verify token details
  console.log("\nToken Details:");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const treasuryBalance = await token.balanceOf(treasuryAddress);

  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals);
  console.log("Total Supply:", ethers.formatUnits(totalSupply, decimals));
  console.log("Treasury Balance:", ethers.formatUnits(treasuryBalance, decimals));

  // Verify presale roles
  console.log("\nPresale Roles:");
  const adminRole = await presaleReceipts.DEFAULT_ADMIN_ROLE();
  const recorderRole = await presaleReceipts.RECORDER_ROLE();
  
  const hasAdminRole = await presaleReceipts.hasRole(adminRole, deployer.address);
  const hasRecorderRole = await presaleReceipts.hasRole(recorderRole, recorderAddress);
  
  console.log("Admin role (deployer):", hasAdminRole ? "Yes" : "No");
  console.log("Recorder role:", hasRecorderRole ? "Yes" : "No");
  console.log("Contract paused:", await presaleReceipts.paused() ? "Yes" : "No");

  // Get current stage info if configured
  try {
    const currentStageInfo = await presaleReceipts.getCurrentStageInfo();
    if (currentStageInfo.isActive) {
      console.log("\n Current Stage Info:");
      console.log("Stage:", currentStageInfo.stage.toString());
      console.log("Price per token:", ethers.formatUnits(currentStageInfo.pricePerToken, 6), "USDT");
      console.log("Tokens allocated:", ethers.formatUnits(currentStageInfo.tokensAllocated, 18));
      console.log("Tokens remaining:", ethers.formatUnits(currentStageInfo.tokensRemaining, 18));
    }
  } catch (error) {
    console.log("\n No active stage configured");
  }

  // Calculate total deployment cost
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const totalCost = balance - finalBalance;

  // Create deployment info object
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    deployer: {
      address: deployer.address,
      initialBalance: ethers.formatEther(balance),
      finalBalance: ethers.formatEther(finalBalance),
      totalCost: ethers.formatEther(totalCost),
    },
    contracts: {
      token: {
        name: "MoonShotMAGAX",
        address: tokenAddress,
        gasUsed: tokenGasEstimate.toString(),
        estimatedCost: ethers.formatEther(tokenCostEstimate),
      },
      presale: {
        name: "MAGAXPresaleReceipts", 
        address: presaleAddress,
        gasUsed: presaleGasEstimate.toString(),
        estimatedCost: ethers.formatEther(presaleCostEstimate),
      },
    },
    configuration: {
      treasury: treasuryAddress,
      recorder: recorderAddress,
    },
    deployment: {
      timestamp: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber(),
    },
  };

  // Save deployment info to file
  try {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n Deployment info saved to: deployments/${filename}`);
  } catch (error) {
    console.log("\n Failed to save deployment info:", error.message);
  }

  // Summary
  console.log("\n Deployment Summary:");
  console.log("═".repeat(50));
  console.log("Token Contract:", tokenAddress);
  console.log("Presale Contract:", presaleAddress);
  console.log("Treasury Address:", treasuryAddress);
  console.log("Recorder Address:", recorderAddress);
  console.log("Network:", network.name, `(${network.chainId})`);
  console.log("Block Number:", await ethers.provider.getBlockNumber());
  console.log("Total Cost:", ethers.formatEther(totalCost), "ETH");
  console.log("═".repeat(50));

  console.log("\n Next Steps:");
  console.log("1. Verify contracts on Etherscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${tokenAddress} "${treasuryAddress}"`);
  console.log(`   npx hardhat verify --network ${network.name} ${presaleAddress} "${recorderAddress}"`);
  console.log("2. Configure additional presale stages if needed");
  console.log("3. Set up monitoring and analytics");
  console.log("4. Test purchase recording functionality");

  if (network.name === "sepolia") {
    console.log("\n Useful Links:");
    console.log(`Token: https://sepolia.etherscan.io/address/${tokenAddress}`);
    console.log(`Presale: https://sepolia.etherscan.io/address/${presaleAddress}`);
  } else if (network.name === "mainnet") {
    console.log("\n Useful Links:");
    console.log(`Token: https://etherscan.io/address/${tokenAddress}`);
    console.log(`Presale: https://etherscan.io/address/${presaleAddress}`);
  }

  console.log("\n Deployment completed successfully!");
  console.log("Save these contract addresses for future reference!");

  return {
    token: tokenAddress,
    presale: presaleAddress,
    treasury: treasuryAddress,
    recorder: recorderAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    totalCost: ethers.formatEther(totalCost),
  };
}

main()
  .then((result) => {
    console.log("\n Deployment result:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nDeployment failed:");
    console.error("Error:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.code) console.error("Code:", error.code);
    process.exit(1);
  });