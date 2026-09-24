// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {DeployDTsla} from "../script/DeployDTsla.s.sol";
import {dTSLA} from "../src/dTSLA.sol";
import {HelperConfig} from "../script/HelperConfig.s.sol";
import {MockUSDC} from "../src/test/mocks/MockUSDC.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract dTSLATest is Test {
    DeployDTsla public deployer;
    HelperConfig public helperConfig;
    dTSLA public dtsla;
    MockUSDC public mockUSDC;
    
    address public owner;
    address public user = makeAddr("user");

    // Default anvil account 1
    uint256 oraclePrivateKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address oracleSigner = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function setUp() public {
        deployer = new DeployDTsla();
        (dtsla, helperConfig) = deployer.run();
        
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        mockUSDC = MockUSDC(config.usdcToken);
        owner = dtsla.owner();

        // Give the user some USDC to play with
        mockUSDC.mint(user, 10_000e18);

        // Give the owner (backend) some USDC to fulfill redemptions
        mockUSDC.mint(owner, 100_000e18);

        vm.startPrank(owner);
        dtsla.setOracleSigner(oracleSigner);
        dtsla.setWhitelist(user, true); // Whitelist the test user
        vm.stopPrank();
    }

    function _signClaimMintQuote(
        address _user,
        uint256 usdcConsumed,
        uint256 dTslaAmount,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(_user, usdcConsumed, dTslaAmount, timestamp, "claimMint"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    function _signDepositForMintQuote(
        address _user,
        uint256 usdcAmount,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(_user, usdcAmount, timestamp, "depositForMint"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    function _signRedeemQuote(
        address _user,
        uint256 dTslaAmount,
        uint256 usdcAmount,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(_user, dTslaAmount, usdcAmount, timestamp, "redeem"));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    /*//////////////////////////////////////////////////////////////
                                 MINTING
    //////////////////////////////////////////////////////////////*/

    function testUserCanDepositAndClaimWithValidSignature() public {
        uint256 usdcAmount = 100e18;
        uint256 dTslaAmount = 0.5e18;
        uint256 timestamp = block.timestamp;
        
        bytes memory signature = _signClaimMintQuote(user, usdcAmount, dTslaAmount, timestamp);
        
        bytes memory depositSig = _signDepositForMintQuote(user, usdcAmount, timestamp);
        
        uint256 initialContractUsdc = mockUSDC.balanceOf(address(dtsla));

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);
        
        // Deposit
        vm.expectEmit(true, false, false, true, address(dtsla));
        emit dTSLA.DepositReceived(user, usdcAmount, depositSig);
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);

        // Claim
        vm.expectEmit(true, false, false, true, address(dtsla));
        emit dTSLA.Minted(user, usdcAmount, dTslaAmount);
        
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, signature);
        vm.stopPrank();

        // User got dTSLA
        assertEq(dtsla.balanceOf(user), dTslaAmount);
        
        // Vault kept the USDC
        assertEq(mockUSDC.balanceOf(address(dtsla)), initialContractUsdc + usdcAmount);
        assertEq(dtsla.s_pendingDeposits(user), 0);
    }

    function testClaimMintFailsIfSignatureExpired() public {
        uint256 usdcAmount = 100e18;
        uint256 dTslaAmount = 0.5e18;
        uint256 timestamp = block.timestamp; // Current time
        
        bytes memory depositSig = _signDepositForMintQuote(user, usdcAmount, timestamp);
        
        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);
        
        // Fast forward 6 minutes so the signature becomes expired
        vm.warp(block.timestamp + 6 minutes + 1);

        vm.expectRevert(dTSLA.dTSLA__SignatureExpired.selector);
        // Note: the test claim signature will fail because we overwrite the signature above.
        // Let's generate a claim signature as well
        bytes memory claimSig = _signClaimMintQuote(user, usdcAmount, dTslaAmount, timestamp);
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, claimSig);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                REDEEMING
    //////////////////////////////////////////////////////////////*/

    function testUserCanRedeemInstantlyWithValidSignature() public {
        // Setup: user has 1 dTSLA
        uint256 usdcAmount = 200e18;
        uint256 dTslaAmount = 1e18;
        uint256 timestamp = block.timestamp;

        // User buys 1 dTSLA first
        bytes memory depositSig = _signDepositForMintQuote(user, usdcAmount, timestamp);
        bytes memory mintSig = _signClaimMintQuote(user, usdcAmount, dTslaAmount, timestamp);
        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, mintSig);
        vm.stopPrank();

        // Admin must fund the vault for redemptions
        vm.prank(owner);
        mockUSDC.transfer(address(dtsla), 1000e18); // 1000 USDC buffer

        // Now user redeems
        uint256 redeemPayout = 250e18; // Price went up!
        bytes memory redeemSig = _signRedeemQuote(user, dTslaAmount, redeemPayout, timestamp);
        
        uint256 initialUserUsdc = mockUSDC.balanceOf(user);

        vm.startPrank(user);
        vm.expectEmit(true, false, false, true, address(dtsla));
        emit dTSLA.Redeemed(user, dTslaAmount, redeemPayout);
        
        dtsla.redeem(dTslaAmount, redeemPayout, timestamp, redeemSig);
        vm.stopPrank();

        // User burned dTSLA and got USDC payout
        assertEq(dtsla.balanceOf(user), 0);
        assertEq(mockUSDC.balanceOf(user), initialUserUsdc + redeemPayout);
    }
}
