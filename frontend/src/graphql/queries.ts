import { gql } from '@apollo/client';

export const GET_TSLA_PRICE = gql`
  query GetTslaPrice {
    getTslaPrice
  }
`;

export const GET_USER_TRANSACTIONS = gql`
  query GetUserTransactions {
    getUserTransactions {
      id
      type
      usdc_amount
      dtsla_amount
      status
      blockchain_tx
      created_at
    }
  }
`;

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      email
      name
      signer_address
      wallet_address
      role
      created_at
      is_whitelisted
      whitelist_updated_at
    }
  }
`;

export const GET_ALL_TRANSACTIONS = gql`
  query GetAllTransactions {
    getAllTransactions {
      id
      wallet_address
      type
      usdc_amount
      dtsla_amount
      status
      blockchain_tx
      created_at
    }
  }
`;

export const GET_ALL_CONTRACTS = gql`
  query GetAllContracts {
    getAllContracts {
      id
      contract_address
      name
      is_whitelisted
      created_at
      updated_at
    }
  }
`;
