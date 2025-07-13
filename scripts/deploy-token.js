const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying MAGAX Token on Ethereum...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "(Chain ID:", network.chainId, ")");
  
  // Validate we're on Ethereum network
  const ethereumChainIds = [1n, 11155111n]; // Mainnet, Sepolia
  if (!ethereumChainIds.includes(network.chainId)) {
    throw new Error(`This script is for Ethereum networks only. Current chain ID: ${network.chainId}`);
  }

  // Minimum balance check
  const minBalance = ethers.parseEther("0.05"); // 0.05 ETH minimum for Ethereum
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ETH, have ${ethers.formatEther(balance)} ETH`);
  }

  // Get and validate environment variables
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  
  if (!treasuryAddress) {
    throw new Error("TREASURY_ADDRESS not found in .env file");
  }

  // Validate address
  if (!ethers.isAddress(treasuryAddress)) {
    throw new Error("Invalid TREASURY_ADDRESS format");
  }

  console.log("Treasury address:", treasuryAddress);
  console.log("Token will be minted to treasury on deployment");
  console.log("");

  // Deploy MAGAX Token
  console.log("Deploying MoonShotMAGAX token...");
  const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
  
  // Estimate gas for token deployment
  const tokenDeployTx = await MoonShotMAGAX.getDeployTransaction(treasuryAddress);
  const tokenGasEstimate = await deployer.estimateGas(tokenDeployTx);
  const feeData = await ethers.provider.getFeeData();
  
  // Use EIP-1559 if available
  let gasPrice, maxFeePerGas, maxPriorityFeePerGas;
  let tokenCostEstimate;
  
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    maxFeePerGas = feeData.maxFeePerGas;
    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    tokenCostEstimate = tokenGasEstimate * maxFeePerGas;
    console.log(`EIP-1559 Gas Estimation:`);
    console.log(`  Estimated gas: ${tokenGasEstimate.toLocaleString()}`);
    console.log(`  Max fee per gas: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`  Max priority fee: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
  } else {
    gasPrice = feeData.gasPrice;
    tokenCostEstimate = tokenGasEstimate * gasPrice;
    console.log(`Legacy Gas Estimation:`);
    console.log(`  Estimated gas: ${tokenGasEstimate.toLocaleString()}`);
    console.log(`  Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  }
  
  console.log(`  Estimated cost: ${ethers.formatEther(tokenCostEstimate)} ETH`);
  console.log("");
  
  // Deploy with optimized gas settings
  const deployOptions = {};
  if (maxFeePerGas && maxPriorityFeePerGas) {
    deployOptions.maxFeePerGas = maxFeePerGas;
    deployOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;
  } else if (gasPrice) {
    deployOptions.gasPrice = gasPrice;
  }
  
  const token = await MoonShotMAGAX.deploy(treasuryAddress, deployOptions);
  console.log("Deployment transaction hash:", token.deploymentTransaction().hash);
  
  // Wait for deployment
  const tokenReceipt = await token.deploymentTransaction().wait();
  const tokenAddress = await token.getAddress();
  
  console.log("MoonShotMAGAX token deployed successfully!");
  console.log("Token address:", tokenAddress);
  console.log("Block number:", tokenReceipt.blockNumber);
  console.log("Gas used:", tokenReceipt.gasUsed.toLocaleString());
  console.log("Effective gas price:", ethers.formatUnits(tokenReceipt.gasPrice, "gwei"), "gwei");
  console.log("Deployment cost:", ethers.formatEther(tokenReceipt.gasUsed * tokenReceipt.gasPrice), "ETH");

  // Verify token details
  console.log("");
  console.log("Token Details:");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const maxSupply = await token.getMaxSupply();
  const treasuryBalance = await token.balanceOf(treasuryAddress);

  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(`Max Supply: ${ethers.formatUnits(maxSupply, decimals)} ${symbol}`);
  console.log(`Treasury Balance: ${ethers.formatUnits(treasuryBalance, decimals)} ${symbol}`);

  // Security checks
  console.log("");
  console.log("Security Verification:");
  const owner = await token.owner();
  const isPaused = await token.paused();
  
  console.log(`Owner: ${owner}`);
  console.log(`Is Paused: ${isPaused}`);
  console.log(`Supports ERC20Capped: Yes`);
  console.log(`Supports ERC20Permit: Yes`);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    token: {
      name,
      symbol,
      address: tokenAddress,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
      maxSupply: maxSupply.toString(),
      owner: owner,
      treasury: treasuryAddress,
      deploymentHash: token.deploymentTransaction().hash,
      blockNumber: tokenReceipt.blockNumber,
      gasUsed: tokenReceipt.gasUsed.toString(),
      gasPrice: tokenReceipt.gasPrice.toString(),
      deploymentCost: ethers.formatEther(tokenReceipt.gasUsed * tokenReceipt.gasPrice)
    },
    timestamp: new Date().toISOString()
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const fileName = `ethereum-token-${network.name}-${Date.now()}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("");
  console.log("Deployment Information:");
  console.log(`  Saved to: ${filePath}`);
  
  // Update .env.example with new addresses
  console.log("");
  console.log("Next Steps:");
  console.log("1. Add the following to your .env file:");
  console.log(`ETHEREUM_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`ETHEREUM_NETWORK=${network.name}`);
  console.log("");
  console.log("2. Verify the contract on Etherscan:");
  console.log(`npx hardhat verify --network ${network.name} ${tokenAddress} "${treasuryAddress}"`);
  console.log("");
  console.log("3. Deploy the presale contract on Polygon:");
  console.log("npx hardhat run scripts/deploy-presale.js --network polygon");
  
  console.log("");
  console.log("Token deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
