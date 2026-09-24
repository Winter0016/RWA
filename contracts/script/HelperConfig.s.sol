// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../src/test/mocks/MockUSDC.sol";

contract HelperConfig is Script {
    NetworkConfig public activeNetworkConfig;

    struct NetworkConfig {
        address usdcToken;
        address oracleSigner;
    }

    constructor() {
        if (block.chainid == 421614) {
            // Arbitrum Sepolia
            activeNetworkConfig = getArbitrumSepoliaConfig();
        } else {
            // Local Anvil
            activeNetworkConfig = getAnvilConfig();
        }
    }

    function getConfig() public view returns (NetworkConfig memory) {
        return activeNetworkConfig;
    }

    function getArbitrumSepoliaConfig()
        public
        pure
        returns (NetworkConfig memory config)
    {
        config = NetworkConfig({
            usdcToken: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d, // USDC Arbitrum Sepolia
            oracleSigner: 0xe1F02E0453f0c89AB3f01C1224f1E75520e7b689 // Mock external address
        });
    }

    function getAnvilConfig() public returns (NetworkConfig memory config) {
        MockUSDC usdcMock = new MockUSDC();

        config = NetworkConfig({
            usdcToken: address(usdcMock),
            // Default Anvil address 1 is often used for mock signers
            oracleSigner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        });
    }
}
