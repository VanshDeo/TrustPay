/**
 * Mock Email Service for TrustPay
 * 
 * In a production environment, this would integrate with SendGrid, SES, Resend, etc.
 */

export async function sendWalletlessOnboardingEmail(toEmail: string, name?: string) {
  const recipientName = name || 'User';
  
  console.log(`
======================================================
📧 EMAIL SENT 
To: ${toEmail}
Subject: Welcome to TrustPay! Secure your account.

Hello ${recipientName},

Your escrow transaction has been successfully created on TrustPay using our Walletless feature! 
You do not need a crypto wallet right now, but your funds are safely secured in a smart contract.

If you ever wish to gain full control and view your dashboard seamlessly, you can connect a Stellar Freighter wallet on our platform at any time.

Thank you for choosing TrustPay!
======================================================
  `);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
}
