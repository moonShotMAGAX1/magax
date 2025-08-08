const { ethers } = require("ethers");

/**
 * TimelockService - Handles 48-hour timelock operations for MAGAX presale
 */
class TimelockService {
    constructor(timelockAddress, presaleAddress, provider, signer) {
        this.timelockAddress = timelockAddress;
        this.presaleAddress = presaleAddress;
        this.provider = provider;
        this.signer = signer;
        
        // Load contract ABIs (you'll need to import these)
        this.timelock = new ethers.Contract(
            timelockAddress,
            require("../artifacts/@openzeppelin/contracts/governance/TimelockController.sol/TimelockController.json").abi,
            signer
        );
        
        this.presale = new ethers.Contract(
            presaleAddress,
            require("../artifacts/contracts/PreSaleOnChain.sol/MAGAXPresaleReceipts.json").abi,
            signer
        );
    }
    
    /**
     * Schedule presale finalization (starts 48h timer)
     */
    async proposeFinalization() {
        console.log("📅 Scheduling presale finalization (48h delay)...");
        
        try {
            // Encode the function call
            const data = this.presale.interface.encodeFunctionData("finalise");
            const target = this.presaleAddress;
            const value = 0;
            const salt = ethers.randomBytes(32);
            const delay = 48 * 60 * 60; // 48 hours
            
            // Schedule the operation
            const tx = await this.timelock.schedule(
                target,
                value,
                data,
                ethers.ZeroHash, // predecessor
                salt,
                delay
            );
            
            const receipt = await tx.wait();
            const operationId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "bytes", "bytes32", "bytes32"],
                    [target, value, data, ethers.ZeroHash, salt]
                )
            );
            
            console.log("✅ Finalization scheduled successfully!");
            console.log("  Transaction hash:", receipt.hash);
            console.log("  Operation ID:", operationId);
            console.log("  Execute after:", new Date(Date.now() + delay * 1000).toISOString());
            
            return {
                operationId,
                txHash: receipt.hash,
                executeAfter: Date.now() + delay * 1000,
                salt: ethers.hexlify(salt)
            };
            
        } catch (error) {
            console.error("❌ Failed to schedule finalization:", error.message);
            throw error;
        }
    }
    
    /**
     * Execute presale finalization (after 48h delay)
     */
    async executeFinalization(salt) {
        console.log("🚀 Executing presale finalization...");
        
        try {
            const data = this.presale.interface.encodeFunctionData("finalise");
            const target = this.presaleAddress;
            const value = 0;
            
            // Check if ready to execute
            const operationId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "bytes", "bytes32", "bytes32"],
                    [target, value, data, ethers.ZeroHash, salt]
                )
            );
            
            const isReady = await this.timelock.isOperationReady(operationId);
            if (!isReady) {
                throw new Error("Operation not ready for execution yet");
            }
            
            // Execute the operation
            const tx = await this.timelock.execute(
                target,
                value,
                data,
                ethers.ZeroHash,
                salt
            );
            
            const receipt = await tx.wait();
            
            console.log("✅ Finalization executed successfully!");
            console.log("  Transaction hash:", receipt.hash);
            console.log("  Block number:", receipt.blockNumber);
            
            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error) {
            console.error("❌ Failed to execute finalization:", error.message);
            throw error;
        }
    }
    
    /**
     * Schedule max promo BPS update
     */
    async proposeMaxPromoBpsUpdate(newCap) {
        console.log(`📅 Scheduling max promo BPS update to ${newCap} (48h delay)...`);
        
        try {
            const data = this.presale.interface.encodeFunctionData("setMaxPromoBps", [newCap]);
            const target = this.presaleAddress;
            const value = 0;
            const salt = ethers.randomBytes(32);
            const delay = 48 * 60 * 60; // 48 hours
            
            const tx = await this.timelock.schedule(
                target,
                value,
                data,
                ethers.ZeroHash,
                salt,
                delay
            );
            
            const receipt = await tx.wait();
            
            console.log("✅ Max promo BPS update scheduled successfully!");
            console.log("  New cap:", newCap, "BPS");
            console.log("  Transaction hash:", receipt.hash);
            console.log("  Execute after:", new Date(Date.now() + delay * 1000).toISOString());
            
            return {
                txHash: receipt.hash,
                executeAfter: Date.now() + delay * 1000,
                salt: ethers.hexlify(salt),
                newCap
            };
            
        } catch (error) {
            console.error("❌ Failed to schedule max promo BPS update:", error.message);
            throw error;
        }
    }
    
    /**
     * Schedule emergency token withdrawal (48h delay)
     */
    async proposeEmergencyWithdraw(tokenAddress, toAddress) {
        console.log("📅 Scheduling emergency token withdrawal (48h delay)...");
        
        try {
            const data = this.presale.interface.encodeFunctionData("emergencyTokenWithdraw", [
                tokenAddress,
                toAddress
            ]);
            const target = this.presaleAddress;
            const value = 0;
            const salt = ethers.randomBytes(32);
            const delay = 48 * 60 * 60; // 48 hours
            
            const tx = await this.timelock.schedule(
                target,
                value,
                data,
                ethers.ZeroHash,
                salt,
                delay
            );
            
            const receipt = await tx.wait();
            
            console.log("✅ Emergency withdrawal scheduled successfully!");
            console.log("  Token:", tokenAddress);
            console.log("  To:", toAddress);
            console.log("  Transaction hash:", receipt.hash);
            console.log("  Execute after:", new Date(Date.now() + delay * 1000).toISOString());
            
            return {
                txHash: receipt.hash,
                executeAfter: Date.now() + delay * 1000,
                salt: ethers.hexlify(salt),
                tokenAddress,
                toAddress
            };
            
        } catch (error) {
            console.error("❌ Failed to schedule emergency withdrawal:", error.message);
            throw error;
        }
    }
    
    /**
     * Immediate emergency withdrawal (requires 3-of-N multi-sig, no delay)
     * Use this only for critical situations that cannot wait 48 hours
     */
    async immediateEmergencyWithdraw(tokenAddress, toAddress) {
        console.log("🚨 Initiating immediate emergency withdrawal (3-sig required)...");
        
        try {
            const tx = await this.presale.immediateEmergencyWithdraw(tokenAddress, toAddress);
            const receipt = await tx.wait();
            
            console.log("✅ Immediate emergency withdrawal step completed!");
            console.log("  Transaction hash:", receipt.hash);
            console.log("  Note: Requires 3 EMERGENCY_ROLE confirmations total");
            
            return {
                txHash: receipt.hash
            };
            
        } catch (error) {
            console.error("❌ Failed immediate emergency withdrawal:", error.message);
            throw error;
        }
    }
    
    /**
     * Cancel a pending timelock operation
     */
    async cancelOperation(operationId) {
        console.log("❌ Canceling timelock operation...");
        
        try {
            const tx = await this.timelock.cancel(operationId);
            const receipt = await tx.wait();
            
            console.log("✅ Operation canceled successfully!");
            console.log("  Operation ID:", operationId);
            console.log("  Transaction hash:", receipt.hash);
            
            return {
                txHash: receipt.hash
            };
            
        } catch (error) {
            console.error("❌ Failed to cancel operation:", error.message);
            throw error;
        }
    }
    
    /**
     * Check if operation is ready for execution
     */
    async isOperationReady(operationId) {
        try {
            const isReady = await this.timelock.isOperationReady(operationId);
            const isPending = await this.timelock.isOperationPending(operationId);
            const isDone = await this.timelock.isOperationDone(operationId);
            
            return {
                isReady,
                isPending,
                isDone,
                operationId
            };
        } catch (error) {
            console.error("❌ Failed to check operation status:", error.message);
            throw error;
        }
    }
    
    /**
     * Get timelock information
     */
    async getTimelockInfo() {
        try {
            const minDelay = await this.timelock.getMinDelay();
            
            return {
                address: this.timelockAddress,
                minDelay: minDelay.toString(),
                minDelayHours: Number(minDelay) / 3600
            };
        } catch (error) {
            console.error("❌ Failed to get timelock info:", error.message);
            throw error;
        }
    }
}

module.exports = { TimelockService };
