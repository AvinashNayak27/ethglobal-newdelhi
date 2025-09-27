# Smart Contracts

This directory contains the smart contracts for the ShieldRamp - a decentralized escrow system for UPI-to-WLD token exchanges with attestation verification.

## Contracts Overview

### 1. Escrow Contract (`escrowV1.sol`)

A decentralized escrow system that facilitates secure exchanges between UPI payments and WLD tokens using attestation-based verification.

**Key Features:**
- Sellers can deposit WLD tokens and specify their UPI ID
- Buyers can signal intent to purchase WLD tokens
- Payment verification through attestation system
- Automatic fund release upon successful payment verification
- 24-hour claim window for buyers

**Main Functions:**
- `depositFunds()` - Sellers deposit WLD tokens into escrow
- `signalIntent()` - Buyers express intent to purchase tokens
- `claimFunds()` - Buyers claim tokens after successful UPI payment
- `withdrawRemainingFunds()` - Sellers withdraw unclaimed funds

**Deployed Address:** [0xd5b08f199f9712cbccb87dfb6217c7e0b560defb](https://worldscan.org/address/0xd5b08f199f9712cbccb87dfb6217c7e0b560defb)

### 2. Pluto Attestation Verifier (`plutoVerifier.sol`)

A comprehensive attestation verification system that validates payment proofs using cryptographic signatures.

**Key Features:**
- Notary-based signature verification
- Script and session hash validation
- Batch attestation verification support
- Merkle root verification for data integrity
- Duplicate proof prevention

**Main Functions:**
- `verifyAttestation()` - Verifies individual attestations
- `verifyMultipleAttestations()` - Batch verification
- `calculateScriptHash()` - Computes script hash
- `calculateSessionHash()` - Computes session hash

**Deployed Address:** [0xd5b08f199f9712cbccb87dfb6217c7e0b560defb](https://worldscan.org/address/0xd5b08f199f9712cbccb87dfb6217c7e0b560defb)

## Configuration

**Signer Address:** `0x209Af77DfDaba352890b0Bc9B86A25bE67eF436A`

## How It Works

1. **Seller Setup**: Sellers deposit WLD tokens into the escrow contract along with their UPI ID
2. **Buyer Intent**: Buyers signal their intent to purchase a specific amount of WLD tokens
3. **Payment**: Buyers make UPI payments to the seller's UPI ID
4. **Attestation**: Payment proof is generated and signed by the attestation system
5. **Verification**: The escrow contract verifies the attestation using the Pluto Verifier
6. **Fund Release**: Upon successful verification, WLD tokens are automatically released to the buyer

## Exchange Rate

Current rate: `100 INR = 0.01 WLD` (1e16 wei per INR) Will be replace with pyth price feeds in V2

## Security Features

- Time-locked intents (24-hour expiration)
- Duplicate transaction prevention
- Cryptographic signature verification
- Notary-based attestation system
- Automatic fund management

## Network

All contracts are deployed on World Chain. You can view them on [WorldScan](https://worldscan.org/).
