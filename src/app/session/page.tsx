"use client";

import { useState, useEffect, useCallback } from "react";
import { Hex, P256, PublicKey, Signature } from "ox";
import { Hooks } from "rise-wallet/wagmi";
import { parseEther, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { useReadContract, useChainId, useConnection } from "wagmi";
import { STK, COUNTER, BURN_ADDRESS, erc20Abi, counterAbi } from "@/constants";

function storageKey(address: string) {
  return `simple_cookbook_${address}_session_key`;
}

export default function SessionPage() {
  const { address, connector } = useConnection();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // session key state derived from localStorage + permissions
  const [sessionPrivateKey, setSessionPrivateKey] = useState<string | null>(null);
  const [sessionPublicKey, setSessionPublicKey] = useState<string | null>(null);

  const grantPermissions = Hooks.useGrantPermissions();
  const revokePermissions = Hooks.useRevokePermissions();
  const { data: permissions, refetch: refetchPermissions } = Hooks.usePermissions();

  console.log("permissions", permissions);

  // find the on-chain permission that matches our stored session key
  const activePermission = permissions?.find(
    (p) => sessionPublicKey && p.key.publicKey === sessionPublicKey && p.expiry > Math.floor(Date.now() / 1000)
  );
  const hasSession = !!activePermission && !!sessionPrivateKey;

  // load from localStorage once mounted
  useEffect(() => {
    setMounted(true);
    if (!address) return;
    const pk = localStorage.getItem(storageKey(address));
    if (pk) {
      setSessionPrivateKey(pk);
      setSessionPublicKey(PublicKey.toHex(P256.getPublicKey({ privateKey: pk as `0x${string}` }), { includePrefix: false }));
    }
  }, [address]);

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

  // --- session key actions ---

  const createSession = async () => {
    // generate a new P256 keypair locally
    const privateKey = P256.randomPrivateKey();
    const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), { includePrefix: false });

    // grant on-chain permissions for this public key with allowed calls + spend limits
    await grantPermissions.mutateAsync({
      key: { publicKey, type: "p256" },
      expiry: Math.floor(Date.now() / 1000) + 86400, // current time + 86400 seconds (1 day)
      feeToken: null,
      permissions: {
        calls: [
          { to: COUNTER, signature: "0xd09de08a" },   // increment()
          { to: STK, signature: "0x40c10f19" },        // mint(address,uint256)
          { to: STK, signature: "0xa9059cbb" },        // transfer(address,uint256)
        ],
        spend: [
          { token: "0x8a93d247134d91e0de6f96547cb0204e5be8e5d8", limit: parseUnits("50", 6), period: "minute" },
          { token: "0x0000000000000000000000000000000000000000", limit: parseEther("20"), period: "hour" },
          { token: "0x4200000000000000000000000000000000000006", limit: parseEther("20"), period: "minute" },
          { token: STK, limit: parseEther("100"), period: "hour" },
        ],
      },
    });

    // store the private key in localStorage, keyed by address
    localStorage.setItem(storageKey(address!), privateKey);
    setSessionPrivateKey(privateKey);
    setSessionPublicKey(publicKey);
    refetchPermissions();
  };

  // revokes the session key on-chain and clears it from localStorage
  const revokeSession = async () => {
    if (!activePermission) return;
    await revokePermissions.mutateAsync({ id: activePermission.id });
    localStorage.removeItem(storageKey(address!));
    setSessionPrivateKey(null);
    setSessionPublicKey(null);
    refetchPermissions();
  };

  // --- tx helper ---

  const sendWithSessionKey = useCallback(async (action: string, calls: { to: string; data: string }[]) => {
    const privateKey = sessionPrivateKey! as `0x${string}`;
    const publicKey = sessionPublicKey!;
    const provider = (await connector!.getProvider()) as any;

    setPendingAction(action);
    setTxHash(null);
    try {
      // prepare the calls, wallet returns a digest to sign with the session key
      const { digest, capabilities, ...request } = await provider.request({
        method: "wallet_prepareCalls",
        params: [{
          calls,
          chainId: Hex.fromNumber(chainId),
          from: address,
          atomicRequired: true,
          key: { publicKey, type: "p256" },
        }],
      });

      // sign the digest locally with the session key private key
      const signature = Signature.toHex(
        P256.sign({ payload: digest as `0x${string}`, privateKey })
      );

      // send the signed calls to the wallet
      const result = await provider.request({
        method: "wallet_sendPreparedCalls",
        params: [{ ...request, ...(capabilities ? { capabilities } : {}), signature }],
      });

      // poll for the tx receipt using the call bundle id
      const id = Array.isArray(result) ? result[0].id : result.id;
      const status = await provider.request({
        method: "wallet_getCallsStatus",
        params: [id],
      });
      if (status.status !== 200) {
        throw new Error(`Call failed: status ${status.status}, id ${id}`);
      }
      setTxHash(status.receipts[0].transactionHash);
    } finally {
      setPendingAction(null);
    }
  }, [address, chainId, connector, sessionPrivateKey, sessionPublicKey]);

  // --- button handlers ---

  // for minting STK
  const handleMint = () => sendWithSessionKey("mint", [{
    to: STK,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "mint", args: [address!, parseEther("1000")] }),
  }]).then(() => refetchBalance());

  // for spending STK
  const handleSpend = () => sendWithSessionKey("spend", [{
    to: STK,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [BURN_ADDRESS, parseEther("5")] }),
  }]).then(() => refetchBalance());

  // increment counter
  const handleIncrement = () => sendWithSessionKey("increment", [{
    to: COUNTER,
    data: encodeFunctionData({ abi: counterAbi, functionName: "increment", args: [] }),
  }]).then(() => refetchCount());


  if (!mounted) return null;

  if (!hasSession) {
    return (
      <div className="flex items-center justify-center bg-zinc-50 dark:bg-black" style={{ height: "calc(100vh - 56px)" }}>
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Session Key</h1>
            <p className="text-zinc-500 text-base max-w-sm">
              A P256 keypair is generated locally and granted scoped on-chain permissions. Transactions are signed client-side, no wallet popups needed. STK is a mock token (Simple Token).
            </p>
          </div>
          <button
            onClick={createSession}
            disabled={grantPermissions.isPending}
            className="rounded-full bg-[#4ade80] px-8 h-14 text-lg text-black font-semibold hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {grantPermissions.isPending ? "Creating..." : "Create Session Key"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center bg-zinc-50 dark:bg-black" style={{ height: "calc(100vh - 56px)" }}>
      <div className="flex flex-col items-center gap-8 w-full max-w-lg px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Session Key</h1>
          <p className="text-zinc-500 text-base max-w-sm">
            Calls are prepared via <code className="text-zinc-400">wallet_prepareCalls</code>, signed locally with the session key, then sent via <code className="text-zinc-400">wallet_sendPreparedCalls</code>. STK is a mock token (Simple Token).
          </p>
        </div>

        {/* Session public key + revoke */}
        <div className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-sm">Session Key (P256)</span>
            <button
              onClick={revokeSession}
              disabled={revokePermissions.isPending}
              className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {revokePermissions.isPending ? "Revoking..." : "Revoke"}
            </button>
          </div>
          <p className="text-zinc-300 text-sm font-mono mt-1 break-all">{sessionPublicKey}</p>
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
