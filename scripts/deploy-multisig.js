const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying SimpleMultiSig for testnet...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Get owners from environment or use defaults
    const owner1 = process.env.MULTISIG_OWNER_1;
    const owner2 = process.env.MULTISIG_OWNER_2;
    
    const owners = [owner1, owner2];
    const required = parseInt(process.env.MULTISIG_REQUIRED || "2"); // 2-of-2 by default
    
    console.log("Multi-sig configuration:");
    console.log("Owners:", owners);
    console.log("Required signatures:", required);
    
    const SimpleMultiSig = await ethers.getContractFactory("SimpleMultiSig");
    const multiSig = await SimpleMultiSig.deploy(owners, required);
    
    await multiSig.waitForDeployment();
    const multiSigAddress = await multiSig.getAddress();
    
    console.log("✅ SimpleMultiSig deployed to:", multiSigAddress);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    
    // Verify configuration
    const actualOwners = await multiSig.getOwners();
    const actualRequired = await multiSig.required();
    
    console.log("\nDeployment verification:");
    console.log("Actual owners:", actualOwners);
    console.log("Actual required:", actualRequired.toString());
    
    console.log("\n📝 Add these to your .env file:");
    console.log(`SIMPLE_MULTISIG_ADDRESS=${multiSigAddress}`);
    console.log(`MULTISIG_PROPOSER_1_ADDRESS=${multiSigAddress}`);
    console.log("\n📋 Next steps:");
    console.log("1. Add SIMPLE_MULTISIG_ADDRESS to .env");
    console.log("2. Deploy timelock: npx hardhat run scripts/deploy-timelock.js --network amoy");
    console.log("3. Copy timelock address to ADMIN_ADDRESS in .env");
    console.log("4. Deploy presale: npx hardhat run scripts/deploy.js --network amoy");
    console.log("\n📝 Add this to your .env file:");
    console.log(`TIMELOCK_PROPOSERS=${multiSigAddress}`);
    
    return multiSigAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
