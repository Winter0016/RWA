import { parseAbi } from 'viem';

import dTSLA_JSON from './dTSLA_ABI.json';

export const DTSLA_ADDRESS = '0xd0AE4d1f4B03fcF186091090ba0b2688f9644C94';
export const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

export const DTSLA_ABI = dTSLA_JSON.abi;

export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)"
]);
