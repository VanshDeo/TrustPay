# 🚀 TrustPay – Conditional Smart Payments on Stellar

## 🧠 Overview
TrustPay is a decentralized application built on Stellar using Soroban smart contracts that enables **conditional payments (escrow-based)**.

Users can create agreements like:
- “Release payment when 2/3 users approve”
- “Pay freelancer after work completion”

The system removes trust issues by automating agreements using smart contracts.

---

## ⚙️ Features

### 🔗 Conditional Payments (Core Feature)
- Create escrow-based payment contracts
- Funds are released only after predefined conditions are met

### 👥 Multi-Signature Approval
- Multiple users approve transactions
- Fully on-chain approval tracking

### ⚡ Gasless Transactions
- Users don’t pay fees
- Fee bump transaction sponsorship implemented

### 🔐 Smart Wallet (Account Abstraction)
- Simplified login experience
- Optional email-based wallet abstraction

### 📊 Metrics Dashboard
- Total users
- Transactions
- Volume locked/released

### 📡 Data Indexing
- Smart contract events indexed into database

### 📱 Mobile Responsive UI
- Fully responsive Next.js frontend

### 🔔 Wallet Connection Popup
- Success popup appears when wallet connects

---

## 🏗️ Architecture

Frontend (Next.js)
↓
Backend (Node.js API)
↓
Soroban Smart Contracts
- Escrow Contract
- Approval Contract
- Smart Wallet Contract
- Fee Sponsor Contract
↓
Stellar Network (Soroban + Horizon)
↓
Database (Supabase/PostgreSQL)

---

## 📜 Smart Contracts

### 1. Escrow Contract
- Locks funds
- Releases on condition

### 2. Approval Contract
- Tracks multi-user approvals

### 3. Smart Wallet Contract
- Account abstraction logic

### 4. Fee Sponsor Contract
- Enables gasless transactions

---

## 🔄 Inter-Contract Calls
- Escrow → Approval → Wallet → Fee Sponsor

---

## 🧪 Live Demo
[Add your deployed link here]

---

## 📊 Metrics Dashboard
[Add screenshot or link]

---

## 📱 Mobile View
[Add screenshot]

---

## 🔁 CI/CD
- GitHub Actions configured
- Auto deploy to Vercel

---

## 📦 Tech Stack

- Next.js
- Node.js (Express)
- Stellar SDK
- Soroban Client
- Supabase/PostgreSQL

---

## 🧪 Testing
- Minimum 3+ tests passing

---

## 👥 User Validation

- 30+ active users onboarded
- Wallet addresses verified on Stellar Explorer

---

## 📝 User Feedback

Collected via Google Form:
- Name
- Email
- Wallet Address
- Product Feedback

[Attach Excel sheet link here]

---

## 🔮 Future Improvements

- Dispute resolution system
- Reputation scoring
- Cross-border anchor integration

---

## 📜 Contract Details

- Contract addresses:
- Transaction hashes:

---

## 🚀 Getting Started

```bash
git clone <repo>
npm install
npm run dev