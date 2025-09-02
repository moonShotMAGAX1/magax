const { ethers } = require("hardhat");

/**
 * Deploy MAGAX Timelock with Multi-Sig Governance
 * 
 * Architecture:
 * - Multi-sig contracts (Gnosis Safe, SimpleMultiSig) act as proposers/executors
 * - Timelock enforces 48-hour delays on all operations
 * - Presale contract receives admin commands only from timelock
 * - No individual EOAs have direct timelock control in production
 */

async function deployTimelock() {
    console.log("Deploying MAGAX Timelock with 48-hour delay...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // 48-hour delay (172800 seconds)
    const minDelay = 48 * 60 * 60;
    console.log("Timelock delay:", minDelay, "seconds (48 hours)");
    
    // Multi-sig contract addresses that can propose/execute
    // Use actual multi-sig contract addresses (e.g., Gnosis Safe, SimpleMultiSig)
    const proposers = [
        process.env.MULTISIG_PROPOSER_1_ADDRESS,  // Primary multi-sig contract
        process.env.MULTISIG_PROPOSER_2_ADDRESS,  // Secondary multi-sig contract
        process.env.GNOSIS_SAFE_ADDRESS,         // Gnosis Safe contract
        process.env.SIMPLE_MULTISIG_ADDRESS      // SimpleMultiSig contract
    ].filter(addr => addr && addr !== ""); // Remove empty addresses
    
    // Validate that we have at least one multi-sig address
    if (proposers.length === 0) {
        console.warn("⚠️  No multi-sig addresses configured, using deployer as fallback");
        proposers.push(deployer.address);
    }
    
    const executors = proposers; // Same multi-sig contracts can execute
    const admin = ethers.ZeroAddress; // No admin role for full decentralization
    
    console.log("Multi-sig Proposers/Executors:", proposers);
    console.log("Expected contract types: Gnosis Safe, SimpleMultiSig, or similar");
    
    // Deploy timelock
    const MAGAXTimelock = await ethers.getContractFactory("MAGAXTimelock");
    const timelock = await MAGAXTimelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    
    const timelockAddress = await timelock.getAddress();
    console.log("✅ Timelock deployed to:", timelockAddress);
    
    // Verify deployment
    const deployedDelay = await timelock.getMinDelay();
    console.log("✅ Verified delay:", deployedDelay.toString(), "seconds");
    
    return {
        timelock,
        address: timelockAddress,
        delay: deployedDelay.toString()
    };
}

// Legacy combo deployment removed — this script now deploys ONLY the timelock.

async function main() {
    try {
        const { address: timelockAddress, delay } = await deployTimelock();
        const net = await ethers.provider.getNetwork();
        const [deployer] = await ethers.getSigners();
        const fs = require('fs');
        const outDir = './deployments';
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const artifact = {
            network: net.name,
            chainId: Number(net.chainId),
            timelock: timelockAddress,
            delaySeconds: delay,
            deployer: deployer.address,
            proposers: [
                process.env.MULTISIG_PROPOSER_1_ADDRESS,
                process.env.MULTISIG_PROPOSER_2_ADDRESS,
                process.env.GNOSIS_SAFE_ADDRESS,
                process.env.SIMPLE_MULTISIG_ADDRESS
            ].filter(a => a),
            timestamp: new Date().toISOString()
        };
        const file = `${outDir}/timelock-${net.name}-${Date.now()}.json`;
        fs.writeFileSync(file, JSON.stringify(artifact, null, 2));
        console.log("✅ Timelock artifact saved:", file);

        console.log("\n🎉 Timelock Deployment Summary");
        console.log("=".repeat(50));
        console.log("Network         :", net.name, `(chain ${net.chainId})`);
        console.log("Timelock Address:", timelockAddress);
        console.log("Delay (seconds) :", delay);
        console.log("Deployer        :", deployer.address);
        console.log("Proposers/Execs :", artifact.proposers.join(', '));
        console.log("=".repeat(50));

        console.log("\nNext Steps:");
        console.log("1. Export TIMelock address to .env as TIMELOCK_ADDRESS & ADMIN_ADDRESS");
        console.log("2. Deploy presale separately with this ADMIN_ADDRESS");
        console.log("3. Use multisig → timelock to schedule configureStage / activateStage / role grants");
        console.log("4. Verify contracts on explorer after indexing");
    } catch (error) {
        console.error("❌ Timelock deployment failed:", error.message);
        if (error.data) console.error("Error data:", error.data);
        process.exit(1);
    }
}

// Allow running specific functions
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployTimelock, main };
