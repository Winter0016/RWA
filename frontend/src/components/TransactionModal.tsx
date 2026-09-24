import React from 'react';
import { TxState } from '../hooks/useTransactionFlow';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TxState;
  type?: 'MINT' | 'REDEEM' | 'REFUND';
}

export function TransactionModal({ isOpen, onClose, state, type = 'MINT' }: TransactionModalProps) {
  if (!isOpen) return null;

  const MINT_STEPS = [
    { key: 'REQUESTING_QUOTE', title: 'Requesting Quote', desc: 'Fetching optimal price from backend' },
    { key: 'AWAITING_DEPOSIT_TX', title: 'Deposit USDC', desc: 'Sign gasless transaction to escrow funds' },
    { key: 'PROCESSING_OFFCHAIN', title: 'Executing Trade', desc: 'Purchasing real TSLA stock via Alpaca' },
    { key: 'AWAITING_CLAIM_TX', title: 'Claim dTSLA', desc: 'Sign final transaction to mint tokens' },
  ];

  const REDEEM_STEPS = [
    { key: 'REQUESTING_QUOTE', title: 'Requesting Quote', desc: 'Fetching optimal price from backend' },
    { key: 'AWAITING_DEPOSIT_TX', title: 'Deposit dTSLA', desc: 'Sign gasless transaction to escrow tokens' },
    { key: 'PROCESSING_OFFCHAIN', title: 'Executing Trade', desc: 'Selling real TSLA stock via Alpaca' },
    { key: 'AWAITING_CLAIM_TX', title: 'Claim USDC', desc: 'Sign final transaction to claim funds' },
  ];

  const REFUND_STEPS = [
    { key: 'AWAITING_CLAIM_TX', title: 'Claim Refund', desc: 'Sign transaction to withdraw frozen assets' },
  ];

  const STEPS = type === 'REFUND' ? REFUND_STEPS : type === 'MINT' ? MINT_STEPS : REDEEM_STEPS;

  // Find the index of the current step
  const currentIndex = STEPS.findIndex(s => s.key === state);
  
  // If state is SUCCESS, we go past the end of the array
  const activeIndex = state === 'SUCCESS' ? STEPS.length 
                    : (state === 'ERROR' || state === 'CANCELED_BY_ADMIN') ? -1 
                    : currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header with unconditional Close Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white tracking-tight">Transaction Status</h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {STEPS.map((step, index) => {
            const isCompleted = index < activeIndex;
            const isActive = index === activeIndex;
            const isPending = index > activeIndex;

            return (
              <div key={step.key} className="flex gap-4 items-start relative">
                {/* Vertical Line Connector */}
                {index !== STEPS.length - 1 && (
                  <div className={`absolute left-[11px] top-8 bottom-[-16px] w-[2px] transition-colors duration-500 ${isCompleted ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                )}

                {/* Circle Indicator */}
                <div className={`
                  relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                  transition-all duration-500
                  ${isCompleted ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]' : isActive ? 'bg-zinc-800 border-2 border-indigo-500' : 'bg-zinc-800 border border-zinc-700'}
                `}>
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isActive && (
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  )}
                </div>

                {/* Text Content */}
                <div className={`${isPending ? 'opacity-40' : 'opacity-100'} transition-opacity duration-500`}>
                  <p className={`font-medium text-sm ${isActive ? 'text-indigo-400' : 'text-zinc-200'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Special message for offchain processing */}
        {state === 'PROCESSING_OFFCHAIN' && (
          <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <p className="text-sm text-indigo-400 text-center">
              Market closed? You can safely close this window. Once the market order fills on Alpaca, you can claim your tokens from the Transactions page.
            </p>
          </div>
        )}

        {/* Success / Error Messages */}
        {state === 'SUCCESS' && (
          <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm font-medium text-emerald-400 text-center">
              {type === 'REFUND' 
                ? 'Refund Complete! Your frozen assets have been returned.'
                : `Transaction Complete! You received ${type === 'MINT' ? 'dTSLA' : 'USDC'}.`}
            </p>
          </div>
        )}
        
        {state === 'ERROR' && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm font-medium text-red-400 text-center">
              Transaction failed. Please try again.
            </p>
          </div>
        )}

        {state === 'CANCELED_BY_ADMIN' && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm font-medium text-red-400 text-center">
              Transaction was canceled by the Admin. Please claim your refund.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
