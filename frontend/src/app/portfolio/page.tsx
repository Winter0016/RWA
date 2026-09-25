"use client";

import { useState, useEffect } from 'react';
import { useSmartAccount } from '@/contexts/SmartAccountContext';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { DTSLA_ADDRESS, DTSLA_ABI } from '@/constants/contracts';
import { usePrivy } from '@privy-io/react-auth';
import { io } from 'socket.io-client';
import { useTransactionFlow } from '@/hooks/useTransactionFlow';
import { TransactionModal } from '@/components/TransactionModal';
import { RedeemModal } from '@/components/RedeemModal';

const truncateDecimals = (val: number | string, decimals: number = 6) => {
  if (!val) return '0';
  // Force javascript to expand scientific notation out to 18 decimals
  let str = Number(val).toFixed(18); 
  // Strip off all the useless trailing zeroes at the very end
  str = str.replace(/\.?0+$/, ''); 
  return str === '' ? '0' : str;
};

export default function Portfolio() {
  const { smartAccount } = useSmartAccount();
  const { ready, authenticated, login } = usePrivy();
  const { state: txState, setState: setTxState, initiateRedeem, txType } = useTransactionFlow();
  const smartAccountAddress = smartAccount?.address;
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  // Wagmi hook to fetch dTSLA balance automatically
  const { data: dTslaBalance, isLoading } = useReadContract({
    address: DTSLA_ADDRESS as `0x${string}`,
    abi: DTSLA_ABI,
    functionName: 'balanceOf',
    args: smartAccountAddress ? [smartAccountAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!smartAccountAddress,
    }
  });



  const [liveTslaPrice, setLiveTslaPrice] = useState<number | null>(null);

  // Listen to WebSocket for real-time updates
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000');
    
    socket.on('stock_price_update', (data: { ticker: string, price: number }) => {
      if (data.ticker === 'TSLA') {
        setLiveTslaPrice(data.price);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const tslaPrice = liveTslaPrice !== null ? liveTslaPrice : 0;

  const rawFormattedBalance = dTslaBalance !== undefined ? formatUnits(dTslaBalance as bigint, 18) : '0';
  
  // Exact BigInt Math to prevent JS floating point precision errors
  const tslaPriceScaled = tslaPrice > 0 ? BigInt(Math.round(tslaPrice * 1e6)) : BigInt(0);
  const rawUsdValueBigInt = dTslaBalance !== undefined ? ((dTslaBalance as bigint) * tslaPriceScaled) : BigInt(0);
  const rawUsdValue = formatUnits(rawUsdValueBigInt, 24); // 18 from dTSLA + 6 from scaled price

  const formattedBalance = truncateDecimals(rawFormattedBalance);
  const usdValue = truncateDecimals(rawUsdValue);
  const displayTslaPrice = truncateDecimals(tslaPrice);

  return (
    <div className="flex-1 w-full flex flex-col items-center relative">
      <main className="max-w-[1440px] w-full mx-auto px-6 py-12">
        
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-medium text-white mb-2">Your Portfolio</h1>
          <p className="text-slate-400">Monitor and manage your tokenized real-world assets.</p>
        </div>

        {!ready ? (
          <div className="w-full h-64 bg-[#1E293B]/50 rounded-xl animate-pulse"></div>
        ) : (!authenticated && !smartAccountAddress) ? (
          <div className="w-full bg-[#1E293B]/50 border border-[#334155] rounded-xl p-12 text-center">
            <h2 className="text-xl font-medium text-white mb-4">Connect to View Portfolio</h2>
            <p className="text-slate-400 mb-6">You need to connect your wallet to view your tokenized assets.</p>
            <button 
              onClick={login}
              className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary Card */}
            <div className="bg-[#1E293B]/50 border border-[#334155] rounded-2xl p-8">
              <p className="text-slate-400 font-medium mb-2">Total Portfolio Value</p>
              <h2 className="text-5xl font-semibold text-white tracking-tight">${usdValue}</h2>
            </div>

            {/* Assets Table */}
            <div>
              <h3 className="text-xl font-medium text-white mb-4">Your Assets</h3>
              <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#1E293B]/30 border-b border-[#1E293B]">
                    <tr>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Asset</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Balance</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Price</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400">Value (USD)</th>
                      <th className="px-6 py-4 text-sm font-medium text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    <tr className="hover:bg-[#1E293B]/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center p-1.5 shrink-0 shadow-inner overflow-hidden">
                              <img src="/images/dtsla.png" alt="dTSLA" className="w-full h-full object-cover scale-[1.3] pt-0.5 pr-0.5" />
                            </div>
                          <div>
                            <p className="font-medium text-white">Tesla Inc.</p>
                            <p className="text-xs text-slate-400">dTSLA</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isLoading ? (
                          <div className="h-5 w-16 bg-[#1E293B] rounded animate-pulse"></div>
                        ) : (
                          <span className="font-mono text-white">{formattedBalance}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-300">
                        ${displayTslaPrice}
                      </td>
                      <td className="px-6 py-4 font-mono text-white">${usdValue}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-white text-sm font-medium rounded-lg transition-colors">
                            Trade
                          </button>
                          <button 
                            onClick={() => setIsRedeemModalOpen(true)}
                            className="px-4 py-2 border border-[#1E293B] hover:bg-[#1E293B] text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Redeem
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
      
      {/* Transaction Modal (for showing redeem progress) */}
      <TransactionModal 
        isOpen={txState !== 'IDLE'}
        onClose={() => setTxState('IDLE')}
        state={txState}
        type={txType}
      />

      {/* Redeem Input Modal */}
      <RedeemModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        onConfirm={async (amount) => {
          setIsRedeemModalOpen(false);
          await initiateRedeem(amount);
        }}
        maxAmount={rawFormattedBalance}
        ticker="dTSLA"
      />
    </div>
  );
}
