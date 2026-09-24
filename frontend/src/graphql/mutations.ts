import { gql } from '@apollo/client';

export const RESERVE_MINT_POWER = gql`
  mutation ReserveMintPower($usdcAmount: Float!, $walletAddress: String!) {
    reserveMintPower(usdcAmount: $usdcAmount, wallet_address: $walletAddress) {
      timestamp
      signature
    }
  }
`;

export const GET_CLAIM_SIGNATURE = gql`
  query GetClaimSignature($transactionHash: String!) {
    getClaimSignature(transactionHash: $transactionHash) {
      usdcAmount
      dTslaAmount
      timestamp
      signature
    }
  }
`;

export const GET_CLAIM_USDC_SIGNATURE = gql`
  query GetClaimUSDCSignature($transactionHash: String!) {
    getClaimUSDCSignature(transactionHash: $transactionHash) {
      usdcAmount
      dTslaAmount
      timestamp
      signature
    }
  }
`;

export const GET_REFUND_SIGNATURE = gql`
  query GetRefundSignature($transactionHash: String!) {
    getRefundSignature(transactionHash: $transactionHash) {
      usdcAmount
      dTslaAmount
      timestamp
      signature
    }
  }
`;

export const UPSERT_CONTRACT = gql`
  mutation UpsertContract($contractAddress: String!, $name: String!, $isWhitelisted: Boolean!) {
    upsertContract(contract_address: $contractAddress, name: $name, is_whitelisted: $isWhitelisted) {
      id
      contract_address
      name
      is_whitelisted
    }
  }
`;

export const UPDATE_USER_WHITELIST = gql`
  mutation UpdateUserWhitelist($walletAddress: String!, $isWhitelisted: Boolean!) {
    updateUserWhitelist(wallet_address: $walletAddress, is_whitelisted: $isWhitelisted) {
      id
      wallet_address
      is_whitelisted
      whitelist_updated_at
    }
  }
`;

/*
  NOTE: MANUAL AUTHENTICATION EXAMPLE
  
  Because we use `ApolloWrapper` in `Providers.tsx`, we don't have to worry about
  authentication when calling these mutations. The wrapper automatically injects
  the `Authorization` header for us.

  However, if we DID NOT have `setContext` in the Provider, we would have to 
  manually fetch and inject the token every single time we used a mutation, like this:

  ```tsx
  import { useMutation } from '@apollo/client';
  import { usePrivy } from '@privy-io/react-auth';
  import { RESERVE_MINT_POWER } from '@/graphql/mutations';

  export default function DepositButton() {
    const { getAccessToken } = usePrivy();
    const [reservePower] = useMutation(RESERVE_MINT_POWER);

    const handleDepositClick = async () => {
      // 1. Await the token manually
      const token = await getAccessToken(); 

      // 2. Inject it into the context of this specific request
      await reservePower({ 
        variables: { usdcAmount: 100, walletAddress: "0x123" },
        context: {
          headers: {
            authorization: token ? \`Bearer \${token}\` : '',
          }
        }
      });
    }

    return <button onClick={handleDepositClick}>Deposit</button>;
  }
  ```
*/
