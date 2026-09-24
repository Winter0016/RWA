"use client";

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
export function LiveTicker({ ticker, fallbackPrice }: { ticker: string, fallbackPrice: string }) {
  const [livePrice, setLivePrice] = useState<number | null>(null);

  useEffect(() => {
    if (ticker !== 'TSLA') return;
    
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000');
    
    socket.on('stock_price_update', (data: { ticker: string, price: number }) => {
      if (data.ticker === 'TSLA') {
        setLivePrice(data.price);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticker]);

  if (ticker !== 'TSLA') return <>{fallbackPrice}</>;

  if (livePrice === null) return <>...</>;

  return <>${livePrice.toFixed(2)}</>;
}
