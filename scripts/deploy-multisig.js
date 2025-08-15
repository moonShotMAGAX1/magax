const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying SimpleMultiSig for testnet...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Replace with your actual test addresses
    const owners = [
        deployer.address,                                      // Your address
        "0x2345678901234567890123456789012345678901",         // Test address 2
        "0x3456789012345678901234567890123456789012"          // Test address 3
    ];
    
    const required = 2; // 2-of-3 multi-sig
    
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
    
    console.log("\n📝 Add this to your .env file:");
    console.log(`TIMELOCK_PROPOSERS=${multiSigAddress}`);
    console.log(`TIMELOCK_EXECUTORS=${multiSigAddress}`);
    
    return multiSigAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
