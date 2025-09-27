"use client";

import { useEffect, useState } from "react";
import {
  MiniKit,
  ResponseEvent,
  MiniAppSendTransactionPayload,
  MiniAppVerifyActionPayload,
  VerificationLevel,
  ISuccessResult,
} from "@worldcoin/minikit-js";
import { useWaitForTransactionReceipt } from "@worldcoin/minikit-react";
import { createPublicClient, http } from "viem";
import { worldchain } from "viem/chains";

const WorldCoinABI = [
  {
    inputs: [
      { internalType: "address", name: "_bridge", type: "address" },
      { internalType: "address", name: "_remoteToken", type: "address" },
      { internalType: "string", name: "_name", type: "string" },
      { internalType: "string", name: "_symbol", type: "string" },
      { internalType: "uint8", name: "_decimals", type: "uint8" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Burn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Mint",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [],
    name: "BRIDGE",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "REMOTE_TOKEN",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "bridge",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_from", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "subtractedValue", type: "uint256" },
    ],
    name: "decreaseAllowance",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "addedValue", type: "uint256" },
    ],
    name: "increaseAllowance",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "l1Token",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "l2Bridge",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "remoteToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "_interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];


export default function Home() {
  const [isWorldAppReady, setIsWorldAppReady] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [worldAmount, setWorldAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  // Create public client for World Chain
  const client = createPublicClient({
    chain: worldchain,
    transport: http(),
  });

  // Hook to wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      client: client,
      appConfig: {
        app_id: process.env.NEXT_PUBLIC_APP_ID,
      },
      transactionId: transactionId,
    });

  useEffect(() => {
    MiniKit.install();

    // Initialize MiniKit when component mounts
    if (!MiniKit.isInstalled()) {
      console.error("MiniKit is not installed");
      return;
    }

    setIsWorldAppReady(true);

    // Subscribe to verify action responses
    MiniKit.subscribe(ResponseEvent.MiniAppVerifyAction, async (response) => {
      console.log("Verify Action Response:", response);
      if (response.status === "success") {
        const proof = response.proof;
        console.log("World ID Proof Generated:", proof);
        setProofData(proof);
        setIsLoading(false);
      } else {
        console.error("Verification failed:", response);
        setIsLoading(false);
      }
    });

    // Subscribe to sendTransaction responses
    MiniKit.subscribe(
      ResponseEvent.MiniAppSendTransaction,
      async (response) => {
        console.log("Send Transaction Response:", response);
        if (response.status === "success") {
          setTransactionStatus(
            `Transaction sent successfully! Transaction ID: ${response.transaction_id}`
          );
          setTransactionId(response.transaction_id);
          console.log("Transaction:", response);
        } else {
          setTransactionStatus(`Transaction failed: ${response.error_code}`);
          console.error("Transaction failed:", response);
        }
        setIsLoading(false);
      }
    );

    return () => {
      MiniKit.unsubscribe(ResponseEvent.MiniAppVerifyAction);
      MiniKit.unsubscribe(ResponseEvent.MiniAppSendTransaction);
    };
  }, []);

  const generateProof = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    setIsLoading(true);
    setProofData(null);

    try {
      const verifyPayload = {
        action: "uniqueuser", // This should match your action configured in Developer Portal
        signal: "", // Optional additional data
        verification_level: VerificationLevel.Orb, // Orb | Device
      };

      // World App will open a drawer prompting the user to confirm the operation
      const { finalPayload } = await MiniKit.commandsAsync.verify(
        verifyPayload
      );

      if (finalPayload.status === "error") {
        console.log("Error payload", finalPayload);
        setIsLoading(false);
        return;
      }

      console.log("World ID Proof Generated:", finalPayload);
      setProofData(finalPayload);

      // Verify the proof in the backend
      const verifyResponse = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: finalPayload,
          action: "uniqueuser",
          signal: "", // Optional
        }),
      });

      const verifyResponseJson = await verifyResponse.json();
      if (verifyResponseJson.status === 200) {
        console.log("Verification success!");
      } else {
        console.error("Backend verification failed:", verifyResponseJson);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error generating proof:", error);
      setIsLoading(false);
    }
  };

  const sendTransaction = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    if (!recipientAddress) {
      alert("Please enter a recipient address");
      return;
    }

    if (!worldAmount || parseFloat(worldAmount) <= 0) {
      alert("Please enter a valid amount of WORLD tokens");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");
    setTransactionId("");

    try {
      // Convert WORLD amount to wei (multiply by 10^18)
      const amount = (parseFloat(worldAmount) * 10 ** 18).toString();

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: "0x2cfc85d8e48f8eab294be644d9e25c3030863003", // World coin contract address
            abi: WorldCoinABI,
            functionName: "transfer",
            args: [recipientAddress, amount],
          },
        ],
      });

      if (finalPayload.status === "error") {
        console.error("Error payload", finalPayload);
        setTransactionStatus(`Transaction failed: ${finalPayload.error_code}`);
        setIsLoading(false);
        return;
      }

      console.log("Transaction sent successfully:", finalPayload);
      setTransactionStatus(
        `Transaction sent! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);
      setIsLoading(false);
    } catch (error) {
      console.error("Error sending transaction:", error);
      setTransactionStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            World ID Onchain Verification
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Generate World ID proofs and send WORLD tokens
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* World ID Proof Generation Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              🔐 Generate World ID Proof
            </h2>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isWorldAppReady ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {isWorldAppReady
                    ? "World App Connected"
                    : "World App Not Detected"}
                </span>
              </div>

              <button
                onClick={generateProof}
                disabled={!isWorldAppReady || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                {isLoading ? "Generating Proof..." : "Generate World ID Proof"}
              </button>

              {proofData && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-400 mb-2">
                    ✅ Proof Generated Successfully!
                  </h3>
                  <div className="text-xs font-mono bg-white dark:bg-gray-800 p-3 rounded border overflow-auto max-h-40">
                    <pre>{JSON.stringify(proofData, null, 2)}</pre>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Check console for full proof details
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              💰 Send WORLD Transaction
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (WORLD tokens)
                </label>
                <input
                  type="number"
                  step="0.000000000000000001"
                  min="0"
                  value={worldAmount}
                  onChange={(e) => setWorldAmount(e.target.value)}
                  placeholder="Enter amount in WORLD tokens"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {worldAmount && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Amount: <span className="font-medium">{worldAmount} WORLD</span>
                    <br />
                    Wei: <span className="font-mono text-xs">{(parseFloat(worldAmount || 0) * 10 ** 18).toString()}</span>
                  </p>
                </div>
              )}

              <button
                onClick={sendTransaction}
                disabled={
                  !isWorldAppReady ||
                  !recipientAddress ||
                  !worldAmount ||
                  parseFloat(worldAmount || 0) <= 0 ||
                  isLoading ||
                  isConfirming
                }
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                {isLoading
                  ? "Sending Transaction..."
                  : isConfirming
                  ? "Confirming..."
                  : `Send ${worldAmount || "0"} WORLD`}
              </button>

              {(transactionStatus || isConfirmed) && (
                <div
                  className={`mt-4 p-4 rounded-lg ${
                    transactionStatus.includes("sent") || isConfirmed
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {isConfirmed
                      ? "✅ Transaction confirmed on blockchain!"
                      : transactionStatus}
                  </p>
                  {isConfirming && (
                    <p className="text-xs text-gray-500 mt-1">
                      ⏳ Waiting for blockchain confirmation...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📋 Instructions
          </h2>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>
              1. Make sure you have configured your APP_ID and APP_URL in the
              .env.local file
            </p>
            <p>
              2. This app must be opened within World App for the features to
              work
            </p>
            <p>
              3. The proof generation will create a World ID verification that
              can be submitted onchain
            </p>
            <p>
              4. Transaction functionality sends WORLD tokens directly via smart
              contract to the specified address
            </p>
            <p>
              5. Enter the amount in WORLD tokens - it will be automatically converted to wei (multiplied by 10^18)
            </p>
            <p>
              6. All transactions and proofs are logged to the browser console
            </p>
          </div>
        </div>

        {/* Environment Variables Status */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-400">
            <strong>Environment Variables:</strong>
            <br />
            APP_ID: {process.env.NEXT_PUBLIC_APP_ID || "Not configured"}
            <br />
            APP_URL: {process.env.NEXT_PUBLIC_APP_URL || "Not configured"}
          </p>
        </div>
      </div>
    </div>
  );
}
