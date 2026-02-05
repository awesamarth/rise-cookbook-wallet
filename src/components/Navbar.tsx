"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-black border-b border-zinc-800">
      <div className="flex items-center gap-6">
        <Link href="/">
          <h1 className="text-lg font-semibold text-[#4ade80]">RISE Cookbook | Wallet</h1>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/passkey"
            className={`text-sm transition-colors ${
              pathname === "/passkey"
                ? "text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Passkey
          </Link>
          <Link
            href="/session"
            className={`text-sm transition-colors ${
              pathname === "/session"
                ? "text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Session Key
          </Link>
        </div>
      </div>
      <WalletButton />
    </nav>
  );
}
