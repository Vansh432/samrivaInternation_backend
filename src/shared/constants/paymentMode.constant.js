export const PAYMENT_MODES = {
  UPI: 'upi',
  NETBANKING: 'netbanking',
  RTGS: 'rtgs',
  NEFT: 'neft',
  CASH: 'cash',
  // Internal-only — never offered on the create-investment form. Used exclusively by the
  // Renew Investment flow, which debits the Main wallet instead of collecting bank proof.
  WALLET_RENEWAL: 'wallet_renewal',
};
