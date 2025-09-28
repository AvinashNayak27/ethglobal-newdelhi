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
import { createPublicClient, http, createWalletClient, parseAbiItem } from "viem";
import { worldchain } from "viem/chains";
import { escrowABI, escrowV1Address } from "../utils/constants.js";
import Pluto from "@plutoxyz/frame-js";

// World Token Address on World Chain
const WORLD_TOKEN_ADDRESS = "0x2cfc85d8e48f8eab294be644d9e25c3030863003";

// INR price per WLD (for display, you may want to fetch this dynamically)
const INR_PER_WLD = 100; // Example: 1 WLD = 250 INR

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch (err) {
          setCopied(false);
        }
      }}
      className="ml-2 inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs"
      style={{ verticalAlign: "middle" }}
    >
      <svg
        className="w-4 h-4 mr-1"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <rect
          x="9"
          y="9"
          width="13"
          height="13"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="3"
          width="13"
          height="13"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [isWorldAppReady, setIsWorldAppReady] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [activeTab, setActiveTab] = useState("buy");
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("");

  // Onramp (Buyer) states
  const [depositId, setDepositId] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [deposits, setDeposits] = useState([]);
  const [buyerIntent, setBuyerIntent] = useState(null);

  // Sell (Seller) states
  const [upiId, setUpiId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [sellerDeposits, setSellerDeposits] = useState([]);

  // Claim funds states
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [proof, setProof] = useState(null);

  // For displaying UPI/INR in Active Intent
  const [activeIntentDeposit, setActiveIntentDeposit] = useState(null);

  // New: Track if contract data is being refreshed
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Stepper & History states
  const [selectedDepositId, setSelectedDepositId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyMineOnly, setHistoryMineOnly] = useState(false);

  const hooks = {
    onScriptLog: (log) => console.log("Log:", log),
    onSuccess: async (data) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await Pluto.resetConnection();
      setProof(data);
      console.log("Success:", data);
    },
    onError: (error) => console.error("Error:", error),
  };

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

  // Save user session to localStorage
  const saveUserSession = (userInfo) => {
    try {
      const sessionData = {
        userInfo,
        timestamp: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };
      localStorage.setItem("shieldramp_session", JSON.stringify(sessionData));
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  // Load user session from localStorage
  const loadUserSession = () => {
    try {
      const sessionData = localStorage.getItem("shieldramp_session");
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);

      // Check if session is expired
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem("shieldramp_session");
        return null;
      }

      return parsed.userInfo;
    } catch (error) {
      console.error("Error loading session:", error);
      localStorage.removeItem("shieldramp_session");
      return null;
    }
  };

  // Clear user session
  const clearUserSession = () => {
    try {
      localStorage.removeItem("shieldramp_session");
    } catch (error) {
      console.error("Error clearing session:", error);
    }
  };

  // Sign out function
  const signOut = () => {
    setIsAuthenticated(false);
    setUserInfo(null);
    clearUserSession();
  };

  // Wallet Authentication Function
  const signInWithWallet = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    setIsAuthenticating(true);

    try {
      // Get nonce from backend
      const res = await fetch("/api/nonce");
      const { nonce } = await res.json();

      // Perform wallet authentication
      const { commandPayload: generateMessageResult, finalPayload } =
        await MiniKit.commandsAsync.walletAuth({
          nonce: nonce,
          requestId: "0",
          expirationTime: new Date(
            new Date().getTime() + 7 * 24 * 60 * 60 * 1000
          ), // 7 days
          notBefore: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // 1 day ago
          statement: "Sign in to ShieldRamp to access P2P trading features",
        });

      if (finalPayload.status === "error") {
        throw new Error("Wallet authentication failed");
      }

      // Verify the signature on backend
      const response = await fetch("/api/complete-siwe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: finalPayload,
          nonce,
        }),
      });

      const verificationResult = await response.json();

      if (verificationResult.isValid) {
        // Set user info and authentication state
        const userData = {
          name: MiniKit.user?.username || MiniKit.user?.name || "User",
          address: finalPayload.address,
        };

        setUserInfo(userData);
        setIsAuthenticated(true);
        saveUserSession(userData); // Save to localStorage
        console.log("User authenticated successfully:", finalPayload.address);
      } else {
        throw new Error("Authentication verification failed");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      alert(`Authentication failed: ${error.message}`);
    }

    setIsAuthenticating(false);
  };

  useEffect(() => {
    // Install MiniKit if not already installed
    MiniKit.install();

    // Check if MiniKit is ready
    const checkMiniKitReady = () => {
      if (MiniKit.isInstalled()) {
        setIsWorldAppReady(true);
        console.log("MiniKit is ready");

        // Try to restore session from localStorage
        const savedSession = loadUserSession();
        if (savedSession) {
          console.log("Restoring saved session:", savedSession);
          setUserInfo(savedSession);
          setIsAuthenticated(true);
          setSessionRestored(true);
        }
      } else {
        console.log("MiniKit not ready yet, retrying...");
        setTimeout(checkMiniKitReady, 100);
      }
    };

    // Initial check
    checkMiniKitReady();

    // Subscribe to sendTransaction responses
    const unsubscribe = MiniKit.subscribe(
      ResponseEvent.MiniAppSendTransaction,
      async (response) => {
        console.log("Send Transaction Response:", response);
        if (response.status === "success") {
          setTransactionStatus(
            `Transaction sent successfully! Transaction ID: ${response.transaction_id}`
          );
          setTransactionId(response.transaction_id);
          console.log("Transaction:", response);

          // Refresh data after successful transaction
          setTimeout(() => {
            loadContractData();
          }, 2000);
        } else {
          setTransactionStatus(`Transaction failed: ${response.error_code}`);
          console.error("Transaction failed:", response);
        }
        setIsLoading(false);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const initializePluto = async () => {
      await Pluto.initialize(hooks);
    };
    initializePluto();
  }, [isWorldAppReady]);

  useEffect(() => {
    if (!showClaimForm) return;

    const connectPluto = async () => {
      await Pluto.connect(`
import { createSession } from "@plutoxyz/automation";
import { chromium } from "playwright-core";

async function main() {
  const session = await createSession();
  let browser;

  try {
    // Setup browser
    browser = await chromium.connectOverCDP(await session.cdp());
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // Prompt for credentials (email + password)
    const [email, password] = await session.prompt({
      title: "Login to Amazon pay",
      description: "Enter your email and password to login to Amazon",
      prompts: [
        { label: "Email", type: "text", attributes: {} },
        { label: "Password", type: "password", attributes: {} },
      ],
    });

    // Navigate to login page
    await page.goto("https://amazon.in/pay/history");

    // Fill email and click continue
    await page.waitForSelector("#ap_email", { timeout: 5000 });
    await page.fill("#ap_email", email);
    await page.press("#ap_email", "Enter");

    // Wait for password field
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("#ap_password", { timeout: 5000 });

    // Fill password and submit
    await page.fill("#ap_password", password);
    await page.press("#ap_password", "Enter");

    try {
      await page.waitForSelector("#auth-send-code", { timeout: 5000 });
      // Click the send code button if it exists
      await page.click("#auth-send-code");
    } catch (e) {
      console.log("No Confirmation code field detected, continuing...");
    }

    // --- 2FA OTP step ---
    try {
      await page.waitForSelector("#auth-mfa-otpcode", { timeout: 5000 });
      // Prompt user for OTP
      const [otp] = await session.prompt({
        title: "Two-Factor Authentication",
        description: "Enter the OTP code sent to your device",
        prompts: [{ label: "OTP", type: "text", attributes: { length: 6 } }],
      });
      await page.fill("#auth-mfa-otpcode", otp);
      await page.press("#auth-mfa-otpcode", "Enter");
      console.log("2FA OTP submitted");
    } catch (e) {
      console.log("No 2FA OTP field detected, continuing...");
    }

    // Log current page URL and title
    const currentUrl = page.url();
    const currentTitle = await page.title();
    console.log("Current page URL:", currentUrl);
    console.log("Current page title:", currentTitle);

    // Wait for /pay/history page to load after authentication
    await page.waitForURL("**/pay/history", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // --- After submitting 2FA OTP i.e navigatated to /pay/history ---
    try {
      // Click first <a> inside #transaction
      // Using page.locator

      const firstLink = page.locator("#transaction-desktop > a").first();

      await firstLink.click();
    } catch (e) {
      console.error("Error navigating to transaction:", e);
    }

    try {
      // Wait for transaction receipt to load
      await page.waitForSelector("#payui-transaction-receipt-id", {
        timeout: 5000,
      });
      const dataValue = await page
        .locator("#payui-transaction-receipt-id")
        .getAttribute("data");
      console.log("Data attribute:", dataValue);

      const data = JSON.parse(dataValue);

      const paymentTotalAmount = data.paymentStatusDetails.paymentAmount;
      const paymentStatusTitle = data.paymentStatusDetails.status;

      const receiverUpiId =
        data.paymentEntityOfTypePaymentMethodEntity.paymentMethodInstruments[0]
          .unmaskedVpaId;

      const upi_transaction_id =
        data.identifierEntities[0].identifierValues[0].ctaTitle;

      // Generate proof
      await session.prove("transaction", {
        paymentStatusTitle,
        paymentTotalAmount,
        receiverUpiId,
        upi_transaction_id,
      });
    } catch (e) {
      console.error("Error scraping receipt:", e);
    }
  } catch (err) {
    console.error("Error in automation script:", err);
    throw err;
  } finally {
    try {
      if (browser) {
        const contexts = browser.contexts();
        for (const ctx of contexts) {
          for (const p of ctx.pages()) {
            try {
              await p.close();
            } catch (_) {}
          }
        }
        try {
          await browser.close();
        } catch (_) {}
      }
    } catch (_) {}
    try {
      await session.close();
    } catch (_) {}
  }
}

main().catch(() => process.exit(1));

      `);
    };

    connectPluto();
  }, [showClaimForm]);

  // Load contract data when user is authenticated
  useEffect(() => {
    if (isWorldAppReady) {
      loadContractData();
    }
  }, [isWorldAppReady]);

  // When buyerIntent or deposits change, update activeIntentDeposit
  useEffect(() => {
    if (buyerIntent && deposits.length > 0) {
      const found = deposits.find(
        (d) => String(d.id) === String(buyerIntent.depositId)
      );
      setActiveIntentDeposit(found || null);
    } else {
      setActiveIntentDeposit(null);
    }
  }, [buyerIntent, deposits]);

  // Load contract data
  const loadContractData = async () => {
    setIsRefreshing(true);
    try {
      // Get deposit counter
      const counter = await client.readContract({
        address: escrowV1Address,
        abi: escrowABI,
        functionName: "depositCounter",
      });

      console.log("Deposit counter:", counter);

      // Load recent deposits
      const depositList = [];
      for (let i = 1; i <= Math.min(Number(counter), 10); i++) {
        try {
          const deposit = await client.readContract({
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "deposits",
            args: [i],
          });

          if (deposit[0] !== "0x0000000000000000000000000000000000000000") {
            depositList.push({
              id: i,
              seller: deposit[0],
              upiId: deposit[1],
              remainingFunds: deposit[2],
              minimumAmount: deposit[3],
            });
          }
        } catch (error) {
          console.error(`Error loading deposit ${i}:`, error);
        }
      }

      setDeposits(depositList);

      // Load user's seller deposits
      if (userInfo?.address) {
        const userDeposits = depositList.filter(
          (d) => d.seller.toLowerCase() === userInfo.address.toLowerCase()
        );
        setSellerDeposits(userDeposits);

        // Load buyer intent
        try {
          const intent = await client.readContract({
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "buyerIntents",
            args: [userInfo.address],
          });

          if (intent[1] > 0) {
            // amount > 0
            setBuyerIntent({
              buyer: intent[0],
              amount: intent[1],
              timestamp: intent[2],
              claimed: intent[3],
              depositId: intent[4],
            });
          } else {
            setBuyerIntent(null);
          }
        } catch (error) {
          console.error("Error loading buyer intent:", error);
          setBuyerIntent(null);
        }
      }
    } catch (error) {
      console.error("Error loading contract data:", error);
    }
    setIsRefreshing(false);
  };

  // Load history from logs
  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const toBlock = await client.getBlockNumber();
      const fromBlock = toBlock > 150000n ? toBlock - 150000n : 0n;

      const evFundsDeposited = parseAbiItem(
        "event FundsDeposited(uint256 depositId, address seller, string upiId, uint256 remainingFunds, uint256 minimumAmount)"
      );
      const evBuyerIntent = parseAbiItem(
        "event BuyerIntent(uint256 depositId, address buyer, uint256 amount)"
      );
      const evIntentCancelled = parseAbiItem(
        "event IntentCancelled(address buyer, uint256 depositId)"
      );
      const evPaymentClaimed = parseAbiItem(
        "event PaymentClaimed(address buyer, uint256 wldAmount, string upiTransactionId)"
      );
      const evFundsWithdrawn = parseAbiItem(
        "event FundsWithdrawn(address seller, uint256 depositId, uint256 amount)"
      );

      const [logsDeposited, logsIntent, logsCancelled, logsClaimed, logsWithdrawn] = await Promise.all([
        client.getLogs({ address: escrowV1Address, event: evFundsDeposited, fromBlock, toBlock }),
        client.getLogs({ address: escrowV1Address, event: evBuyerIntent, fromBlock, toBlock }),
        client.getLogs({ address: escrowV1Address, event: evIntentCancelled, fromBlock, toBlock }),
        client.getLogs({ address: escrowV1Address, event: evPaymentClaimed, fromBlock, toBlock }),
        client.getLogs({ address: escrowV1Address, event: evFundsWithdrawn, fromBlock, toBlock }),
      ]);

      const normalize = [];
      for (const l of logsDeposited) {
        normalize.push({
          type: "FundsDeposited",
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          data: {
            depositId: l.args.depositId,
            seller: l.args.seller,
            upiId: l.args.upiId,
            remainingFunds: l.args.remainingFunds,
            minimumAmount: l.args.minimumAmount,
          },
        });
      }
      for (const l of logsIntent) {
        normalize.push({
          type: "BuyerIntent",
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          data: {
            depositId: l.args.depositId,
            buyer: l.args.buyer,
            amount: l.args.amount,
          },
        });
      }
      for (const l of logsCancelled) {
        normalize.push({
          type: "IntentCancelled",
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          data: {
            buyer: l.args.buyer,
            depositId: l.args.depositId,
          },
        });
      }
      for (const l of logsClaimed) {
        normalize.push({
          type: "PaymentClaimed",
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          data: {
            buyer: l.args.buyer,
            wldAmount: l.args.wldAmount,
            upiTransactionId: l.args.upiTransactionId,
          },
        });
      }
      for (const l of logsWithdrawn) {
        normalize.push({
          type: "FundsWithdrawn",
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          data: {
            seller: l.args.seller,
            depositId: l.args.depositId,
            amount: l.args.amount,
          },
        });
      }

      normalize.sort((a, b) => Number(b.blockNumber - a.blockNumber));
      setHistoryEvents(normalize);
    } catch (e) {
      console.error("Error loading history logs:", e);
      setHistoryEvents([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Auto-refresh: on new blocks (polling), on focus/visibility, periodic backup, and after confirmations
  useEffect(() => {
    if (!isWorldAppReady) return;
    let lastCallTs = 0;
    const unwatch = client.watchBlockNumber({
      pollingInterval: 6000,
      onBlockNumber: () => {
        const now = Date.now();
        if (isRefreshing) return;
        if (now - lastCallTs < 4000) return;
        lastCallTs = now;
        loadContractData();
        loadHistory();
      },
      onError: (e) => console.error("watchBlockNumber error", e),
    });
    return () => {
      if (unwatch) unwatch();
    };
  }, [isWorldAppReady, isRefreshing, userInfo?.address]);

  useEffect(() => {
    if (!isWorldAppReady) return;
    const onFocus = () => {
      if (!isRefreshing) loadContractData();
    };
    const onVisibility = () => {
      if (!document.hidden && !isRefreshing) loadContractData();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isWorldAppReady, isRefreshing]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      if (!isRefreshing) loadContractData();
    }, 20000);
    return () => clearInterval(id);
  }, [isAuthenticated, isRefreshing, userInfo?.address]);

  useEffect(() => {
    if (isWorldAppReady) {
      loadHistory();
    }
  }, [isWorldAppReady, isAuthenticated, userInfo?.address]);

  useEffect(() => {
    if (isConfirmed) {
      loadContractData();
    }
  }, [isConfirmed]);

  // Helper functions to format proof data for contract calls
  const formatProofData = (data) => {
    return Object.entries(data).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  };

  const prepareAttestationInput = (proof) => {
    return {
      version: proof.version,
      scriptRaw: proof.script.raw,
      issuedAt: proof.issued_at,
      nonce: proof.nonce,
      sessionId: proof.session_id,
      data: formatProofData(proof.data),
    };
  };

  const prepareAttestationSignature = (proof) => {
    return {
      digest: proof.digest,
      v: proof.signature_v,
      r: proof.signature_r,
      s: proof.signature_s,
      expectedSigner: proof.signer,
    };
  };

  // Contract interaction functions

  // Seller functions
  const depositFunds = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    if (!upiId || !depositAmount || !minimumAmount) {
      alert("Please fill all fields");
      return;
    }

    if (parseFloat(minimumAmount) > parseFloat(depositAmount)) {
      alert("Minimum amount cannot be greater than deposit amount");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");
    setTransactionId("");

    try {
      // scale to token decimals
      const amount = (parseFloat(depositAmount) * 10 ** 18).toString();
      const minAmount = (parseFloat(minimumAmount) * 10 ** 18).toString();

      const permitTransfer = {
        permitted: {
          token: WORLD_TOKEN_ADDRESS,
          amount: amount,
        },
        nonce: Date.now().toString(),
        deadline: Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString(), // 30 mins ahead
        spender: escrowV1Address,
      };

      const transferDetails = {
        to: escrowV1Address,
        requestedAmount: amount,
      };

      // No manual "permit" or "signature" args here!
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "depositFunds",
            args: [
              upiId.toLowerCase(),
              amount,
              minAmount,
              [
                [
                  permitTransfer.permitted.token,
                  permitTransfer.permitted.amount,
                ],
                permitTransfer.nonce,
                permitTransfer.deadline,
              ],
              [transferDetails.to, transferDetails.requestedAmount],
              "PERMIT2_SIGNATURE_PLACEHOLDER_0",
            ],
          },
        ],
        permit2: [permitTransfer],
      });

      if (finalPayload.status === "error") {
        throw new Error(
          `Deposit failed: ${JSON.stringify(
            finalPayload || finalPayload.error_message
          )}`
        );
      }

      setTransactionStatus(
        `Deposit successful! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);

      // Clear form
      setUpiId("");
      setDepositAmount("");
      setMinimumAmount("");
    } catch (error) {
      console.error("Error depositing funds:", error);
      setTransactionStatus(`Error: ${error.message || String(error)}`);
    }

    setIsLoading(false);
  };

  const withdrawFunds = async (depositId) => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");

    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "withdrawRemainingFunds",
            args: [depositId],
          },
        ],
      });

      if (finalPayload.status === "error") {
        throw new Error(`Withdrawal failed: ${finalPayload.error_code}`);
      }

      setTransactionStatus(
        `Withdrawal successful! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      setTransactionStatus(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  // Buyer functions
  const signalIntent = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    if (!depositId || !buyAmount) {
      alert("Please fill all fields");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");

    try {
      const amount = (parseFloat(buyAmount) * 10 ** 18).toString();

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "signalIntent",
            args: [parseInt(depositId), amount],
          },
        ],
      });

      if (finalPayload.status === "error") {
        throw new Error(`Signal intent failed: ${finalPayload.error_code}`);
      }

      setTransactionStatus(
        `Intent signaled! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);
    } catch (error) {
      console.error("Error signaling intent:", error);
      setTransactionStatus(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  const cancelIntent = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");

    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "cancelIntent",
            args: [],
          },
        ],
      });

      if (finalPayload.status === "error") {
        throw new Error(`Cancel intent failed: ${finalPayload.error_code}`);
      }

      setTransactionStatus(
        `Intent cancelled! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);
      setBuyerIntent(null);
    } catch (error) {
      console.error("Error cancelling intent:", error);
      setTransactionStatus(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  const claimFunds = async () => {
    if (!MiniKit.isInstalled()) {
      alert("World App not detected. Please open this in World App.");
      return;
    }

    if (!proof) {
      alert("Please paste your proof JSON");
      return;
    }

    setIsLoading(true);
    setTransactionStatus("");
    setTransactionId("");

    try {
      // Prepare attestation input and signature
      const input = prepareAttestationInput(proof);
      const signature = prepareAttestationSignature(proof);

      // Use the standard contract call format for MiniKit
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: escrowV1Address,
            abi: escrowABI,
            functionName: "claimFunds",
            args: [input, signature],
          },
        ],
        formatPayload: false,
      });

      if (finalPayload.status === "error") {
        throw new Error(`Claim funds failed: ${JSON.stringify(finalPayload)}`);
      }

      setTransactionStatus(
        `Funds claimed successfully! ID: ${finalPayload.transaction_id}`
      );
      setTransactionId(finalPayload.transaction_id);

      // Clear form and hide it
      setProof(null);
      setShowClaimForm(false);

      // Update buyer intent to reflect claimed status
      if (buyerIntent) {
        setBuyerIntent({
          ...buyerIntent,
          claimed: true,
        });
      }

      // Refresh contract data after successful claim
      setTimeout(() => {
        loadContractData();
      }, 2000);
    } catch (error) {
      console.error("Error claiming funds:", error);
      setTransactionStatus(`Error: ${error}`);
    }

    setIsLoading(false);
  };

  // World ID Verification - Commented for later use
  // const generateProof = async () => {
  //   if (!MiniKit.isInstalled()) {
  //     alert("World App not detected. Please open this in World App.");
  //     return;
  //   }

  //   setIsLoading(true);
  //   setProofData(null);

  //   try {
  //     const verifyPayload = {
  //       action: "uniqueuser", // This should match your action configured in Developer Portal
  //       signal: "", // Optional additional data
  //       verification_level: VerificationLevel.Orb, // Orb | Device
  //     };

  //     // World App will open a drawer prompting the user to confirm the operation
  //     const { finalPayload } = await MiniKit.commandsAsync.verify(
  //       verifyPayload
  //     );

  //     if (finalPayload.status === "error") {
  //       console.log("Error payload", finalPayload);
  //       setIsLoading(false);
  //       return;
  //     }

  //     console.log("World ID Proof Generated:", finalPayload);
  //     setProofData(finalPayload);

  //     // Verify the proof in the backend
  //     const verifyResponse = await fetch("/api/verify", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         payload: finalPayload,
  //         action: "uniqueuser",
  //         signal: "", // Optional
  //       }),
  //     });

  //     const verifyResponseJson = await verifyResponse.json();
  //     if (verifyResponseJson.status === 200) {
  //       console.log("Verification success!");
  //     } else {
  //       console.error("Backend verification failed:", verifyResponseJson);
  //     }

  //     setIsLoading(false);
  //   } catch (error) {
  //     console.error("Error generating proof:", error);
  //     setIsLoading(false);
  //   }
  // };

  // New: Manual refresh button handler
  const handleRefresh = async () => {
    if (isRefreshing) return;
    await loadContractData();
  };

  // --- NEW: Helper to determine if user can signal a new intent ---
  // User can signal a new intent if:
  //   - No intent exists, OR
  //   - There is an intent, but it is claimed (i.e. buyerIntent.claimed === true)
  const canSignalIntent = !buyerIntent || (buyerIntent && buyerIntent.claimed);

  const formatWLD = (v) => (Number(v) / 10 ** 18).toFixed(6);
  const currentBuyStep = buyerIntent && !buyerIntent.claimed ? 3 : selectedDepositId ? 2 : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--surface)]">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🛡️ ShieldRamp
          </h1>
          {isWorldAppReady && (
            <div className="flex items-center space-x-3">
              {isAuthenticated && userInfo ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <div className="font-medium">{userInfo.name}</div>
                    <div className="text-xs">
                      {`${userInfo.address.slice(
                        0,
                        8
                      )}...${userInfo.address.slice(-6)}`}
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {userInfo.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* <button
                  onClick={signOut}
                  className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200"
                >
                  Sign Out
                </button> */}
                </div>
              ) : (
                <button
                  onClick={signInWithWallet}
                  disabled={isAuthenticating}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 hover-lift"
                >
                  {isAuthenticating ? "Signing in..." : "Sign in with Wallet"}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {!isAuthenticated ? (
          // Authentication Required Screen
          <div className="text-center py-16">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md mx-auto">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔐</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Authentication Required
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Please sign in with your wallet to access ShieldRamp's P2P
                  trading features
                </p>
              </div>

              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Secure wallet authentication</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>No personal data stored</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Access to P2P trading</span>
                </div>
              </div>

              {isWorldAppReady ? (
                <button
                  onClick={signInWithWallet}
                  disabled={isAuthenticating}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                >
                  {isAuthenticating ? "Signing in..." : "Sign in with Wallet"}
                </button>
              ) : (
                <div className="text-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    World App not detected. Please open this app in World App.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="mb-8 flex items-center justify-between w-full">
              <div className="flex space-x-1 card-surface rounded-lg p-1 shadow-sm hover-lift animate-fade-in-up w-full">
                <button
                  onClick={() => setActiveTab("buy")}
                  className={`flex-1 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === "buy"
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  💰 Buy
                </button>
                <button
                  onClick={() => setActiveTab("sell")}
                  className={`flex-1 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === "sell"
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  🏪 Sell
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === "history"
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  📜 History
                </button>
              </div>
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`hidden ml-4 flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  isRefreshing
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                }`}
                title="Refresh latest data"
              >
                <svg
                  className={`w-5 h-5 mr-2 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582M20 20v-5h-.581M5.5 19A9 9 0 1 1 19 5.5"
                  />
                </svg>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "buy" ? (
              <div className="space-y-6">
                {/* Current Intent Status */}
                {buyerIntent && !buyerIntent.claimed && (
                  <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      🎯 Active Intent
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Amount:</span>{" "}
                        {(Number(buyerIntent.amount) / 10 ** 18).toFixed(6)} WLD
                      </p>
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Deposit ID:</span>{" "}
                        {buyerIntent.depositId.toString()}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Status:</span>{" "}
                        {buyerIntent.claimed ? "Claimed" : "Active"}
                      </p>
                      {/* Show UPI ID and INR amount if available */}
                      {!buyerIntent.claimed && activeIntentDeposit && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              UPI ID:
                            </span>
                            <span className="ml-2 text-gray-700 dark:text-gray-200 break-all">
                              {activeIntentDeposit.upiId}
                            </span>
                            <CopyButton
                              value={activeIntentDeposit.upiId.toLowerCase()}
                              label="UPI ID"
                            />
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              Amount to Pay (INR):
                            </span>
                            <span className="ml-2 text-gray-700 dark:text-gray-200">
                              {(
                                (Number(buyerIntent.amount) / 10 ** 18) *
                                INR_PER_WLD
                              ).toLocaleString("en-IN", {
                                style: "currency",
                                currency: "INR",
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <CopyButton
                              value={(
                                (Number(buyerIntent.amount) / 10 ** 18) *
                                INR_PER_WLD
                              ).toFixed(2)}
                              label="INR Amount"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {!buyerIntent.claimed && (
                      <div className="mt-4 space-y-3">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setShowClaimForm(!showClaimForm)}
                            disabled={isLoading}
                            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 hover-lift"
                          >
                            {showClaimForm ? "Hide Claim Form" : "Claim Funds"}
                          </button>
                          <button
                            onClick={cancelIntent}
                            disabled={isLoading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                          >
                            {isLoading ? "Cancelling..." : "Cancel Intent"}
                          </button>
                          {proof && (
                            <button
                              onClick={claimFunds}
                              disabled={isLoading}
                              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 hover-lift"
                            >
                              {isLoading
                                ? "Claiming..."
                                : "Submit Proof & Claim"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div id="pluto-frame"></div>
                  </div>
                )}

                {/* Available Deposits */}
                <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      🏪 Available Deposits
                    </h3>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={`hidden flex items-center px-2 py-1 rounded text-xs font-medium transition-colors duration-200 ${
                        isRefreshing
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}
                      title="Refresh latest deposits"
                    >
                      <svg
                        className={`w-4 h-4 mr-1 ${
                          isRefreshing ? "animate-spin" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582M20 20v-5h-.581M5.5 19A9 9 0 1 1 19 5.5"
                        />
                      </svg>
                      {isRefreshing ? "Refreshing" : "Refresh"}
                    </button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {deposits.filter(d => Number(d.remainingFunds) > 0).length > 0 ? (
                      deposits
                        .filter(deposit => Number(deposit.remainingFunds) > 0)
                        .map((deposit) => (
                          <div
                            key={deposit.id}
                            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                          >
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600 dark:text-gray-300">
                                  <span className="font-medium">ID:</span>{" "}
                                  {deposit.id}
                                </p>
                                <p className="text-gray-600 dark:text-gray-300">
                                  <span className="font-medium">UPI ID:</span>{" "}
                                  {deposit.upiId}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 dark:text-gray-300">
                                  <span className="font-medium">Available:</span>{" "}
                                  {formatWLD(deposit.remainingFunds)}{" "}
                                  WLD
                                </p>
                                <p className="text-gray-600 dark:text-gray-300">
                                  <span className="font-medium">Min Amount:</span>{" "}
                                  {formatWLD(deposit.minimumAmount)}{" "}
                                  WLD
                                </p>
                              </div>
                            </div>
                            <div className="pt-3 flex items-center gap-2">
                              <button onClick={() => setSelectedDepositId(deposit.id)} className="px-3 py-2 text-xs bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded">Select</button>
                              <CopyButton value={deposit.upiId.toLowerCase()} label="UPI ID" />
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        No deposits available
                      </p>
                    )}
                  </div>
                </div>

                {/* Signal Intent Form */}
                {canSignalIntent && (
                  <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      📝 Signal Intent to Buy
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Deposit ID
                        </label>
                        <input
                          type="number"
                          value={depositId || selectedDepositId || ""}
                          onChange={(e) => setDepositId(e.target.value)}
                          placeholder="Enter deposit ID"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Amount (WLD)
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          placeholder="Enter amount in WLD"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <button
                        onClick={signalIntent}
                        disabled={
                          !isAuthenticated ||
                          !(depositId || selectedDepositId) ||
                          !buyAmount ||
                          isLoading
                        }
                        className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 hover-lift"
                      >
                        {isLoading ? "Signaling Intent..." : "Signal Intent"}
                      </button>
                    </div>
                  </div>
                )}
                {/* If user has a claimed intent, show a message */}
                {buyerIntent && buyerIntent.claimed && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 rounded-lg p-4 mt-4 text-sm">
                    <span className="font-medium">You have successfully claimed your last intent. You can trade again by signaling a new intent below.</span>
                  </div>
                )}
              </div>
            ) : activeTab === "sell" ? (
              <div className="space-y-6">
                {/* Welcome Message */}
                <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Welcome back, {userInfo.name}! Ready to sell your WLD.
                      </span>
                    </div>
                    {sessionRestored && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                        Session restored
                      </span>
                    )}
                  </div>
                </div>

                {/* Deposit Funds Form */}
                <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    💳 Deposit WLD for Sale
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        UPI ID
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="Enter your UPI ID"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deposit Amount (WLD)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Enter amount to deposit"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Minimum Amount (WLD)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={minimumAmount}
                        onChange={(e) => setMinimumAmount(e.target.value)}
                        placeholder="Minimum purchase amount"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={depositFunds}
                      disabled={
                        !isAuthenticated ||
                        !upiId ||
                        !depositAmount ||
                        !minimumAmount ||
                        isLoading
                      }
                      className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 hover-lift"
                    >
                      {isLoading ? "Depositing..." : "Deposit Funds"}
                    </button>
                  </div>
                </div>

                {/* Your Deposits */}
                <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      📊 Your Deposits
                    </h3>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={`hidden flex items-center px-2 py-1 rounded text-xs font-medium transition-colors duration-200 ${
                        isRefreshing
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}
                      title="Refresh your deposits"
                    >
                      <svg
                        className={`w-4 h-4 mr-1 ${
                          isRefreshing ? "animate-spin" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582M20 20v-5h-.581M5.5 19A9 9 0 1 1 19 5.5"
                        />
                      </svg>
                      {isRefreshing ? "Refreshing" : "Refresh"}
                    </button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {sellerDeposits.length > 0 ? (
                      sellerDeposits.map((deposit) => (
                        <div
                          key={deposit.id}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 text-sm">
                              <p className="text-gray-600 dark:text-gray-300">
                                <span className="font-medium">ID:</span>{" "}
                                {deposit.id}
                              </p>
                              <p className="text-gray-600 dark:text-gray-300">
                                <span className="font-medium">UPI ID:</span>{" "}
                                {deposit.upiId}
                              </p>
                              <p className="text-gray-600 dark:text-gray-300">
                                <span className="font-medium">Remaining:</span>{" "}
                                {(
                                  Number(deposit.remainingFunds) /
                                  10 ** 18
                                ).toFixed(6)}{" "}
                                WLD
                              </p>
                              <p className="text-gray-600 dark:text-gray-300">
                                <span className="font-medium">Min Amount:</span>{" "}
                                {(
                                  Number(deposit.minimumAmount) /
                                  10 ** 18
                                ).toFixed(6)}{" "}
                                WLD
                              </p>
                            </div>
                            {Number(deposit.remainingFunds) > 0 && (
                              <button
                                onClick={() => withdrawFunds(deposit.id)}
                                disabled={isLoading}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors duration-200"
                              >
                                {isLoading ? "Withdrawing..." : "Withdraw"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        No deposits found
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📜 History</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={historyMineOnly} onChange={(e) => setHistoryMineOnly(e.target.checked)} />
                        <span>My activity</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto text-sm">
                    {isLoadingHistory ? (
                      <p className="text-gray-500">Loading history…</p>
                    ) : historyEvents.length === 0 ? (
                      <p className="text-gray-500">No recent activity</p>
                    ) : (
                      historyEvents
                        .filter((e) => {
                          if (!historyMineOnly || !userInfo?.address) return true;
                          const addr = userInfo.address.toLowerCase();
                          const d = e.data || {};
                          return (
                            d.buyer?.toLowerCase?.() === addr ||
                            d.seller?.toLowerCase?.() === addr
                          );
                        })
                        .slice(0, 100)
                        .map((e, idx) => (
                          <div key={`${e.txHash}-${idx}`} className="border border-[var(--border)] rounded p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{e.type}</span>
                              <span className="text-xs text-gray-500">Block {String(e.blockNumber)}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                              {e.type === "FundsDeposited" && (
                                <span>Seller {e.data.seller?.slice(0, 6)}…{e.data.seller?.slice(-4)} • ID {String(e.data.depositId)} • {formatWLD(e.data.remainingFunds)} WLD</span>
                              )}
                              {e.type === "BuyerIntent" && (
                                <span>Buyer {e.data.buyer?.slice(0, 6)}…{e.data.buyer?.slice(-4)} • Deposit {String(e.data.depositId)} • {formatWLD(e.data.amount)} WLD</span>
                              )}
                              {e.type === "IntentCancelled" && (
                                <span>Buyer {e.data.buyer?.slice(0, 6)}…{e.data.buyer?.slice(-4)} cancelled • Deposit {String(e.data.depositId)}</span>
                              )}
                              {e.type === "PaymentClaimed" && (
                                <span>Buyer {e.data.buyer?.slice(0, 6)}…{e.data.buyer?.slice(-4)} claimed {formatWLD(e.data.wldAmount)} WLD</span>
                              )}
                              {e.type === "FundsWithdrawn" && (
                                <span>Seller {e.data.seller?.slice(0, 6)}…{e.data.seller?.slice(-4)} withdrew {formatWLD(e.data.amount)} WLD • ID {String(e.data.depositId)}</span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Status */}
            {(transactionStatus || isConfirmed) && (
              <div
                className={`mt-6 p-4 rounded-lg ${
                  transactionStatus.includes("successful") ||
                  transactionStatus.includes("sent") ||
                  isConfirmed
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

            {/* Instructions */}
            <div className="mt-8 card-surface rounded-xl p-6 hover-lift animate-fade-in-up">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                📋 How it Works
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    🏪 Selling WLD:
                  </h4>
                  <p>
                    1. Deposit WLD tokens with your UPI ID and minimum purchase
                    amount
                  </p>
                  <p>2. Buyers will signal intent and pay you via UPI</p>
                  <p>3. You can withdraw remaining funds anytime</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    💰 Buying WLD:
                  </h4>
                  <p>
                    1. Browse available deposits and signal intent for desired
                    amount
                  </p>
                  <p>2. Pay the seller via UPI using their provided UPI ID</p>
                  <p>3. Get your payment proof JSON from the payment system</p>
                  <p>
                    4. Paste the proof JSON and click "Claim Funds" to receive
                    your WLD tokens
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
