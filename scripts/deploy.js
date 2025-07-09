const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MAGAX Token and Presale Contracts...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get environment variables
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const recorderAddress = process.env.RECORDER_ADDRESS;
  
  if (!treasuryAddress || !recorderAddress) {
    throw new Error("TREASURY_ADDRESS or RECORDER_ADDRESS not found in .env file");
  }

  console.log("Treasury address:", treasuryAddress);
  console.log("Recorder address:", recorderAddress);
  console.log("");

  // Deploy MAGAX Token
  console.log("Deploying MoonShotMAGAX token...");
  const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
  const token = await MoonShotMAGAX.deploy(treasuryAddress);
  await token.waitForDeployment();
  
  const tokenAddress = await token.getAddress();
  console.log("MoonShotMAGAX token deployed to:", tokenAddress);

  // Deploy Presale Receipts
  console.log("Deploying MAGAXPresaleReceipts...");
  const MAGAXPresaleReceipts = await ethers.getContractFactory("MAGAXPresaleReceipts");
  const presaleReceipts = await MAGAXPresaleReceipts.deploy(recorderAddress);
  await presaleReceipts.waitForDeployment();

  const presaleAddress = await presaleReceipts.getAddress();
  console.log("MAGAXPresaleReceipts deployed to:", presaleAddress);

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
  console.log("Paused:", await presaleReceipts.paused());

  // Summary
  console.log("\nDeployment Summary:");
  console.log("Token Contract:", tokenAddress);
  console.log("Presale Contract:", presaleAddress);
  console.log("Treasury Address:", treasuryAddress);
  console.log("Recorder Address:", recorderAddress);
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Block Number:", await ethers.provider.getBlockNumber());

  console.log("\nDeployment completed successfully!");
  console.log("Save these contract addresses for future reference!");

  return {
    token: tokenAddress,
    presale: presaleAddress,
    treasury: treasuryAddress,
    recorder: recorderAddress
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });