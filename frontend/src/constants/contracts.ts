import { parseAbi } from 'viem';

import dTSLA_JSON from './dTSLA_ABI.json';

export const DTSLA_ADDRESS = '0x1d4706e883278417825232846f1e9C106003aea9';
export const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

export const DTSLA_ABI = dTSLA_JSON.abi;

export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)"
]);
