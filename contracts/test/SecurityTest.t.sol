// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {DeployDTsla} from "../script/DeployDTsla.s.sol";
import {dTSLA} from "../src/dTSLA.sol";
import {HelperConfig} from "../script/HelperConfig.s.sol";
import {MockUSDC} from "../src/test/mocks/MockUSDC.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SecurityTest is Test {
    DeployDTsla public deployer;
    HelperConfig public helperConfig;
    dTSLA public dtsla;
    MockUSDC public mockUSDC;

    address public owner;
    address public user = makeAddr("user");
    address public hacker = makeAddr("hacker");

    // Default anvil account 1
    uint256 oraclePrivateKey =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address oracleSigner = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function setUp() public {
        deployer = new DeployDTsla();
        (dtsla, helperConfig) = deployer.run();

        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        mockUSDC = MockUSDC(config.usdcToken);
        owner = dtsla.owner();

        // Give the user some USDC
        mockUSDC.mint(user, 10_000e18);

        vm.startPrank(owner);
        dtsla.setOracleSigner(oracleSigner);
        dtsla.setWhitelist(user, true); // User is KYC'd
        // Note: hacker is NOT whitelisted
        vm.stopPrank();
    }

    function _signDepositForMintQuote(
        address _user,
        uint256 usdcAmount,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(_user, usdcAmount, timestamp, "depositForMint")
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            oraclePrivateKey,
            ethSignedMessageHash
        );
        return abi.encodePacked(r, s, v);
    }

    function _signClaimMintQuote(
        address _user,
        uint256 usdcConsumed,
        uint256 dTslaAmount,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _user,
                usdcConsumed,
                dTslaAmount,
                timestamp,
                "claimMint"
            )
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            oraclePrivateKey,
            ethSignedMessageHash
        );
        return abi.encodePacked(r, s, v);
    }

    /*//////////////////////////////////////////////////////////////
                     TEST 2: REPLAY ATTACK PREVENTION
    //////////////////////////////////////////////////////////////*/
    function testReplayAttackIsBlocked() public {
        uint256 usdcAmount = 100e18;
        uint256 dTslaAmount = 0.5e18;
        uint256 timestamp = block.timestamp;

        bytes memory depositSig = _signDepositForMintQuote(
            user,
            usdcAmount,
            timestamp
        );
        bytes memory claimSig = _signClaimMintQuote(
            user,
            usdcAmount,
            dTslaAmount,
            timestamp
        );

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);

        // 1. Legitimate deposit and claim
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, claimSig);

        assertEq(dtsla.balanceOf(user), dTslaAmount);

        // 2. The Hacker (or malicious user) tries to replay the exact same claim signature to mint MORE tokens
        vm.expectRevert(dTSLA.dTSLA__InvalidSignature.selector);
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, claimSig);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                     TEST 3: 5-MINUTE TIMEBOMB
    //////////////////////////////////////////////////////////////*/
    function testSignatureExpiresAfter5Minutes() public {
        uint256 usdcAmount = 100e18;
        uint256 timestamp = block.timestamp; // The timestamp encoded in the signature

        bytes memory depositSig = _signDepositForMintQuote(
            user,
            usdcAmount,
            timestamp
        );

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);

        // Fast forward the blockchain time by 5 minutes and 1 second
        vm.warp(block.timestamp + 301);

        // Attempting to use the signature now should fail
        vm.expectRevert(dTSLA.dTSLA__SignatureExpired.selector);
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                     TEST 4: BLACK MARKET WHITELIST
    //////////////////////////////////////////////////////////////*/
    function testBlackMarketTransfersAreBlocked() public {
        uint256 usdcAmount = 100e18;
        uint256 dTslaAmount = 0.5e18;
        uint256 timestamp = block.timestamp;

        bytes memory depositSig = _signDepositForMintQuote(
            user,
            usdcAmount,
            timestamp
        );
        bytes memory claimSig = _signClaimMintQuote(
            user,
            usdcAmount,
            dTslaAmount,
            timestamp
        );

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);

        // 1. User gets their legit dTSLA tokens
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);
        dtsla.claimMint(usdcAmount, dTslaAmount, timestamp, claimSig);
        assertEq(dtsla.balanceOf(user), dTslaAmount);

        // 2. User tries to send dTSLA to a non-whitelisted address (Hacker)
        vm.expectRevert(dTSLA.dTSLA__NotWhitelisted.selector);
        dtsla.transfer(hacker, dTslaAmount);

        vm.stopPrank();
    }
    /*//////////////////////////////////////////////////////////////
                     TEST 5: ORACLE IMPERSONATION (SELF-SIGNING)
    //////////////////////////////////////////////////////////////*/
    function testUserCannotSelfSignQuotes() public {
        uint256 usdcAmount = 100e18;
        uint256 timestamp = block.timestamp;

        // The user tries to be sneaky and signs the message with their OWN private key
        uint256 userPrivateKey = 0x12345; // Fake private key for the user

        bytes32 messageHash = keccak256(
            abi.encodePacked(user, usdcAmount, timestamp, "depositForMint")
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            userPrivateKey,
            ethSignedMessageHash
        );
        bytes memory maliciousSignature = abi.encodePacked(r, s, v);

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);

        // Contract must reject it because the signer is NOT the official Oracle!
        vm.expectRevert(dTSLA.dTSLA__InvalidSignature.selector);
        dtsla.depositForMint(usdcAmount, timestamp, maliciousSignature);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                     TEST 6: ESCROW UNDERFLOW EXPLOIT
    //////////////////////////////////////////////////////////////*/
    function testCannotClaimMoreThanDeposited() public {
        uint256 usdcAmount = 100e18;
        uint256 maliciousUsdcConsumed = 200e18; // Trying to claim $200 worth of dTSLA using only $100 deposit!
        uint256 dTslaAmount = 1e18;
        uint256 timestamp = block.timestamp;

        bytes memory depositSig = _signDepositForMintQuote(
            user,
            usdcAmount,
            timestamp
        );
        bytes memory claimSig = _signClaimMintQuote(
            user,
            maliciousUsdcConsumed,
            dTslaAmount,
            timestamp
        );

        vm.startPrank(user);
        mockUSDC.approve(address(dtsla), usdcAmount);

        // 1. User legitimately deposits $100
        dtsla.depositForMint(usdcAmount, timestamp, depositSig);

        // 2. User tries to execute a claim signature that demands $200
        vm.expectRevert(dTSLA.dTSLA__NotEnoughEscrowBalance.selector);
        dtsla.claimMint(
            maliciousUsdcConsumed,
            dTslaAmount,
            timestamp,
            claimSig
        );

        vm.stopPrank();
    }
    /*//////////////////////////////////////////////////////////////
                     TEST 7: MEV SIGNATURE STEALING (FRONT-RUNNING)
    //////////////////////////////////////////////////////////////*/
    function testCannotStealSomeoneElsesSignature() public {
        uint256 usdcAmount = 100e18;
        uint256 timestamp = block.timestamp;
        
        // The Oracle generates a valid signature for the legitimate USER
        bytes memory legitimateDepositSig = _signDepositForMintQuote(user, usdcAmount, timestamp);
        
        // A Hacker spots this transaction in the Mempool and tries to copy the signature
        // to execute it themselves before the user does!
        // We whitelist the hacker to simulate that they are a valid user trying to steal from another user
        vm.prank(owner);
        dtsla.setWhitelist(hacker, true);
        
        vm.startPrank(hacker);
        mockUSDC.mint(hacker, 1000e18); // Hacker has their own USDC
        mockUSDC.approve(address(dtsla), usdcAmount);
        
        // Hacker tries to use the USER's signature
        // The contract will calculate the hash using msg.sender (which is now the Hacker)
        // Since the signature was signed for the User's address, the recovered signer won't match the Oracle!
        vm.expectRevert(dTSLA.dTSLA__InvalidSignature.selector);
        dtsla.depositForMint(usdcAmount, timestamp, legitimateDepositSig);
        
        vm.stopPrank();
    }
}
