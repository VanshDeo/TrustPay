#!/bin/bash
set -e

echo "Building contracts with stellar CLI..."
cd contracts
rm -rf target || true
find . -name "._*" -delete || true
stellar contract build
cd ..

echo "Configuring testnet..."
# Ensure the identity exists or create it
stellar keys generate deployer --network testnet || echo "Identity 'deployer' already exists"

# Ensure the network is configured
stellar network add testnet --rpc-url https://soroban-testnet.stellar.org:443 --network-passphrase "Test SDF Network ; September 2015" || true

# Function to deploy with retries
deploy_with_retry() {
  local wasm_path=$1
  local max_attempts=5
  local attempt=1
  local result=""

  while [ $attempt -le $max_attempts ]; do
    echo "  Attempt $attempt of $max_attempts..." >&2
    # Run the deploy command, capture output, ignore error code initially
    result=$(stellar contract deploy --wasm "$wasm_path" --source deployer --network testnet 2>&1)
    
    # If the result contains a contract ID (usually 56 chars starting with C) and doesn't say "error"
    if [[ "$result" != *"error:"* && "$result" =~ C[A-Z0-9]{55} ]]; then
      # Extract just the contract ID (last word of output)
      echo "$result" | grep -o "C[A-Z0-9]\{55\}" | tail -1
      return 0
    fi
    
    echo "  Deployment failed or timed out. Retrying in 3 seconds..." >&2
    sleep 3
    ((attempt++))
  done

  echo "Failed to deploy after $max_attempts attempts." >&2
  echo "$result" >&2
  exit 1
}

echo "Deploying TrustPayEscrow..."
ESCROW_ID=$(deploy_with_retry "contracts/target/wasm32v1-none/release/trustpay_escrow.wasm")
echo "Escrow Contract ID: $ESCROW_ID"

echo "Deploying TrustPayApproval..."
APPROVAL_ID=$(deploy_with_retry "contracts/target/wasm32v1-none/release/trustpay_approval.wasm")
echo "Approval Contract ID: $APPROVAL_ID"

echo "Deploying TrustPaySmartWallet..."
WALLET_ID=$(deploy_with_retry "contracts/target/wasm32v1-none/release/trustpay_smart_wallet.wasm")
echo "Smart Wallet Contract ID: $WALLET_ID"

echo "Deploying FeeSponsor..."
SPONSOR_ID=$(deploy_with_retry "contracts/target/wasm32v1-none/release/trustpay_fee_sponsor.wasm")
echo "Fee Sponsor Contract ID: $SPONSOR_ID"

echo "---------------------------------------------------"
echo "Deployment Complete!"
echo "Add these to your .env files:"
echo "NEXT_PUBLIC_ESCROW_CONTRACT_ID=$ESCROW_ID"
echo "NEXT_PUBLIC_APPROVAL_CONTRACT_ID=$APPROVAL_ID"
echo "NEXT_PUBLIC_WALLET_CONTRACT_ID=$WALLET_ID"
echo "NEXT_PUBLIC_SPONSOR_CONTRACT_ID=$SPONSOR_ID"
echo "---------------------------------------------------"

# Append to backend and frontend .env files if they exist
for envfile in frontend/.env.local backend/.env; do
  if [ -f "$envfile" ]; then
    echo "Updating $envfile..."
    # Remove old contract IDs if they exist
    sed -i '' '/NEXT_PUBLIC_ESCROW_CONTRACT_ID/d' "$envfile"
    sed -i '' '/NEXT_PUBLIC_APPROVAL_CONTRACT_ID/d' "$envfile"
    sed -i '' '/NEXT_PUBLIC_WALLET_CONTRACT_ID/d' "$envfile"
    sed -i '' '/NEXT_PUBLIC_SPONSOR_CONTRACT_ID/d' "$envfile"
    
    echo "NEXT_PUBLIC_ESCROW_CONTRACT_ID=$ESCROW_ID" >> "$envfile"
    echo "NEXT_PUBLIC_APPROVAL_CONTRACT_ID=$APPROVAL_ID" >> "$envfile"
    echo "NEXT_PUBLIC_WALLET_CONTRACT_ID=$WALLET_ID" >> "$envfile"
    echo "NEXT_PUBLIC_SPONSOR_CONTRACT_ID=$SPONSOR_ID" >> "$envfile"
  fi
done

# Replace contract IDs in README.md
sed -i '' -e "s/ESCROW_CONTRACT_ID_PLACEHOLDER/$ESCROW_ID/g" README.md || true
sed -i '' -e "s/APPROVAL_CONTRACT_ID_PLACEHOLDER/$APPROVAL_ID/g" README.md || true
sed -i '' -e "s/WALLET_CONTRACT_ID_PLACEHOLDER/$WALLET_ID/g" README.md || true
sed -i '' -e "s/SPONSOR_CONTRACT_ID_PLACEHOLDER/$SPONSOR_ID/g" README.md || true

# Save the deployer secret key for the Sponsor/Server
DEPLOYER_SECRET=$(stellar keys show deployer)
echo "The Deployer Secret Key is: $DEPLOYER_SECRET"
echo "You should add this to your backend .env as SPONSOR_SECRET_KEY=$DEPLOYER_SECRET"
