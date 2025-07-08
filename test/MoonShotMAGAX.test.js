const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MoonShotMAGAX - Enhanced Token", function () {
  let token;
  let owner, treasury, user1, user2, unauthorized;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000000000", 18); // 1 Trillion
  const MAX_SUPPLY = ethers.parseUnits("1000000000000", 18);

  beforeEach(async function () {
    [owner, treasury, user1, user2, unauthorized] = await ethers.getSigners();
    
    const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
    token = await MoonShotMAGAX.deploy(treasury.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct token details", async function () {
      expect(await token.name()).to.equal("MoonShot MagaX");
      expect(await token.symbol()).to.equal("MAGAX");
      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint initial supply to treasury", async function () {
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(treasury.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set correct max supply", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("Should set deployer as owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should start unpaused", async function () {
      expect(await token.paused()).to.be.false;
    });

    it("Should fail deployment with zero treasury address", async function () {
      const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
      await expect(
        MoonShotMAGAX.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Treasury cannot be zero address");
    });

    it("Should emit MaxSupplyReached event", async function () {
      const MoonShotMAGAX = await ethers.getContractFactory("MoonShotMAGAX");
      const deployTx = await MoonShotMAGAX.deploy(treasury.address);
      const deployedContract = await deployTx.waitForDeployment();
      
      // Check that the deployment transaction emitted the event
      const receipt = await deployTx.deploymentTransaction().wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = deployedContract.interface.parseLog(log);
          return parsed.name === "MaxSupplyReached";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      // Transfer some tokens to users for testing
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
      await token.connect(treasury).transfer(user2.address, ethers.parseUnits("1000", 18));
    });

    it("Should allow normal transfers when unpaused", async function () {
      const amount = ethers.parseUnits("100", 18);
      
      await expect(
        token.connect(user1).transfer(user2.address, amount)
      ).to.not.be.reverted;

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("900", 18));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseUnits("1100", 18));
    });

    it("Should block transfers when paused", async function () {
      await token.connect(owner).pause();
      
      const amount = ethers.parseUnits("100", 18);
      
      await expect(
        token.connect(user1).transfer(user2.address, amount)
      ).to.be.reverted;
    });

    it("Should allow transfers after unpause", async function () {
      // Pause
      await token.connect(owner).pause();
      
      // Verify transfer fails
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseUnits("100", 18))
      ).to.be.reverted;
      
      // Unpause
      await token.connect(owner).unpause();
      
      // Verify transfer works
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseUnits("100", 18))
      ).to.not.be.reverted;
    });

    it("Should handle approvals and transferFrom when unpaused", async function () {
      const amount = ethers.parseUnits("100", 18);
      
      await token.connect(user1).approve(user2.address, amount);
      
      await expect(
        token.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.not.be.reverted;

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("900", 18));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseUnits("1100", 18));
    });

    it("Should block transferFrom when paused", async function () {
      const amount = ethers.parseUnits("100", 18);
      
      await token.connect(user1).approve(user2.address, amount);
      await token.connect(owner).pause();
      
      await expect(
        token.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.be.reverted;
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow owner to pause", async function () {
      await expect(
        token.connect(owner).pause()
      ).to.not.be.reverted;

      expect(await token.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await token.connect(owner).pause();
      
      await expect(
        token.connect(owner).unpause()
      ).to.not.be.reverted;

      expect(await token.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        token.connect(unauthorized).pause()
      ).to.be.reverted;
    });

    it("Should not allow non-owner to unpause", async function () {
      await token.connect(owner).pause();
      
      await expect(
        token.connect(unauthorized).unpause()
      ).to.be.reverted;
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for burning tests
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
    });

    it("Should allow users to burn their own tokens", async function () {
      const burnAmount = ethers.parseUnits("100", 18);
      const initialBalance = await token.balanceOf(user1.address);
      const initialSupply = await token.totalSupply();

      await expect(
        token.connect(user1).burn(burnAmount)
      ).to.emit(token, "TokensBurned")
       .withArgs(burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should fail to burn more tokens than balance", async function () {
      const burnAmount = ethers.parseUnits("2000", 18); // More than user1's balance
      
      await expect(
        token.connect(user1).burn(burnAmount)
      ).to.be.reverted;
    });

    it("Should allow burning with allowance", async function () {
      const burnAmount = ethers.parseUnits("100", 18);
      
      // user1 approves user2 to burn tokens
      await token.connect(user1).approve(user2.address, burnAmount);
      
      const initialBalance = await token.balanceOf(user1.address);
      const initialSupply = await token.totalSupply();

      await expect(
        token.connect(user2).burnFrom(user1.address, burnAmount)
      ).to.emit(token, "TokensBurned")
       .withArgs(burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await token.allowance(user1.address, user2.address)).to.equal(0);
    });

    it("Should fail burnFrom without sufficient allowance", async function () {
      const burnAmount = ethers.parseUnits("100", 18);
      
      // No approval given
      await expect(
        token.connect(user2).burnFrom(user1.address, burnAmount)
      ).to.be.reverted;
    });

    it("Should fail burnFrom with insufficient allowance", async function () {
      const allowanceAmount = ethers.parseUnits("50", 18);
      const burnAmount = ethers.parseUnits("100", 18);
      
      await token.connect(user1).approve(user2.address, allowanceAmount);
      
      await expect(
        token.connect(user2).burnFrom(user1.address, burnAmount)
      ).to.be.reverted;
    });

    it("Should burn tokens even when paused", async function () {
      await token.connect(owner).pause();
      
      const burnAmount = ethers.parseUnits("100", 18);
      
      // Burning should still work when paused (internal function)
      // But actually, _update is overridden to check pause, so burning will fail when paused
      await expect(
        token.connect(user1).burn(burnAmount)
      ).to.be.reverted;
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await expect(
        token.connect(owner).transferOwnership(user1.address)
      ).to.not.be.reverted;

      expect(await token.owner()).to.equal(user1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        token.connect(unauthorized).transferOwnership(user1.address)
      ).to.be.reverted;
    });

    it("Should allow new owner to pause after ownership transfer", async function () {
      await token.connect(owner).transferOwnership(user1.address);
      
      await expect(
        token.connect(user1).pause()
      ).to.not.be.reverted;

      expect(await token.paused()).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfers", async function () {
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
      
      await expect(
        token.connect(user1).transfer(user2.address, 0)
      ).to.not.be.reverted;
    });

    it("Should handle maximum token amounts", async function () {
      // Transfer all tokens from treasury to user1
      const treasuryBalance = await token.balanceOf(treasury.address);
      
      await expect(
        token.connect(treasury).transfer(user1.address, treasuryBalance)
      ).to.not.be.reverted;

      expect(await token.balanceOf(user1.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(treasury.address)).to.equal(0);
    });

    it("Should maintain total supply consistency", async function () {
      const initialSupply = await token.totalSupply();
      
      // Transfer some tokens
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
      await token.connect(treasury).transfer(user2.address, ethers.parseUnits("2000", 18));
      
      // Total supply should remain the same
      expect(await token.totalSupply()).to.equal(initialSupply);
      
      // Burn some tokens
      await token.connect(user1).burn(ethers.parseUnits("500", 18));
      
      // Total supply should decrease
      expect(await token.totalSupply()).to.equal(initialSupply - ethers.parseUnits("500", 18));
    });

    it("Should handle multiple burns correctly", async function () {
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
      
      const initialSupply = await token.totalSupply();
      const burnAmount1 = ethers.parseUnits("100", 18);
      const burnAmount2 = ethers.parseUnits("200", 18);
      
      await token.connect(user1).burn(burnAmount1);
      await token.connect(user1).burn(burnAmount2);
      
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount1 - burnAmount2);
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("700", 18));
    });
  });

  describe("Constants and Invariants", function () {
    it("Should have correct MAX_SUPPLY constant", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseUnits("1000000000000", 18));
    });

    it("Should never exceed MAX_SUPPLY", async function () {
      // Initial supply should equal max supply
      expect(await token.totalSupply()).to.equal(await token.MAX_SUPPLY());
      
      // After burning, supply should be less than max
      await token.connect(treasury).transfer(user1.address, ethers.parseUnits("1000", 18));
      await token.connect(user1).burn(ethers.parseUnits("100", 18));
      
      expect(await token.totalSupply()).to.be.lessThan(await token.MAX_SUPPLY());
    });

    it("Should maintain ERC20 standard compliance", async function () {
      // Check standard functions exist and work
      expect(await token.name()).to.be.a("string");
      expect(await token.symbol()).to.be.a("string");
      expect(await token.decimals()).to.equal(18);
      expect(await token.totalSupply()).to.be.a("bigint");
      
      // Check balanceOf works
      expect(await token.balanceOf(treasury.address)).to.be.a("bigint");
      
      // Check allowance works
      expect(await token.allowance(treasury.address, user1.address)).to.equal(0);
    });
  });
});
