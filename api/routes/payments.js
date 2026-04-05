const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

if (PAYSTACK_SECRET) {
  console.log('✅ Paystack initialized');
} else {
  console.log('⚠️  Paystack not initialized - PAYSTACK_SECRET_KEY not found');
}

async function paystackRequest(method, path, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PAYSTACK_BASE}${path}`, opts);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// PLANS
// ═══════════════════════════════════════════════════════════════

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'KES',
    interval: null,
    badge: null,
    features: [
      'Up to 30 wardrobe items',
      '3 outfit recommendations per day',
      'Basic Style DNA',
      'Single item camera capture',
    ],
    limits: {
      maxItems: 30,
      dailyRecommendations: 3,
      bulkUpload: false,
      destinationWeather: false,
      styleCoach: false,
      analytics: false,
      planner: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 499,
    currency: 'KES',
    interval: 'monthly',
    badge: 'MOST POPULAR',
    paystackPlanCode: null, // set dynamically or from env
    features: [
      'Up to 200 wardrobe items',
      'Unlimited outfit recommendations',
      'Full Style DNA & Analytics',
      'AI Style Coach',
      'Outfit planner',
      'Bulk upload (30 items)',
      'Weather-smart styling',
    ],
    limits: {
      maxItems: 200,
      dailyRecommendations: Infinity,
      bulkUpload: true,
      destinationWeather: false,
      styleCoach: true,
      analytics: true,
      planner: true,
    },
  },
  'pro-yearly': {
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    price: 3999,
    currency: 'KES',
    interval: 'annually',
    badge: 'BEST VALUE',
    paystackPlanCode: null,
    features: [
      'Everything in Pro',
      'Save 33% vs monthly',
      'Destination weather styling',
      'Priority AI responses',
    ],
    limits: {
      maxItems: 200,
      dailyRecommendations: Infinity,
      bulkUpload: true,
      destinationWeather: true,
      styleCoach: true,
      analytics: true,
      planner: true,
    },
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    price: 999,
    currency: 'KES',
    interval: 'monthly',
    badge: 'UNLIMITED',
    paystackPlanCode: null,
    features: [
      'Unlimited wardrobe items',
      'Unlimited recommendations',
      'Full Style DNA & Analytics',
      'Priority AI Style Coach',
      'Destination weather styling',
      'Bulk upload (unlimited)',
      'Early access to new features',
      'Priority support',
    ],
    limits: {
      maxItems: Infinity,
      dailyRecommendations: Infinity,
      bulkUpload: true,
      destinationWeather: true,
      styleCoach: true,
      analytics: true,
      planner: true,
    },
  },
};

// Override plan codes from env if set
if (process.env.PAYSTACK_PRO_PLAN_CODE) PLANS.pro.paystackPlanCode = process.env.PAYSTACK_PRO_PLAN_CODE;
if (process.env.PAYSTACK_PRO_YEARLY_PLAN_CODE) PLANS['pro-yearly'].paystackPlanCode = process.env.PAYSTACK_PRO_YEARLY_PLAN_CODE;
if (process.env.PAYSTACK_ELITE_PLAN_CODE) PLANS.elite.paystackPlanCode = process.env.PAYSTACK_ELITE_PLAN_CODE;

/**
 * GET /payments/plans
 */
router.get('/plans', (_req, res) => {
  const plans = Object.values(PLANS).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    interval: p.interval,
    badge: p.badge,
    features: p.features,
  }));
  res.json({ plans });
});

/**
 * GET /payments/plan-limits/:planId
 */
router.get('/plan-limits/:planId', (_req, res) => {
  const plan = PLANS[_req.params.planId] || PLANS.free;
  res.json({ limits: plan.limits });
});

/**
 * POST /payments/initialize
 * Initialize a Paystack transaction for subscription
 */
router.post('/initialize', authenticate, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ error: 'Payments not configured' });
    }

    const { planId } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = PLANS[planId];
    if (!plan || planId === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Ensure Paystack plan exists — create if needed
    let planCode = plan.paystackPlanCode;
    if (!planCode) {
      const created = await paystackRequest('POST', '/plan', {
        name: `Fashion Fit ${plan.name}`,
        interval: plan.interval,
        amount: plan.price * 100, // Paystack uses subunit (kobo/cents)
        currency: plan.currency,
      });
      if (created.status && created.data?.plan_code) {
        planCode = created.data.plan_code;
        plan.paystackPlanCode = planCode;
        console.log(`✅ Created Paystack plan: ${planCode} for ${plan.name}`);
      } else {
        console.error('Failed to create Paystack plan:', created);
        return res.status(500).json({ error: 'Failed to create payment plan' });
      }
    }

    // Initialize transaction with plan
    const txn = await paystackRequest('POST', '/transaction/initialize', {
      email: user.email,
      amount: plan.price * 100,
      currency: plan.currency,
      plan: planCode,
      metadata: {
        userId: user._id.toString(),
        planId,
        userName: user.name,
      },
      callback_url: process.env.PAYSTACK_CALLBACK_URL || undefined,
    });

    if (!txn.status) {
      console.error('Paystack init failed:', txn);
      return res.status(500).json({ error: 'Failed to initialize payment' });
    }

    res.json({
      authorizationUrl: txn.data.authorization_url,
      accessCode: txn.data.access_code,
      reference: txn.data.reference,
    });
  } catch (err) {
    console.error('Payment init error:', err);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

/**
 * GET /payments/verify/:reference
 * Verify a transaction after payment
 */
router.get('/verify/:reference', authenticate, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ error: 'Payments not configured' });
    }

    const { reference } = req.params;
    const result = await paystackRequest('GET', `/transaction/verify/${reference}`);

    console.log('📋 Paystack verify response:', JSON.stringify(result.data, null, 2));

    if (!result.status || result.data?.status !== 'success') {
      return res.status(400).json({
        error: 'Payment not verified',
        details: result.data?.gateway_response || result.message,
        paystackStatus: result.data?.status,
      });
    }

    const txData = result.data;
    // Paystack nests custom metadata — handle both formats
    const meta = txData.metadata || {};
    const customFields = meta.custom_fields || [];
    const userId = meta.userId || customFields.find(f => f.variable_name === 'userId')?.value || req.userId;
    const planId = meta.planId || customFields.find(f => f.variable_name === 'planId')?.value;

    const customerCode = txData.customer?.customer_code || null;
    const subscriptionCode = txData.plan_object?.subscription_code
      || txData.plan?.subscription_code
      || null;

    console.log(`📋 Verify parsed: userId=${userId}, planId=${planId}, customer=${customerCode}`);

    if (planId && PLANS[planId]) {
      const updated = await User.findByIdAndUpdate(userId, {
        'subscription.planId': planId,
        'subscription.status': 'active',
        'subscription.paystackCustomerCode': customerCode,
        'subscription.paystackSubscriptionCode': subscriptionCode,
        'subscription.paystackReference': reference,
      }, { new: true });

      if (updated) {
        console.log(`✅ Subscription activated: ${planId} for user ${userId} — saved to DB`);
      } else {
        console.error(`❌ User not found for ID: ${userId}`);
        // Fallback: try with req.userId from JWT
        if (userId !== req.userId) {
          await User.findByIdAndUpdate(req.userId, {
            'subscription.planId': planId,
            'subscription.status': 'active',
            'subscription.paystackCustomerCode': customerCode,
            'subscription.paystackSubscriptionCode': subscriptionCode,
            'subscription.paystackReference': reference,
          });
          console.log(`✅ Fallback: activated ${planId} for JWT user ${req.userId}`);
        }
      }
    } else {
      // No planId in metadata — still mark as paid using JWT user
      console.log('⚠️  No planId in metadata, checking transaction amount to determine plan');
      const amount = txData.amount; // in subunit (kobo/cents)
      let detectedPlan = null;
      if (amount === 49900) detectedPlan = 'pro';
      else if (amount === 399900) detectedPlan = 'pro-yearly';
      else if (amount === 99900) detectedPlan = 'elite';

      if (detectedPlan) {
        await User.findByIdAndUpdate(req.userId, {
          'subscription.planId': detectedPlan,
          'subscription.status': 'active',
          'subscription.paystackCustomerCode': customerCode,
          'subscription.paystackReference': reference,
        });
        console.log(`✅ Detected plan from amount: ${detectedPlan} for user ${req.userId}`);
        return res.json({ success: true, planId: detectedPlan, status: 'active' });
      }
    }

    res.json({ success: true, planId: planId || 'pro', status: 'active' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /payments/webhook
 * Handle Paystack webhook events
 */
router.post('/webhook', async (req, res) => {
  if (!PAYSTACK_SECRET) return res.sendStatus(200);

  // Verify signature
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Webhook signature mismatch');
    return res.sendStatus(400);
  }

  const { event, data } = req.body;
  console.log(`📩 Paystack webhook: ${event}`);

  try {
    switch (event) {
      case 'charge.success': {
        const meta = data.metadata || {};
        const customFields = meta.custom_fields || [];
        const userId = meta.userId || customFields.find(f => f.variable_name === 'userId')?.value;
        const planId = meta.planId || customFields.find(f => f.variable_name === 'planId')?.value;

        if (userId && planId && PLANS[planId]) {
          await User.findByIdAndUpdate(userId, {
            'subscription.planId': planId,
            'subscription.status': 'active',
            'subscription.paystackCustomerCode': data.customer?.customer_code || null,
            'subscription.paystackSubscriptionCode': data.plan_object?.subscription_code || null,
            'subscription.paystackReference': data.reference,
          });
          console.log(`✅ charge.success → ${planId} for ${userId}`);
        } else if (data.customer?.email) {
          // Fallback: find user by email
          const user = await User.findOne({ email: data.customer.email });
          if (user) {
            let detectedPlan = planId;
            if (!detectedPlan) {
              const amount = data.amount;
              if (amount === 49900) detectedPlan = 'pro';
              else if (amount === 399900) detectedPlan = 'pro-yearly';
              else if (amount === 99900) detectedPlan = 'elite';
            }
            if (detectedPlan) {
              user.subscription.planId = detectedPlan;
              user.subscription.status = 'active';
              user.subscription.paystackCustomerCode = data.customer.customer_code;
              user.subscription.paystackReference = data.reference;
              await user.save();
              console.log(`✅ charge.success (email fallback) → ${detectedPlan} for ${user._id}`);
            }
          }
        }
        break;
      }

      case 'subscription.create': {
        const subCode = data.subscription_code;
        const customerCode = data.customer?.customer_code;
        if (customerCode) {
          const user = await User.findOne({ 'subscription.paystackCustomerCode': customerCode });
          if (user) {
            user.subscription.paystackSubscriptionCode = subCode;
            user.subscription.status = 'active';
            await user.save();
            console.log(`✅ subscription.create → ${subCode} for ${user._id}`);
          }
        }
        break;
      }

      case 'subscription.disable':
      case 'subscription.not_renew': {
        const subCode = data.subscription_code;
        if (subCode) {
          const user = await User.findOne({ 'subscription.paystackSubscriptionCode': subCode });
          if (user) {
            user.subscription.status = event === 'subscription.disable' ? 'cancelled' : 'non-renewing';
            if (event === 'subscription.disable') user.subscription.planId = 'free';
            await user.save();
            console.log(`✅ ${event} → ${user._id}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const subCode = data.subscription?.subscription_code;
        if (subCode) {
          const user = await User.findOne({ 'subscription.paystackSubscriptionCode': subCode });
          if (user) {
            user.subscription.status = 'attention';
            await user.save();
            console.log(`⚠️  Payment failed for ${user._id}`);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.sendStatus(200);
});

/**
 * GET /payments/subscription
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('subscription email name');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sub = user.subscription || { planId: 'free', status: 'active' };
    const plan = PLANS[sub.planId] || PLANS.free;

    res.json({
      subscription: {
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
      limits: plan.limits,
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * POST /payments/cancel-subscription
 */
router.post('/cancel-subscription', authenticate, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ error: 'Payments not configured' });
    }

    const user = await User.findById(req.userId);
    if (!user?.subscription?.paystackSubscriptionCode) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Disable subscription on Paystack
    const subCode = user.subscription.paystackSubscriptionCode;

    // First get the email token needed for disabling
    const subDetails = await paystackRequest('GET', `/subscription/${subCode}`);
    const emailToken = subDetails.data?.email_token;

    if (emailToken) {
      await paystackRequest('POST', '/subscription/disable', {
        code: subCode,
        token: emailToken,
      });
    }

    user.subscription.status = 'cancelled';
    user.subscription.planId = 'free';
    await user.save();

    res.json({ success: true, message: 'Subscription cancelled. You can still use premium features until the end of your billing period.' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Export PLANS for use in middleware
router.PLANS = PLANS;

module.exports = router;
