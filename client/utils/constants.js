const escrowV1Address = "0xcfd5a1d5aec34d9d147b812eec84b3d660f17aef";
const escrowABI = [
  {
    inputs: [
      { internalType: "address", name: "notaryAddress", type: "address" },
      { internalType: "address", name: "_wldToken", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "depositId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "buyer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "BuyerIntent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "depositId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "seller",
        type: "address",
      },
      { indexed: false, internalType: "string", name: "upiId", type: "string" },
      {
        indexed: false,
        internalType: "uint256",
        name: "remainingFunds",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minimumAmount",
        type: "uint256",
      },
    ],
    name: "FundsDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "seller",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "depositId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "FundsWithdrawn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "buyer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "depositId",
        type: "uint256",
      },
    ],
    name: "IntentCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "buyer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "wldAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "upiTransactionId",
        type: "string",
      },
    ],
    name: "PaymentClaimed",
    type: "event",
  },
  {
    inputs: [],
    name: "attestationVerifier",
    outputs: [
      {
        internalType: "contract PlutoAttestationVerifier",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "buyerIntents",
    outputs: [
      { internalType: "address", name: "buyer", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "claimed", type: "bool" },
      { internalType: "uint256", name: "depositId", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cancelIntent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "string", name: "version", type: "string" },
          { internalType: "string", name: "scriptRaw", type: "string" },
          { internalType: "string", name: "issuedAt", type: "string" },
          { internalType: "string", name: "nonce", type: "string" },
          { internalType: "string", name: "sessionId", type: "string" },
          {
            components: [
              { internalType: "string", name: "key", type: "string" },
              { internalType: "string", name: "value", type: "string" },
            ],
            internalType: "struct PlutoAttestationVerifier.ProofData[]",
            name: "data",
            type: "tuple[]",
          },
        ],
        internalType: "struct PlutoAttestationVerifier.AttestationInput",
        name: "input",
        type: "tuple",
      },
      {
        components: [
          { internalType: "bytes32", name: "digest", type: "bytes32" },
          { internalType: "uint8", name: "v", type: "uint8" },
          { internalType: "bytes32", name: "r", type: "bytes32" },
          { internalType: "bytes32", name: "s", type: "bytes32" },
          { internalType: "address", name: "expectedSigner", type: "address" },
        ],
        internalType: "struct PlutoAttestationVerifier.AttestationSignature",
        name: "signature",
        type: "tuple",
      },
    ],
    name: "claimFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimRate",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "claimedTransactions",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "depositCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "upiId", type: "string" },
      { internalType: "uint256", name: "depositAmount", type: "uint256" },
      { internalType: "uint256", name: "minimumAmount", type: "uint256" },
      {
        components: [
          {
            components: [
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            internalType: "struct ISignatureTransfer.TokenPermissions",
            name: "permitted",
            type: "tuple",
          },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        internalType: "struct ISignatureTransfer.PermitTransferFrom",
        name: "permitTransferFrom",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "requestedAmount", type: "uint256" },
        ],
        internalType: "struct ISignatureTransfer.SignatureTransferDetails",
        name: "transferDetails",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "depositFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "deposits",
    outputs: [
      { internalType: "address", name: "seller", type: "address" },
      { internalType: "string", name: "upiId", type: "string" },
      { internalType: "uint256", name: "remainingFunds", type: "uint256" },
      { internalType: "uint256", name: "minimumAmount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "buyer", type: "address" }],
    name: "hasActiveIntent",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "permit2",
    outputs: [
      {
        internalType: "contract ISignatureTransfer",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "depositId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "signalIntent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "depositId", type: "uint256" }],
    name: "withdrawRemainingFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "wldToken",
    outputs: [{ internalType: "contract IWLD", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];
export { escrowABI, escrowV1Address };
