# Stripe Integration Setup Guide

## Overview
PARC Portal now has complete Stripe integration using Stripe's new Sandbox environments for testing. This guide will help you set up and test the payment processing system.

## Setup Steps

### 1. Get Your Stripe Sandbox Keys

1. Log in to your Stripe Dashboard
2. Navigate to **Sandboxes** (new testing environment)
3. Create a new sandbox for PARC testing
4. Go to **Developers > API Keys** in your sandbox
5. Copy your keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### 2. Environment Configuration

Create or update your `.env` file in the project root:

```bash
# Stripe Sandbox Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_sandbox_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_sandbox_secret_key_here

# Existing PocketBase URL
VITE_POCKETBASE_URL=https://pocketbase-production-7050.up.railway.app/
```

### 3. Test the Integration

1. **Start the development server**:
   ```bash
   pnpm dev
   ```

2. **Login as a server/manager** and go to the server dashboard

3. **Create a test order**:
   - Select a table
   - Add menu items
   - Send the order

4. **Process payment**:
   - Click on the table with an active order
   - Click "Process Payment"
   - Select "Credit/Debit Card (Stripe)"
   - Use Stripe test card numbers:

### Stripe Test Card Numbers

| Card Number | Brand | CVC | Date | Result |
|-------------|-------|-----|------|--------|
| `4242424242424242` | Visa | Any 3 digits | Any future date | ✅ Success |
| `4000000000000002` | Visa | Any 3 digits | Any future date | ❌ Card Declined |
| `4000000000009995` | Visa | Any 3 digits | Any future date | ❌ Insufficient Funds |
| `4000000000000069` | Visa | Any 3 digits | Any future date | ❌ Expired Card |

## How It Works

### Frontend (Stripe Elements)
- **Secure card input**: Stripe Elements provides PCI-compliant card input fields
- **Dark theme**: Customized to match PARC's dark UI
- **Real-time validation**: Instant feedback on card number, expiry, and CVC

### Backend (Payment Intent API)
- **Secure processing**: Payment details never touch your server
- **Metadata tracking**: Links payments to tables and tickets
- **Error handling**: Comprehensive error messages and logging

### Payment Flow
1. Customer provides card details in Stripe Elements
2. Frontend creates a Payment Intent via `/api/create-payment-intent`
3. Stripe securely processes the payment
4. Success triggers table closure and receipt generation
5. Payment data is stored in PocketBase for records

## Features Implemented

✅ **Stripe Elements Integration**
- Secure card input with real-time validation
- Dark theme matching PARC UI
- Mobile-responsive design

✅ **Payment Intent API**
- Server-side payment processing
- Metadata tracking for restaurant context
- Comprehensive error handling

✅ **Payment Processing**
- Automatic table closure on successful payment
- Receipt generation and storage
- Payment history in PocketBase

✅ **Testing Support**
- Sandbox environment ready
- Test card numbers supported
- Debug logging for troubleshooting

## Security Features

🔒 **PCI Compliance**
- Card details never touch your server
- Stripe Elements handles sensitive data
- Tokenized payment processing

🔒 **Server-Side Validation**
- Payment amount verification
- Metadata validation
- Secure API endpoints

🔒 **Error Handling**
- Graceful failure handling
- User-friendly error messages
- Comprehensive logging

## Debugging Tips

### Common Issues

1. **"Stripe failed to load"**
   - Check your `VITE_STRIPE_PUBLISHABLE_KEY` in `.env`
   - Ensure the key starts with `pk_test_`

2. **"Failed to create payment intent"**
   - Verify `STRIPE_SECRET_KEY` in `.env`
   - Check that the key starts with `sk_test_`
   - Ensure your Stripe account is active

3. **Card element not appearing**
   - Check browser console for JavaScript errors
   - Verify Stripe Elements loaded correctly
   - Try refreshing the payment modal

### Debug Console

Monitor these console messages:
- `🔄 Processing Stripe payment...` - Payment started
- `✅ Stripe payment processed successfully` - Payment completed
- `❌ Stripe payment failed:` - Error occurred

## Next Steps

### Production Deployment
1. **Get production keys** from your live Stripe account
2. **Update environment variables** with live keys
3. **Enable webhooks** for payment confirmations
4. **Test thoroughly** with small amounts

### Additional Features
- **Split payments** for group dining
- **Tip processing** with suggested amounts
- **Receipt customization** with restaurant branding
- **Refund processing** for cancellations

## Support

### Stripe Documentation
- [Stripe Elements Guide](https://stripe.com/docs/stripe-js)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Testing Guide](https://stripe.com/docs/testing)

### PARC Support
- Check `AGENT.md` for project-specific guidance
- Review payment logs in browser console
- Test with different card scenarios

---

**Ready to accept payments!** 🎉

Your restaurant management system now has enterprise-grade payment processing powered by Stripe.
