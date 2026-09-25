// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    Initializable
} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {
    ERC20Upgradeable
} from "openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import {
    OwnableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {
    PausableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import {
    UUPSUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title dTSLA
 * @notice Instant Mint/Redeem via Backend ECDSA Quotes
 */
contract dTSLA is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    error dTSLA__TransferFailed();
    error dTSLA__InvalidSignature();
    error dTSLA__SignatureExpired();
    error dTSLA__NotEnoughVaultBalance();
    error dTSLA__NotEnoughEscrowBalance();
    error dTSLA__NotWhitelisted();
    error dTSLA__HasBalance();
    error dTSLA__HasPendingDeposits();

    address public i_usdc;
    address public s_oracleSigner;

    // Track used signatures to prevent replay attacks
    mapping(bytes32 => bool) public s_usedSignatures;

    // Escrow ledger
    mapping(address => uint256) public s_pendingDeposits;

    // KYC Whitelist
    mapping(address => bool) public isWhitelisted;

    // Pending Redemptions (New for Async 2-Step)
    mapping(address => uint256) public s_pendingRedemptions;

    event Minted(address indexed user, uint256 usdcAmount, uint256 dTslaAmount);
    event Redeemed(
        address indexed user,
        uint256 dTslaAmount,
        uint256 usdcAmount
    );
    event OracleSignerUpdated(address newSigner);
    event DepositReceived(
        address indexed user,
        uint256 usdcAmount,
        bytes signature
    );
    event WhitelistUpdated(address indexed account, bool status);
    event RedeemRequested(address indexed user, uint256 dTslaAmount);
    event MintCanceled(address indexed user, uint256 usdcAmount);
    event RedeemCanceled(address indexed user, uint256 dTslaAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address usdcAddress,
        address oracleSigner
    ) public initializer {
        __ERC20_init("dTSLA", "dTSLA");
        __Ownable_init(msg.sender);
        __Pausable_init();

        i_usdc = usdcAddress;
        s_oracleSigner = oracleSigner;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setOracleSigner(address newSigner) external onlyOwner {
        s_oracleSigner = newSigner;
        emit OracleSignerUpdated(newSigner);
    }

    function setWhitelist(address account, bool status) external onlyOwner {
        if (!status) {
            if (balanceOf(account) > 0) revert dTSLA__HasBalance();
            if (s_pendingDeposits[account] > 0) revert dTSLA__HasPendingDeposits();
        }
        isWhitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /*//////////////////////////////////////////////////////////////
                                 MINTING
    //////////////////////////////////////////////////////////////*/

    function depositForMint(
        uint256 usdcAmount,
        uint256 timestamp,
        bytes memory signature
    ) external whenNotPaused {
        if (!isWhitelisted[msg.sender]) {
            revert dTSLA__NotWhitelisted();
        }

        if (block.timestamp - timestamp > 5 minutes) {
            revert dTSLA__SignatureExpired();
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                usdcAmount,
                timestamp,
                "depositForMint"
            )
        );

        if (s_usedSignatures[messageHash]) {
            revert dTSLA__InvalidSignature();
        }
        s_usedSignatures[messageHash] = true;

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        if (signer != s_oracleSigner) {
            revert dTSLA__InvalidSignature();
        }

        // Pull USDC from user and hold in Vault
        bool success = ERC20(i_usdc).transferFrom(
            msg.sender,
            address(this),
            usdcAmount
        );
        if (!success) {
            revert dTSLA__TransferFailed();
        }

        s_pendingDeposits[msg.sender] += usdcAmount;
        emit DepositReceived(msg.sender, usdcAmount, signature);
    }

    function claimMint(
        uint256 usdcConsumed,
        uint256 dTslaAmount,
        uint256 timestamp,
        bytes memory signature
    ) external whenNotPaused {
        if (block.timestamp - timestamp > 5 minutes) {
            revert dTSLA__SignatureExpired();
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                usdcConsumed,
                dTslaAmount,
                timestamp,
                "claimMint"
            )
        );

        if (s_usedSignatures[messageHash]) {
            revert dTSLA__InvalidSignature();
        }
        s_usedSignatures[messageHash] = true;

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        if (signer != s_oracleSigner) {
            revert dTSLA__InvalidSignature();
        }

        if (s_pendingDeposits[msg.sender] < usdcConsumed) {
            revert dTSLA__NotEnoughEscrowBalance();
        }

        s_pendingDeposits[msg.sender] -= usdcConsumed;

        _mint(msg.sender, dTslaAmount);
        emit Minted(msg.sender, usdcConsumed, dTslaAmount);
    }

    function cancelMint(
        uint256 usdcAmount,
        uint256 timestamp,
        bytes memory signature
    ) external whenNotPaused {
        if (block.timestamp - timestamp > 5 minutes) {
            revert dTSLA__SignatureExpired();
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                usdcAmount,
                timestamp,
                "cancelMint"
            )
        );

        if (s_usedSignatures[messageHash]) {
            revert dTSLA__InvalidSignature();
        }
        s_usedSignatures[messageHash] = true;

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        if (signer != s_oracleSigner) {
            revert dTSLA__InvalidSignature();
        }

        if (s_pendingDeposits[msg.sender] < usdcAmount) {
            revert dTSLA__NotEnoughEscrowBalance();
        }

        s_pendingDeposits[msg.sender] -= usdcAmount;

        // Refund USDC to user
        bool success = ERC20(i_usdc).transfer(msg.sender, usdcAmount);
        if (!success) {
            revert dTSLA__TransferFailed();
        }

        emit MintCanceled(msg.sender, usdcAmount);
    }

    /*//////////////////////////////////////////////////////////////
                                REDEEMING
    //////////////////////////////////////////////////////////////*/

    function requestRedeem(uint256 dTslaAmount) external whenNotPaused {
        if (!isWhitelisted[msg.sender]) {
            revert dTSLA__NotWhitelisted();
        }

        _burn(msg.sender, dTslaAmount);
        s_pendingRedemptions[msg.sender] += dTslaAmount;

        emit RedeemRequested(msg.sender, dTslaAmount);
    }

    function redeem(
        uint256 dTslaAmount,
        uint256 usdcAmount,
        uint256 timestamp,
        bytes memory signature
    ) external whenNotPaused {
        if (block.timestamp - timestamp > 5 minutes) {
            revert dTSLA__SignatureExpired();
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                dTslaAmount,
                usdcAmount,
                timestamp,
                "redeem"
            )
        );

        if (s_usedSignatures[messageHash]) {
            revert dTSLA__InvalidSignature();
        }
        s_usedSignatures[messageHash] = true;

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        if (signer != s_oracleSigner) {
            revert dTSLA__InvalidSignature();
        }

        if (s_pendingRedemptions[msg.sender] < dTslaAmount) {
            revert dTSLA__NotEnoughEscrowBalance();
        }

        // Check if vault has enough USDC
        if (ERC20(i_usdc).balanceOf(address(this)) < usdcAmount) {
            revert dTSLA__NotEnoughVaultBalance();
        }

        // Decrease pending redemptions
        s_pendingRedemptions[msg.sender] -= dTslaAmount;

        // Payout USDC from vault
        bool success = ERC20(i_usdc).transfer(msg.sender, usdcAmount);
        if (!success) {
            revert dTSLA__TransferFailed();
        }

        emit Redeemed(msg.sender, dTslaAmount, usdcAmount);
    }

    function cancelRedeem(
        uint256 dTslaAmount,
        uint256 timestamp,
        bytes memory signature
    ) external whenNotPaused {
        if (block.timestamp - timestamp > 5 minutes) {
            revert dTSLA__SignatureExpired();
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                dTslaAmount,
                timestamp,
                "cancelRedeem"
            )
        );

        if (s_usedSignatures[messageHash]) {
            revert dTSLA__InvalidSignature();
        }
        s_usedSignatures[messageHash] = true;

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        if (signer != s_oracleSigner) {
            revert dTSLA__InvalidSignature();
        }

        if (s_pendingRedemptions[msg.sender] < dTslaAmount) {
            revert dTSLA__NotEnoughEscrowBalance();
        }

        s_pendingRedemptions[msg.sender] -= dTslaAmount;

        // Refund dTSLA to user
        _mint(msg.sender, dTslaAmount);

        emit RedeemCanceled(msg.sender, dTslaAmount);
    }

    /*//////////////////////////////////////////////////////////////
                                 ADMIN
    //////////////////////////////////////////////////////////////*/

    function adminMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function adminBurn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    // Allows Admin to withdraw USDC from the vault if needed
    function sweepVault() external onlyOwner {
        uint256 balance = ERC20(i_usdc).balanceOf(address(this));
        bool success = ERC20(i_usdc).transfer(owner(), balance);
        if (!success) {
            revert dTSLA__TransferFailed();
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                                OVERRIDES
    //////////////////////////////////////////////////////////////*/

    function name() public view virtual override returns (string memory) {
        return "dTSLA";
    }

    function symbol() public view virtual override returns (string memory) {
        return "dTSLA";
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Enforce whitelist check for transfers, mints, and burns
        if (from != address(0) && !isWhitelisted[from]) {
            revert dTSLA__NotWhitelisted();
        }
        if (to != address(0) && !isWhitelisted[to]) {
            revert dTSLA__NotWhitelisted();
        }
        super._update(from, to, value);
    }
}
