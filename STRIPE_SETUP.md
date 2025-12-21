# Stripe Payment Integration Setup Guide

## ✅ What's Been Set Up

1. **Backend Payment Routes** (`api/routes/payments.js`)
   - Get subscription plans
   - Create checkout sessions
   - Handle webhooks
   - Manage subscriptions

2. **User Model Updated** (`api/models/User.js`)
   - Added subscription fields (planId, status, Stripe IDs)

3. **Frontend Subscription Screen** (`src/screens/SubscriptionScreen.tsx`)
   - Beautiful premium UI
   - Plan comparison
   - Checkout flow

4. **Payment Service** (`src/services/paymentService.ts`)
   - API client for payments

## 📋 Next Steps

### 1. Complete Stripe Dashboard Setup
Continue with the Stripe onboarding you started:
- ✅ Business location: Australia
- ✅ Business type: Company  
- ✅ Business structure: Proprietary company
- ⬜ Complete remaining steps (bank account, verification, etc.)

### 2. Get Your Stripe API Keys

After completing Stripe setup:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Developers** → **API keys**
3. Copy your **Publishable key** and **Secret key**

### 3. Add Environment Variables

Add to `Fashion-fit/api/.env`:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... (get from Stripe Dashboard → Webhooks)

# Frontend URL (for redirects after payment)
FRONTEND_URL=exp://192.168.0.101:8081
# For production: https://yourdomain.com
```

### 4. Install Stripe Package

```bash
cd Fashion-fit/api
npm install stripe
```

### 5. Set Up Webhook Endpoint

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your-backend-url.com/payments/webhook`
   - For local testing, use [ngrok](https://ngrok.com) or [Stripe CLI](https://stripe.com/docs/stripe-cli)
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook signing secret** → add to `.env` as `STRIPE_WEBHOOK_SECRET`

### 6. Test the Integration

1. Start your backend: `cd api && npm start`
2. Start your app: `cd .. && npm start`
3. Navigate to Profile → Subscription (you can add a button in ProfileScreen)
4. Test with Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Use any future expiry date, any CVC, any ZIP

## 💰 Subscription Plans

Currently configured:
- **Free**: $0/month (50 items limit)
- **Premium**: $9.99/month (unlimited)
- **Premium Yearly**: $79.99/year (save 33%)

You can modify these in `api/routes/payments.js` → `GET /payments/plans`

## 🔗 Add Subscription Button to Profile

Add this to `ProfileScreen.tsx`:

```tsx
import SubscriptionScreen from './SubscriptionScreen';

// In ProfileScreen, add a menu item:
<TouchableOpacity 
  style={styles.menuItem}
  onPress={() => navigation.navigate('Subscription')}
>
  <View style={styles.menuIcon}>
    <Ionicons name="diamond-outline" size={20} color={colors.primary} />
  </View>
  <Text style={styles.menuText}>Upgrade to Premium</Text>
  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
</TouchableOpacity>
```

## 🚀 Production Checklist

Before going live:
- [ ] Switch to Stripe **Live** keys (not test)
- [ ] Update `FRONTEND_URL` to your production domain
- [ ] Set up production webhook endpoint
- [ ] Test with real card (small amount)
- [ ] Set up email receipts in Stripe Dashboard
- [ ] Configure tax settings (if applicable in Australia)

## 📚 Resources

- [Stripe Docs](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

---

**Your Stripe integration is ready!** Just complete the dashboard setup and add your API keys. 🎉

