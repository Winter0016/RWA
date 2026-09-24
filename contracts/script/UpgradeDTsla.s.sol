// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {dTSLA} from "../src/dTSLA.sol";
import {UUPSUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeDTsla is Script {
    function run() external {
        // The deployed proxy address on Arbitrum Sepolia
        address proxyAddress = 0xd0AE4d1f4B03fcF186091090ba0b2688f9644C94;

        vm.startBroadcast();

        // 1. Deploy the new implementation contract
        dTSLA newImplementation = new dTSLA();

        // 2. Wrap the proxy address with our dTSLA interface
        dTSLA proxy = dTSLA(proxyAddress);

        // 3. Call upgradeToAndCall to point the proxy to the new implementation
        // Since we don't have new initialization data, we just pass empty bytes ""
        proxy.upgradeToAndCall(address(newImplementation), "");

        vm.stopBroadcast();
    }
}
