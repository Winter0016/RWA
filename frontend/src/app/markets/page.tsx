"use client";

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { io } from 'socket.io-client';
import { useSmartAccount } from '@/contexts/SmartAccountContext';
import { useTransactionFlow } from '@/hooks/useTransactionFlow';
import { TransactionModal } from '@/components/TransactionModal';
import { LiveTicker } from '@/components/LiveTicker';

// Mock Data for Ondo-style Grid (Base template)
const MOCK_ASSETS = [
  {
    id: 'tsla',
    ticker: 'dTSLA',
    name: 'Tesla, Inc.',
    yield: 'N/A',
    tvl: '$24.5M',
    price: '...', // Will be dynamically populated
    available: true,
    logo: '/images/dtsla.png'
  },
  {
    id: 'aapl',
    ticker: 'dAAPL',
    name: 'Apple Inc.',
    yield: 'N/A',
    tvl: '$18.2M',
    price: '$178.25',
    available: true,
    logo: 'https://www.google.com/s2/favicons?domain=apple.com&sz=128'
  },
  {
    id: 'spy',
    ticker: 'dSPY',
    name: 'SPDR S&P 500 ETF',
    yield: '1.4%',
    tvl: '$142.1M',
    price: '$512.40',
    available: true,
    logo: 'https://www.google.com/s2/favicons?domain=ssga.com&sz=128' // SPDR
  }
];

export default function Home() {
  const { login, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const connectedWallet = wallets[0]?.address;
  const { smartAccount } = useSmartAccount();
  const { state, initiateMint, setState } = useTransactionFlow();
  // Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const openDepositModal = (asset: any) => {
    setSelectedAsset(asset);
    setDepositAmount('1');
    setIsDepositModalOpen(true);
  };

  const handleConfirmDeposit = async () => {
    setIsDepositModalOpen(false);
    await initiateMint(Number(depositAmount));
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center relative">
      <main className="max-w-[1440px] w-full mx-auto px-6 py-12">
        
        {/* Simple Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-medium text-white mb-2">Equities</h1>
          <p className="text-slate-400">Mint and redeem real-world equities 24/7 on Arbitrum Sepolia.</p>
        </div>

        {/* Filters/Sort Bar */}
        <div className="flex flex-wrap gap-4 items-center mb-8 border-b border-[#1E293B] pb-4">
          <button className="px-4 py-1.5 bg-[#1E293B] hover:bg-[#334155] rounded-full text-sm font-medium text-white transition-colors">
            All Assets
          </button>
          <button className="px-4 py-1.5 border border-[#1E293B] hover:bg-[#1E293B] rounded-full text-sm font-medium text-slate-400 transition-colors flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
            24/7 Available
          </button>
        </div>

        {/* Asset Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {MOCK_ASSETS.map(asset => (
            <div key={asset.id} className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 hover:border-[#334155] transition-colors flex flex-col h-full shadow-lg">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-full p-2 flex items-center justify-center">
                    <img src={asset.logo} alt={asset.ticker} className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{asset.ticker}</h3>
                    <p className="text-sm text-slate-400">{asset.name}</p>
                  </div>
                </div>
                {asset.available && (
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded">Open</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Current Price</p>
                  <p className="font-mono text-lg">
                    <LiveTicker ticker={asset.id === 'tsla' ? 'TSLA' : asset.ticker} fallbackPrice={asset.price} />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">TVL</p>
                  <p className="font-mono text-lg">{asset.tvl}</p>
                </div>
              </div>

              <div className="mt-auto">
                {!ready ? (
                  <button 
                    disabled
                    className="w-full py-3 bg-[#1E293B] text-slate-500 rounded-lg font-medium transition-colors animate-pulse"
                  >
                    Loading...
                  </button>
                ) : (!authenticated && !connectedWallet) ? (
                  <button 
                    onClick={login}
                    className="w-full py-3 bg-[#334155] hover:bg-[#475569] text-white rounded-lg font-medium transition-colors"
                  >
                    Connect Wallet
                  </button>
                ) : (
                  <button 
                    onClick={() => openDepositModal(asset)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Deposit USDC
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Render our Transaction Modal */}
        <TransactionModal 
          isOpen={state !== 'IDLE'}
          onClose={() => setState('IDLE')}
          state={state}
        />

        {/* Render Deposit Input Modal */}
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button 
                onClick={() => setIsDepositModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
              
              <h2 className="text-xl font-semibold text-white mb-2">Deposit USDC</h2>
              <p className="text-slate-400 text-sm mb-6">Enter the amount of USDC to deposit for {selectedAsset?.ticker} minting.</p>
              
              <div className="mb-6 relative">
                <input 
                  type="number" 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <div className="absolute right-4 top-3.5 flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">$</div>
                  <span className="text-slate-300 font-medium">USDC</span>
                </div>
              </div>

              <button 
                onClick={handleConfirmDeposit}
                disabled={!depositAmount || Number(depositAmount) <= 0}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                Confirm Deposit
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
