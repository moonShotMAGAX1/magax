// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MoonShotMAGAX is ERC20 {
    constructor(address treasury) ERC20("MoonShot MagaX", "MAGAX") {
        uint256 initialSupply = 1_000_000_000_000 * 10 ** decimals();
        _mint(treasury, initialSupply);
    }
}
