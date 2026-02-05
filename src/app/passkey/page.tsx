"use client";

import { useState, useCallback } from "react";
import { createWalletClient, custom, parseEther, formatUnits, encodeFunctionData } from "viem";
import { Chains } from "rise-wallet";
import { useReadContract, useConnection } from "wagmi";
import { STK, COUNTER, BURN_ADDRESS, erc20Abi, counterAbi } from "@/constants";

export default function PasskeyPage() {
  const { address, connector } = useConnection();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  
  // reading the user's STK balance
  const { data: stkBalance, refetch: refetchBalance } = useReadContract({
    address: STK,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address },
  });
  
  // reading the current count
  const { data: count, refetch: refetchCount } = useReadContract({
    address: COUNTER,
    abi: counterAbi,
    functionName: "count",
  });

  // Thin wrapper around viem's sendCallsSync — handles pendingAction/txHash state, the rest (wallet_sendCalls + polling for receipt) is done by viem internally.
  const send = useCallback(async (action: string, calls: { to: `0x${string}`; data: `0x${string}` }[]) => {
    const provider = (await connector!.getProvider()) as any;
    const walletClient = createWalletClient({
      chain: Chains.riseTestnet,
      transport: custom(provider),
      account: address!,
    });

    setPendingAction(action);
    setTxHash(null);
    try {
      // sends the calls via wallet_sendCalls, polls wallet_getCallsStatus until confirmed, then returns the status with receipts
      const status = await walletClient.sendCallsSync({ calls });
      setTxHash(status.receipts?.[0]?.transactionHash ?? null);
    } finally {
      setPendingAction(null);
    }
  }, [address, connector]);

  // for minting STK
  const handleMint = () => send("mint", [{
    to: STK,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "mint", args: [address!, parseEther("1000")] }),
  }]).then(() => refetchBalance());
  
  // for spending STK 
  const handleSpend = () => send("spend", [{
    to: STK,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [BURN_ADDRESS, parseEther("5")] }),
  }]).then(() => refetchBalance()); 
  
  // increment counter
  const handleIncrement = () => send("increment", [{
    to: COUNTER,
    data: encodeFunctionData({ abi: counterAbi, functionName: "increment", args: [] }),
  }]).then(() => refetchCount());

  return (
    <div className="flex items-center justify-center bg-zinc-50 dark:bg-black" style={{ height: "calc(100vh - 56px)" }}>
      <div className="flex flex-col items-center gap-8 w-full max-w-lg px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Passkey</h1>
          <p className="text-zinc-500 text-base max-w-sm">
            Each action triggers a wallet popup for approval. Viem's <code className="text-zinc-400">sendCallsSync</code> batches calls, waits for on-chain confirmation, and returns the tx hash. STK is a mock token (Simple Token).
          </p>
        </div>

        {/* Stats */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-4">
            <span className="text-zinc-400 text-base">STK Balance</span>
            <span className="text-zinc-100 text-base font-mono">
              {stkBalance !== undefined ? formatUnits(stkBalance, 18) : "—"} STK
            </span>
          </div>
          <div className="flex justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-4">
            <span className="text-zinc-400 text-base">Counter</span>
            <span className="text-zinc-100 text-base font-mono">
              {count !== undefined ? count.toString() : "—"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleMint}
            disabled={pendingAction === "mint"}
            className="w-full rounded-full bg-[#4ade80] h-14 text-lg text-black font-semibold hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === "mint" ? "..." : "Mint 1000 STK"}
          </button>
          <button
            onClick={handleSpend}
            disabled={pendingAction === "spend"}
            className="w-full rounded-full border border-zinc-700 bg-zinc-800 h-14 text-lg text-zinc-200 font-semibold hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === "spend" ? "..." : "Spend 5 STK"}
          </button>
          <button
            onClick={handleIncrement}
            disabled={pendingAction === "increment"}
            className="w-full rounded-full border border-zinc-700 bg-zinc-800 h-14 text-lg text-zinc-200 font-semibold hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === "increment" ? "..." : "Increment Counter"}
          </button>
        </div>

        {/* Last tx hash */}
        {txHash && (
          <a
            href={`https://explorer.testnet.riselabs.xyz/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 text-sm font-mono text-center break-all hover:text-zinc-300 transition-colors"
          >
            tx: {txHash}
          </a>
        )}
      </div>
    </div>
  );
}
