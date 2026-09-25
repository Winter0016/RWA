"use client";

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useReadContract, useDisconnect } from 'wagmi';
import { formatUnits } from 'viem';
import { useSyncUserToDB } from '../hooks/useSyncUserToDB';
import { useSmartAccount } from '../contexts/SmartAccountContext';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Arbitrum Sepolia USDC Contract
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const ERC20_ABI = [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }];

import { GET_USER } from '../graphql/queries';

export default function Header() {
  const pathname = usePathname();
  const { login, authenticated, user, logout, ready, connectWallet, exportWallet } = usePrivy();
  const { smartAccount } = useSmartAccount();
  const smartAccountAddress = smartAccount?.address;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { wallets } = useWallets();
  const { disconnect } = useDisconnect();

  // Handle all the complex database synchronization and state locking in a dedicated hook
  const { finalWalletAddress, connectedWallet } = useSyncUserToDB(smartAccountAddress);

  // Wagmi hook to fetch USDC balance automatically
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccountAddress as `0x${string}`],
    query: {
      enabled: !!smartAccountAddress,
    }
  });

  const formattedUsdc = usdcBalance !== undefined ? formatUnits(usdcBalance as bigint, 6) : '0.00';

  // Fetch the definitive user profile from our PostgreSQL database!
  const { data: userData } = useQuery<any>(GET_USER, {
    variables: { signer_address: finalWalletAddress },
    skip: !finalWalletAddress,
  });

  // Get username from database, fallback to Google/Privy, fallback to local state, fallback to "User"
  const username = userData?.userBySigner?.name || user?.google?.name || user?.google?.email || user?.email?.address || 'User';

  console.log("userdata: ", userData);
  console.log("verified: ", userData?.userBySigner?.is_whitelisted);

  return (
    <header className="w-full bg-[#0B0F19] border-b border-[#1E293B]">
      <div className="max-w-360 mx-auto px-6">
        <div className="flex justify-between items-center h-16">

          {/* Logo / Branding */}
          <Link href="/" className="shrink-0 flex items-center cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
              <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ml-3 text-lg font-semibold text-white tracking-tight">
              Backed Protocol
            </span>
          </Link>

          {/* Navigation Links (Ondo Style) */}
          <nav className="hidden md:flex space-x-1 pl-12 flex-1">
            <Link
              href="/markets"
              className={`px-3 py-2 text-sm font-medium transition-colors ${pathname === '/markets'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Markets
            </Link>
            <Link
              href="/portfolio"
              className={`px-3 py-2 text-sm font-medium transition-colors ${pathname === '/portfolio'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Portfolio
            </Link>
            <Link
              href="/transactions"
              className={`px-3 py-2 text-sm font-medium transition-colors ${pathname === '/transactions'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Transactions
            </Link>

            {userData?.userBySigner?.role === 'admin' && (
              <Link
                href="/admin"
                className={`px-3 py-2 text-sm font-medium transition-colors ${pathname === '/admin'
                  ? 'text-purple-400 border-b-2 border-purple-500'
                  : 'text-purple-400/70 hover:text-purple-400'
                  }`}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Authentication Section */}
          <div className="flex items-center space-x-3">
            {!ready ? (
              <div className="w-24 h-9 bg-[#1E293B] rounded animate-pulse"></div>
            ) : (!authenticated && !connectedWallet) ? (
              <button
                onClick={login}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-5 rounded-md transition-colors text-sm"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="relative flex items-center gap-4">

                {/* Network Indicator */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E293B] border border-[#334155]">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-xs text-slate-300 font-medium">Arbitrum Sepolia</span>
                </div>

                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-md py-1.5 px-3 transition-colors"
                >
                  <span className="text-sm font-medium text-white hidden md:block">
                    {username}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-10 mt-2 w-72 bg-[#0B0F19] border border-[#1E293B] rounded-lg shadow-xl overflow-hidden py-2 z-50">
                    <div className="px-4 py-3 border-b border-[#1E293B]">

                      <div className="mb-4 pb-4 border-b border-[#1E293B]/50 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Account Status</span>
                        {userData?.userBySigner?.is_whitelisted ? (
                          <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-emerald-500/20 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            Verified
                          </span>
                        ) : (
                          <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-red-500/20 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Unverified
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-slate-500 font-medium mb-1 flex items-center justify-between">
                          <span>Smart Account (Wallet)</span>
                          <span className="text-emerald-400">{formattedUsdc} USDC</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="flex-1 text-sm font-mono text-slate-300 bg-[#1E293B]/50 px-2 py-1.5 rounded border border-[#334155]">
                            {smartAccountAddress
                              ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`
                              : (wallets[0]?.walletClientType !== 'privy' ? 'Unlock Wallet Extension' : 'Loading...')}
                          </p>
                          {smartAccountAddress && (
                            <button
                              onClick={() => navigator.clipboard.writeText(smartAccountAddress)}
                              className="p-1.5 bg-[#1E293B] hover:bg-[#334155] rounded border border-[#334155] text-slate-400 hover:text-white transition-colors"
                              title="Copy Address"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">Owner (EOA)</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="flex-1 text-sm font-mono text-slate-400 bg-[#1E293B]/50 px-2 py-1.5 rounded border border-[#334155]">
                            {finalWalletAddress ? `${finalWalletAddress.slice(0, 6)}...${finalWalletAddress.slice(-4)}` : 'Loading...'}
                          </p>
                          {finalWalletAddress && (
                            <button
                              onClick={() => navigator.clipboard.writeText(finalWalletAddress)}
                              className="p-1.5 bg-[#1E293B] hover:bg-[#334155] rounded border border-[#334155] text-slate-400 hover:text-white transition-colors"
                              title="Copy Address"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                    {authenticated && wallets[0]?.walletClientType === 'privy' && (
                      <div className="px-2 py-1 border-b border-[#1E293B]">
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            if (exportWallet) exportWallet();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-[#1E293B] hover:text-white rounded-md transition-colors"
                        >
                          <span>Export Private Key</span>
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                        </button>
                      </div>
                    )}

                    <div className="px-2 pt-1">
                      <button
                        onClick={async () => {
                          if (authenticated) await logout();
                          if (connectedWallet) disconnect();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[#1E293B] rounded-md transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
