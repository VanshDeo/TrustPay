#!/bin/bash
# ============================================
# TrustPay — Deploy All Contracts to Testnet
# ============================================
#
# Prerequisites:
#   - Rust + wasm32-unknown-unknown target installed
#   - Stellar CLI installed (stellar / soroban)
#   - A funded testnet account
#
# Usage:
#   chmod +x scripts/deploy-contracts.sh
#   ./scripts/deploy-contracts.sh
# ============================================

set -e

echo "🔨 Building all contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

WASM_DIR="contracts/target/wasm32-unknown-unknown/release"

echo ""
echo "📦 Contract WASM files:"
ls -la $WASM_DIR/*.wasm 2>/dev/null || echo "No WASM files found. Check build output."

echo ""
echo "🚀 To deploy each contract, run:"
echo ""
echo "  stellar contract deploy \\"
echo "    --wasm $WASM_DIR/trustpay_escrow.wasm \\"
echo "    --source <YOUR_SECRET_KEY> \\"
echo "    --network testnet"
echo ""
echo "  stellar contract deploy \\"
echo "    --wasm $WASM_DIR/trustpay_approval.wasm \\"
echo "    --source <YOUR_SECRET_KEY> \\"
echo "    --network testnet"
echo ""
echo "  stellar contract deploy \\"
echo "    --wasm $WASM_DIR/trustpay_smart_wallet.wasm \\"
echo "    --source <YOUR_SECRET_KEY> \\"
echo "    --network testnet"
echo ""
echo "  stellar contract deploy \\"
echo "    --wasm $WASM_DIR/trustpay_fee_sponsor.wasm \\"
echo "    --source <YOUR_SECRET_KEY> \\"
echo "    --network testnet"
echo ""
echo "After deploying, copy the contract IDs into your .env file."
echo ""
echo "To initialize the escrow contract:"
echo "  stellar contract invoke \\"
echo "    --id <ESCROW_CONTRACT_ID> \\"
echo "    --source <YOUR_SECRET_KEY> \\"
echo "    --network testnet \\"
echo "    -- initialize --admin <YOUR_PUBLIC_KEY>"
echo ""
echo "✅ Done! Update .env with the deployed contract IDs."
