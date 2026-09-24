"use client";

import { PrivyProvider } from '@privy-io/react-auth';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { ReactNode } from 'react';
import { SmartAccountProvider } from '../contexts/SmartAccountContext';
import { setContext } from '@apollo/client/link/context';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useMemo } from 'react';

// Set up Wagmi config
const config = createConfig({
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

// We must create an inner wrapper because we need access to the `usePrivy` hook,
// which is only available inside the `<PrivyProvider>`.
function ApolloWrapper({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy();

  const apolloClient = useMemo(() => {
    const httpLink = new HttpLink({ uri: 'http://localhost:4000/graphql' });

    const authLink = setContext(async (_, { headers }) => {
      /* 
        EXPLANATION OF PARAMETERS:
        1. `_` (The Operation): This contains the raw GraphQL query and variables.
           Example: { "operationName": "ReserveMintPower", "variables": { "usdcAmount": 100 } }
           We use `_` to ignore it because we don't need to read the variables for authentication.

        2. `{ headers }` (The Context): This is the current HTTP headers object.
           Example: { 'Content-Type': 'application/json' }
           We destructure it to grab the existing headers so we can add our token to them.
      */

      // Get the authentication token from Privy
      const token = await getAccessToken();
      
      // Return the headers to the context so httpLink can read them
      /*
        We MUST return an object with the exact key "headers".
        This data flows directly into the HTTP POST request.
        
        Final Result Example:
        {
          headers: {
            'Content-Type': 'application/json',
            'authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5c...'
          }
        }
      */
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : '',
        }
      };
    });

    return new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache(),
    });
  }, [getAccessToken]);

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmspyz8am00fg0cjpw00z9wec"} // Fallback to hardcoded just in case
          config={{
            loginMethods: ['google', 'email', 'wallet'],
            embeddedWallets: {
              ethereum: {
                createOnLogin: 'users-without-wallets',
              }
            }
          }}
        >
          <SmartAccountProvider>
            <ApolloWrapper>
              {children}
            </ApolloWrapper>
          </SmartAccountProvider>
        </PrivyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
