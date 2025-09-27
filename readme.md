# ShieldRamp

**A P2P on/off-ramp for Indian users on WorldChain, powered by UPI + Pluto TEE-based Web Proofs.**

## Overview

ShieldRamp enables verified humans on WorldChain to seamlessly off-ramp crypto into INR via UPI. The system leverages **World ID verification** to ensure one-human-one-account and **Pluto TEE-based Web Proofs** to securely prove off-chain UPI payments on-chain.

## Flow

### Sellers (INR Off-Ramp Providers)

1. Open the **ShieldRamp Mini App**.
2. Deposit **Worldcoin (WLD)** into the on-chain escrow contract.
3. Register their **UPI ID** (for receiving INR payments).
4. Earn yield from transaction fees (1.5–2%) + spread buffer (~0.5%) on each off-ramp.

### Users (Off-Ramp)

1. Must be a **verified human via World ID Orb**.
2. Signal intent to off-ramp (max **$500 equivalent per verified human**).
3. Matched with a Seller from the pool.
4. Send INR payment via **UPI → Seller’s UPI ID**.
5. Generate a **TEE-based Web Proof via Pluto** confirming the payment.
6. Submit proof to the escrow contract.
7. Escrow releases crypto funds from Seller → User.

## Key Features

* ✅ **One-Human-One-Account**: Enforced via World ID.
* ✅ **Trustless Settlement**: Users submit proof to escrow to unlock funds automatically.
* ✅ **Privacy-Preserving Proofs**: Powered by Pluto’s TEE mode.
* ✅ **Fair Limits**: Max $500 per user to reduce risk.

## Tech Stack

* **WorldChain** for contracts.
* **Pluto TEE-based Web Proofs** for off-chain → on-chain verification.
* **UPI** for INR transfers.
* **Mini App UI** (React/Next.js).

## Why ShieldRamp?

* Solves the **India-specific on/off-ramp gap**.
* Uses **verifiable payments** without needing custodians.
* LPs earn yield while users get easy fiat exits.
