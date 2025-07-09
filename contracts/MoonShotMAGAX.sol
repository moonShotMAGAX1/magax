// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MoonShotMAGAX is ERC20, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 * 10**18; // 1 Trillion tokens
    
    event TokensBurned(uint256 amount);
    event MaxSupplyReached();

    constructor(address treasury) ERC20("MoonShot MagaX", "MAGAX") Ownable(msg.sender) {
        require(treasury != address(0), "Treasury cannot be zero address");
        
        uint256 initialSupply = 1_000_000_000_000 * 10 ** decimals();
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds max supply");
        
        _mint(treasury, initialSupply);
        emit MaxSupplyReached();
    }

    // Pausable transfers for emergency situations
    function _update(address from, address to, uint256 value) 
        internal override whenNotPaused {
        super._update(from, to, value);
    }

    // Emergency pause function
    function pause() external onlyOwner {
        _pause();
    }

    // Emergency unpause function  
    function unpause() external onlyOwner {
        _unpause();
    }

    // Burn tokens to reduce supply
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(amount);
    }

    // Burn tokens from specific address (with allowance)
    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
        emit TokensBurned(amount);
    }
}
