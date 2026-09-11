#!/bin/bash
set -e

echo "Building contracts with standard cargo..."
cd contracts
cargo build --target wasm32-unknown-unknown --release
cd ..

echo "Configuring testnet..."
# Ensure the identity exists or create it
stellar keys generate deployer --network testnet || echo "Identity 'deployer' already exists"

# Ensure the network is configured
stellar network add testnet --rpc-url https://soroban-testnet.stellar.org:443 --network-passphrase "Test SDF Network ; September 2015" || true

echo "Deploying TrustPayEscrow..."
ESCROW_ID=$(stellar contract deploy --wasm contracts/target/wasm32-unknown-unknown/release/trustpay_escrow.wasm --source deployer --network testnet)
echo "Escrow Contract ID: $ESCROW_ID"

echo "Deploying TrustPayApproval..."
APPROVAL_ID=$(stellar contract deploy --wasm contracts/target/wasm32-unknown-unknown/release/trustpay_approval.wasm --source deployer --network testnet)
echo "Approval Contract ID: $APPROVAL_ID"

echo "Deploying TrustPaySmartWallet..."
WALLET_ID=$(stellar contract deploy --wasm contracts/target/wasm32-unknown-unknown/release/trustpay_smart_wallet.wasm --source deployer --network testnet)
echo "Smart Wallet Contract ID: $WALLET_ID"

echo "Deploying FeeSponsor..."
SPONSOR_ID=$(stellar contract deploy --wasm contracts/target/wasm32-unknown-unknown/release/trustpay_fee_sponsor.wasm --source deployer --network testnet)
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
