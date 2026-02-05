export const STK = "0x2Fe6B2b6e895fc0Ad192A249C3240685Ecbb177C" as const;
export const COUNTER = "0xD38794596a78A0E446a8A61d9d04466118b30809" as const;
export const BURN_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "mint", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

export const counterAbi = [
  { type: "function", name: "count", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "increment", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;
