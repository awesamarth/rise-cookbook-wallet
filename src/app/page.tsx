"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useConnection, useConnect, useConnectors } from "wagmi";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { address } = useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const rwConnector = connectors.find((c) => c.id === "com.risechain.wallet");

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-center bg-zinc-50 dark:bg-black" style={{ height: "calc(100vh - 56px)" }}>
      <main className="flex flex-col items-center gap-16 px-6 w-full max-w-4xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-semibold text-black dark:text-zinc-50">
            RISE Wallet <span className="text-[#4ade80]">Quickstart</span>
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-lg">
            Explore two ways to interact with the blockchain using RISE Wallet. Sign with your passkey, or create a session key for seamless transactions.
          </p>
          {!address && (
            <button
              onClick={() => rwConnector && connect.mutate({ connector: rwConnector })}
              className="mt-4 rounded-full bg-[#4ade80] px-10 h-14 text-lg font-semibold text-black hover:bg-[#22c55e] transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {address ? (
          <div className="w-full max-w-3xl grid grid-cols-2 gap-6">
            <Link
              href="/passkey"
              className="group flex flex-col justify-between rounded-3xl border border-zinc-700 bg-zinc-800 p-7 hover:border-[#4ade80] transition-colors aspect-square"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-700">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="mt-5">
                <h2 className="text-zinc-100 font-semibold text-2xl group-hover:text-[#4ade80] transition-colors">Passkey</h2>
                <p className="text-zinc-400 text-base mt-2">Sign transactions directly with your passkey. Each call goes through the wallet for approval.</p>
              </div>
            </Link>

            <Link
              href="/session"
              className="group flex flex-col justify-between rounded-3xl border border-zinc-700 bg-zinc-800 p-7 hover:border-[#4ade80] transition-colors aspect-square"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-700">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="mt-5">
                <h2 className="text-zinc-100 font-semibold text-2xl group-hover:text-[#4ade80] transition-colors">Session Key</h2>
                <p className="text-zinc-400 text-base mt-2">Create a P256 session key with scoped permissions. Sign locally without wallet popups.</p>
              </div>
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
