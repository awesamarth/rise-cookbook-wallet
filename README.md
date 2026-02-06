# RISE Wallet Quickstart

A minimal Next.js cookbook demonstrating how to integrate [RISE Wallet](https://risechain.com) into your application. This project showcases two core transaction signing patterns: direct passkey signing and session key-based signing.

## Features

- **Passkey Flow**: Sign transactions directly with your passkey — each call triggers a wallet popup for approval
- **Session Key Flow**: Create a scoped P256 session key to sign transactions client-side without wallet popups
- **Batch Transactions**: Both flows support batching multiple calls into a single atomic transaction
- **Mock Contracts**: Interact with test contracts (Simple Token & Counter) on RISE Testnet

## Getting Started

### Prerequisites

- Node.js 18+ and Bun (or npm/yarn/pnpm)

### Installation

```bash
# Clone the repository
git clone https://github.com/awesamarth/rise-cookbook-wallet
cd rise-cookbook-wallet

# Install dependencies
bun install

# Run the development server
bun dev
```

Open [https://localhost:3000](https://localhost:3000) and connect your RISE Wallet.

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page with flow selection
│   ├── passkey/          # Passkey flow demo
│   └── session/          # Session key flow demo
├── components/
│   ├── Navbar.tsx        # Navigation & wallet connection
│   └── WalletButton.tsx  # Connect/disconnect button
├── config/
│   └── wagmi.ts          # Wagmi + RISE Wallet configuration
└── constants/
    └── index.ts          # Contract addresses & ABIs
```

## Integration Guide

### 1. Configure Wagmi with RISE Wallet

```typescript
import { Chains, RiseWallet } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import { createConfig, http } from "wagmi";

export const config = createConfig({
  chains: [Chains.riseTestnet],
  connectors: [riseWallet(RiseWallet.defaultConfig)],
  transports: {
    [Chains.riseTestnet.id]: http("https://testnet.riselabs.xyz"),
  },
});
```

### 2. Passkey Flow (Direct Signing)

Use viem's `sendCallsSync` to batch calls and wait for on-chain confirmation:

```typescript
import { createWalletClient, custom } from "viem";
import { Chains } from "rise-wallet";

const provider = await connector.getProvider();
const walletClient = createWalletClient({
  chain: Chains.riseTestnet,
  transport: custom(provider),
  account: address,
});

// Batch multiple calls — wallet popup will appear for approval
const status = await walletClient.sendCallsSync({
  calls: [
    { to: contractAddress, data: encodedData1 },
    { to: contractAddress, data: encodedData2 },
  ],
});

// Status includes receipts with transaction hashes
const txHash = status.receipts[0].transactionHash;
```

**Key Points:**
- Each `sendCallsSync` triggers a wallet popup
- Calls are batched atomically via `wallet_sendCalls`
- Automatically polls `wallet_getCallsStatus` until confirmed

### 3. Session Key Flow (Background Signing)

Create a P256 session key with scoped permissions for gasless, popup-free transactions:

#### Step 1: Grant Permissions

```typescript
import { P256, PublicKey } from "ox";
import { Hooks } from "rise-wallet/wagmi";

// Generate a P256 keypair locally
const privateKey = P256.randomPrivateKey();
const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
  includePrefix: false
});

// Grant on-chain permissions for this key
const grantPermissions = Hooks.useGrantPermissions();
await grantPermissions.mutateAsync({
  key: { publicKey, type: "p256" },
  expiry: Math.floor(Date.now() / 1000) + 86400, // 1 day
  feeToken: null,
  permissions: {
    calls: [
      { to: contractAddress, signature: "0xd09de08a" }, // increment()
      { to: tokenAddress, signature: "0x40c10f19" },    // mint(address,uint256)
    ],
    spend: [
      {
        token: tokenAddress,
        limit: parseEther("100"),
        period: "hour"
      },
    ],
  },
});

// Store private key securely (localStorage in this demo)
localStorage.setItem(`session_key_${address}`, privateKey);
```

#### Step 2: Sign with Session Key

```typescript
import { Hex, P256, Signature } from "ox";

const provider = await connector.getProvider();

// Prepare calls — wallet returns a digest to sign
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

// Sign locally with session key private key (no popup!)
const signature = Signature.toHex(
  P256.sign({ payload: digest, privateKey })
);

// Send signed calls
const result = await provider.request({
  method: "wallet_sendPreparedCalls",
  params: [{ ...request, ...(capabilities ? { capabilities } : {}), signature }],
});

// Poll for receipt
const id = Array.isArray(result) ? result[0].id : result.id;
const status = await provider.request({
  method: "wallet_getCallsStatus",
  params: [id],
});
```

#### Step 3: Revoke Session Key

```typescript
const revokePermissions = Hooks.useRevokePermissions();
const { data: permissions } = Hooks.usePermissions();

const activePermission = permissions.find(
  p => p.key.publicKey === sessionPublicKey && p.expiry > Date.now() / 1000
);

await revokePermissions.mutateAsync({ id: activePermission.id });
localStorage.removeItem(`session_key_${address}`);
```

## Key Hooks & Actions

### RISE Wallet Hooks

```typescript
import { Hooks } from "rise-wallet/wagmi";

// Grant scoped permissions for a session key
Hooks.useGrantPermissions()

// List all active permissions for the connected account
Hooks.usePermissions()

// Revoke a specific permission by ID
Hooks.useRevokePermissions()
```

### Viem Actions

```typescript
// Passkey flow: batch calls and wait for confirmation
walletClient.sendCallsSync({ calls })

// Session key flow: prepare → sign → send
provider.request({ method: "wallet_prepareCalls", params: [...] })
provider.request({ method: "wallet_sendPreparedCalls", params: [...] })
provider.request({ method: "wallet_getCallsStatus", params: [...] })
```

## Test Contracts

This cookbook uses two mock contracts on RISE Testnet:

- **STK (Simple Token)**: ERC-20 token at `0x2Fe6B2b6e895fc0Ad192A249C3240685Ecbb177C`
  - `mint(address, uint256)` - Mint tokens
  - `transfer(address, uint256)` - Transfer tokens

- **Counter**: Simple counter at `0xD38794596a78A0E446a8A61d9d04466118b30809`
  - `increment()` - Increment count
  - `count()` - View current count

## Troubleshooting

### "KeyDoesNotExist()" Error
- The session key hasn't been granted permissions yet, or has expired
- Verify `usePermissions()` returns a valid permission matching your public key

### Hydration Errors
- Always use `mounted` state before rendering wallet-dependent UI
- See `src/app/page.tsx` for reference

## Resources

- [RISE Wallet Documentation](https://docs.risechain.com)
- [RISE Testnet Explorer](https://explorer.testnet.riselabs.xyz)
- [Wagmi Documentation](https://wagmi.sh)
- [Viem Documentation](https://viem.sh)

## License

MIT
