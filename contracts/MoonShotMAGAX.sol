// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MoonShotMAGAX is ERC20, ERC20Capped, ERC20Permit, Ownable, Pausable {
    
    event TokensBurned(uint256 amount);
    event MaxSupplyReached();

    constructor(address treasury) 
        ERC20("MoonShot MagaX", "MAGAX") 
        ERC20Capped(1_000_000_000_000 * 10**18) // 1 Trillion tokens cap
        ERC20Permit("MoonShot MagaX")
        Ownable(msg.sender) 
    {
        require(treasury != address(0), "Treasury cannot be zero address");
        
        uint256 initialSupply = 1_000_000_000_000 * 10 ** decimals();
        
        _mint(treasury, initialSupply);
        emit MaxSupplyReached();
    }

    // Pausable transfers for emergency situations
    function _update(address from, address to, uint256 value) 
        internal override(ERC20, ERC20Capped) whenNotPaused {
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

    // Burn tokens using permit (better UX - single transaction)
    function burnWithPermit(
        address owner,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        permit(owner, msg.sender, amount, deadline, v, r, s);
        _burn(owner, amount);
        emit TokensBurned(amount);
    }

    // Get current supply cap
    function getMaxSupply() external view returns (uint256) {
        return cap();
    }
}
