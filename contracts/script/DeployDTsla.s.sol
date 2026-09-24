// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {dTSLA} from "../src/dTSLA.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployDTsla is Script {
    function run() external returns (dTSLA, HelperConfig) {
        vm.startBroadcast();
        
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();

        // 1. Deploy Implementation
        dTSLA implementation = new dTSLA();

        // 2. Encode Initialize Data
        bytes memory data = abi.encodeCall(
            implementation.initialize,
            (config.usdcToken, config.oracleSigner)
        );

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), data);
        
        // 4. Wrap proxy address in dTSLA ABI
        dTSLA dTsla = dTSLA(address(proxy));
        
        // 5. Add the deployer to the whitelist so you can test locally!
        dTsla.setWhitelist(msg.sender, true);
        
        // Add specific DB users to the whitelist
        dTsla.setWhitelist(0x48002b5E034C50282ed0876968f63c93B625449c, true); // Phuc Chau
        dTsla.setWhitelist(0x34F6fF0a58B1f83eBB315201D1419313EBb1852E, true); // Admin
        
        vm.stopBroadcast();

        return (dTsla, helperConfig);
    }
}
