"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnect, useConnection, useDisconnect, useConnectors } from "wagmi";

function truncateAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  if (!mounted) return null;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80]" />
          <span className="text-sm text-zinc-200 font-mono">{truncateAddress(address!)}</span>
          <button
            onClick={handleCopy}
            className="ml-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Copy address"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4ade80]">
                <polyline points="2,8 6,12 14,4" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="8" height="9" rx="1.5" />
                <path d="M5 4V2.5A1.5 1.5 0 0 1 6.5 1h7A1.5 1.5 0 0 1 15 2.5v7A1.5 1.5 0 0 1 13.5 11H12" />
              </svg>
            )}
          </button>
        </div>
        <button
          onClick={() => disconnect.mutate()}
          className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const rwConnector = connectors.find((c) => c.id === "com.risechain.wallet");
  if (!rwConnector) return null;

  return (
    <button
      onClick={() => connect.mutate({ connector: rwConnector })}
      className="rounded-full bg-[#4ade80] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#22c55e] transition-colors"
    >
      Connect Wallet
    </button>
  );
}
