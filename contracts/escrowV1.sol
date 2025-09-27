// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;


interface IWLD {
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IEIP712 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// @title SignatureTransfer
/// @notice Handles ERC20 token transfers through signature based actions
/// @dev Requires user's token approval on the Permit2 contract
interface ISignatureTransfer is IEIP712 {
    error InvalidAmount(uint256 maxAmount);
    error LengthMismatch();
    event UnorderedNonceInvalidation(address indexed owner, uint256 word, uint256 mask);

    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    struct PermitBatchTransferFrom {
        TokenPermissions[] permitted;
        uint256 nonce;
        uint256 deadline;
    }

    function nonceBitmap(address, uint256) external view returns (uint256);

    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;

    function permitTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    function permitWitnessTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;

    function invalidateUnorderedNonces(uint256 wordPos, uint256 mask) external;
}


contract Escrow {
    struct Deposit {
        address seller;
        string upiId;
        uint256 remainingFunds;
        uint256 minimumAmount;
    }

    struct Intent {
        address buyer;
        uint256 amount;
        uint256 timestamp;
        bool claimed;
        uint256 depositId;
    }

    PlutoAttestationVerifier public attestationVerifier;
    IWLD public wldToken;
    ISignatureTransfer public immutable permit2;

    uint256 public depositCounter;
    mapping(uint256 => Deposit) public deposits; // depositId => Deposit
    mapping(address => Intent) public buyerIntents; // buyer => intent
    mapping(string => bool) public claimedTransactions; // upi_transaction_id => bool

    event FundsDeposited(
        uint256 depositId,
        address seller,
        string upiId,
        uint256 remainingFunds,
        uint256 minimumAmount
    );
    event BuyerIntent(uint256 depositId, address buyer, uint256 amount);
    event IntentCancelled(address buyer, uint256 depositId);
    event PaymentClaimed(
        address buyer,
        uint256 wldAmount,
        string upiTransactionId
    );
    event FundsWithdrawn(address seller, uint256 depositId, uint256 amount);

    constructor(
        address notaryAddress,
        address _wldToken,
    ) {
        attestationVerifier = new PlutoAttestationVerifier(notaryAddress);
        wldToken = IWLD(_wldToken);
        permit2 = ISignatureTransfer(
            address(0x000000000022D473030F116dDEE9F6B43aC78BA3)
        );
    }

    /// @notice Seller deposits WLD tokens into escrow
    function depositFunds(
        string memory upiId,
        uint256 depositAmount,
        uint256 minimumAmount,
        ISignatureTransfer.PermitTransferFrom memory permitTransferFrom,
        ISignatureTransfer.SignatureTransferDetails calldata transferDetails,
        bytes calldata signature
    ) external {
        require(depositAmount > 0, "Deposit some funds");
        require(
            minimumAmount > 0 && minimumAmount <= depositAmount,
            "Invalid minimum amount"
        );

        permit2.permitTransferFrom(
            permitTransferFrom,
            transferDetails,
            msg.sender,
            signature
        );

        // Record deposit
        depositCounter++;
        deposits[depositCounter] = Deposit({
            seller: msg.sender,
            upiId: upiId,
            remainingFunds: depositAmount,
            minimumAmount: minimumAmount
        });

        emit FundsDeposited(
            depositCounter,
            msg.sender,
            upiId,
            depositAmount,
            minimumAmount
        );
    }

    /// @notice Buyer signals intent to buy WLD from a seller deposit
    function signalIntent(uint256 depositId, uint256 amount) external {
        Deposit storage d = deposits[depositId];
        require(d.seller != address(0), "Deposit not found");
        require(
            amount >= d.minimumAmount && amount <= d.remainingFunds,
            "Amount out of range"
        );
        require(!hasActiveIntent(msg.sender), "Already has an active intent");

        buyerIntents[msg.sender] = Intent({
            buyer: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            claimed: false,
            depositId: depositId
        });

        emit BuyerIntent(depositId, msg.sender, amount);
    }

    /// @notice Buyer cancels their active intent
    function cancelIntent() external {
        Intent storage intent = buyerIntents[msg.sender];
        require(!intent.claimed, "Already claimed");
        require(intent.amount > 0, "No active intent");

        emit IntentCancelled(msg.sender, intent.depositId);

        delete buyerIntents[msg.sender];
    }

    /// @notice Seller withdraws remaining funds
    function withdrawRemainingFunds(uint256 depositId) external {
        Deposit storage deposit = deposits[depositId];
        require(deposit.seller == msg.sender, "Not the seller");
        require(deposit.remainingFunds > 0, "No funds to withdraw");

        uint256 amount = deposit.remainingFunds;
        deposit.remainingFunds = 0; // Reset deposit

        require(wldToken.transfer(msg.sender, amount), "WLD transfer failed");

        emit FundsWithdrawn(msg.sender, depositId, amount);
    }

    /// @notice Claim WLD tokens after submitting attestation
    /// @param input Pluto attestation input
    /// @param signature Pluto attestation signature
    function claimFunds(
        PlutoAttestationVerifier.AttestationInput memory input,
        PlutoAttestationVerifier.AttestationSignature memory signature,
    ) external payable {
        bool verified = attestationVerifier.verifyAttestation(input, signature);
        require(verified, "Attestation verification failed");

        // Extract fields from attestation
        string memory paymentStatus;
        string memory receiverUpiId;
        string memory paymentAmountStr;
        string memory upiTxId;

        for (uint256 i = 0; i < input.data.length; i++) {
            string memory key = input.data[i].key;
            string memory value = input.data[i].value;

            if (compareStrings(key, "paymentStatusTitle"))
                paymentStatus = value;
            else if (compareStrings(key, "receiverUpiId"))
                receiverUpiId = value;
            else if (compareStrings(key, "paymentTotalAmount"))
                paymentAmountStr = value;
            else if (compareStrings(key, "upi_transaction_id")) upiTxId = value;
        }

        require(
            compareStrings(paymentStatus, '"SUCCESS"'),
            "Payment not successful"
        );
        require(
            !claimedTransactions[upiTxId],
            "UPI transaction already claimed"
        );

        // Strip quotes from receiverUpiId if present
        receiverUpiId = stripQuotes(receiverUpiId);

        // Convert payment amount to uint
        uint256 paymentAmountInr = parseUint(paymentAmountStr);

        // 3️⃣ Compute WLD amount to credit
        // paymentAmountInr is in INR (assume 2 decimals, e.g. paise), wldInrPrice18 is 18 decimals
        // To get WLD: (paymentAmountInr * 1e18) / wldInrPrice18
        uint256 paymentAmount = (paymentAmountInr * 1e16);

        // Verify buyer intent
        Intent storage intent = buyerIntents[msg.sender];
        require(!intent.claimed, "Already claimed");
        require(
            block.timestamp <= intent.timestamp + 24 hours,
            "Intent expired"
        );
        require(intent.amount == paymentAmount, "Payment amount mismatch");

        // Verify deposit
        Deposit storage deposit = deposits[intent.depositId];
        require(deposit.seller != address(0), "Seller deposit not found");
        require(compareStrings(deposit.upiId, receiverUpiId), "UPI mismatch");
        require(
            deposit.remainingFunds >= paymentAmount,
            "Insufficient deposit"
        );

        // Update states
        intent.claimed = true;
        deposit.remainingFunds -= paymentAmount;
        claimedTransactions[upiTxId] = true;

        // Transfer WLD to buyer
        require(
            wldToken.transfer(msg.sender, paymentAmount),
            "WLD transfer failed"
        );

        emit PaymentClaimed(msg.sender, paymentAmount, upiTxId);

        // Refund any excess ETH sent for update fee
        if (msg.value > updateFee) {
            (bool sent, ) = msg.sender.call{value: msg.value - updateFee}("");
            require(sent, "Refund failed");
        }
    }

    // ----------------- Helpers -----------------
    function hasActiveIntent(address buyer) public view returns (bool) {
        Intent storage intent = buyerIntents[buyer];
        return
            !intent.claimed &&
            intent.amount > 0 &&
            block.timestamp <= intent.timestamp + 24 hours;
    }

    function stripQuotes(
        string memory str
    ) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        if (b.length >= 2 && b[0] == '"' && b[b.length - 1] == '"') {
            bytes memory trimmed = new bytes(b.length - 2);
            for (uint256 i = 0; i < b.length - 2; i++) {
                trimmed[i] = b[i + 1];
            }
            return string(trimmed);
        }
        return str;
    }

    function compareStrings(
        string memory a,
        string memory b
    ) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function parseUint(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            require(b[i] >= 0x30 && b[i] <= 0x39, "Invalid number");
            result = result * 10 + (uint8(b[i]) - 48);
        }
        return result;
    }

}
