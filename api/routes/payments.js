const express = require('express');
const Stripe = require('stripe');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Initialize Stripe only if API key is provided (beta mode may not have it)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe initialized');
} else {
  console.log('⚠️  Stripe not initialized - STRIPE_SECRET_KEY not found (Beta mode)');
}

/**
 * GET /payments/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      currency: 'aud',
      interval: 'month',
      features: [
        'Up to 50 wardrobe items',
        'Basic outfit recommendations',
        'Style DNA analytics',
        'Outfit planning',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 9.99,
      currency: 'aud',
      interval: 'month',
      features: [
        'Unlimited wardrobe items',
        'Advanced AI outfit recommendations',
        'Full Style DNA & Analytics',
        'Priority AI Style Coach',
        'Destination weather styling',
        'Bulk import (30+ items)',
        'Ad-free experience',
      ],
    },
    {
      id: 'premium-yearly',
      name: 'Premium (Yearly)',
      price: 79.99,
      currency: 'aud',
      interval: 'year',
      features: [
        'Everything in Premium',
        'Save 33% vs monthly',
        'Priority support',
      ],
    },
  ];

  res.json({ plans });
});

/**
 * POST /payments/create-checkout
 * Create Stripe checkout session
 */
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    // Beta mode - payments disabled
    if (!stripe) {
      return res.status(503).json({ 
        error: 'Payments are currently disabled in beta mode. All features are free!' 
      });
    }

    const { planId } = req.body;
    const userId = req.userId;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get plan details
    const plans = {
      premium: { price: 999, name: 'Premium Monthly' }, // $9.99 in cents
      'premium-yearly': { price: 7999, name: 'Premium Yearly' }, // $79.99 in cents
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `Fashion Fit - ${plan.name}`,
              description: 'AI-powered personal styling platform',
            },
            unit_amount: plan.price,
            recurring: {
              interval: planId.includes('yearly') ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'exp://192.168.0.101:8081'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'exp://192.168.0.101:8081'}/payment-cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
        planId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /payments/webhook
 * Handle Stripe webhooks (subscription events)
 * Note: This route is handled in server.js with raw body parser
 */
router.post('/webhook', async (req, res) => {
  // Beta mode - webhooks disabled
  if (!stripe) {
    return res.status(503).json({ error: 'Webhooks disabled in beta mode' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const planId = session.metadata?.planId;

      if (userId && planId) {
        // Update user subscription
        await User.findByIdAndUpdate(userId, {
          subscription: {
            planId,
            status: 'active',
            currentPeriodEnd: new Date(session.subscription_details?.expires_at * 1000),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        });
        console.log(`✅ Subscription activated for user ${userId}`);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });

      if (user) {
        if (event.type === 'customer.subscription.deleted') {
          user.subscription.status = 'cancelled';
        } else {
          user.subscription.status = subscription.status;
          user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }
        await user.save();
        console.log(`✅ Subscription updated for user ${user._id}`);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * GET /payments/subscription
 * Get user's current subscription status
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('subscription email name');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = user.subscription || {
      planId: 'free',
      status: 'active',
    };

    // Check if subscription expired
    if (subscription.currentPeriodEnd && new Date() > subscription.currentPeriodEnd) {
      subscription.status = 'expired';
      subscription.planId = 'free';
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * POST /payments/cancel-subscription
 * Cancel user's subscription
 */
router.post('/cancel-subscription', authenticate, async (req, res) => {
  try {
    // Beta mode - payments disabled
    if (!stripe) {
      return res.status(503).json({ 
        error: 'Payments are currently disabled in beta mode. All features are free!' 
      });
    }

    const user = await User.findById(req.userId);

    if (!user || !user.subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel subscription in Stripe
    await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);

    // Update user
    user.subscription.status = 'cancelled';
    await user.save();

    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;

