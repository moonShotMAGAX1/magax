const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Timelock Test", function () {
    let presale, owner;
    
    before(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy presale without timelock
        const MAGAXPresale = await ethers.getContractFactory("MAGAXPresaleReceipts");
        presale = await MAGAXPresale.deploy(owner.address, owner.address, owner.address); // Use owner for all roles in test
        await presale.waitForDeployment();
    });
    
    it("Should allow pause/unpause without timelock", async function () {
        await expect(presale.connect(owner).pause()).to.not.be.reverted;
        await expect(presale.connect(owner).unpause()).to.not.be.reverted;
    });
    
    it("Should allow stage configuration without timelock", async function () {
        await expect(
            presale.connect(owner).configureStage(
                1,
                ethers.parseUnits("0.1", 6),     // price per token
                ethers.parseUnits("1000000", 18), // tokens allocated
                ethers.parseUnits("500000", 6)    // usd target
            )
        ).to.not.be.reverted;
    });
});
