import { apiRequest } from './apiClient';

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
};

export type Subscription = {
  planId: string;
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEnd?: string;
};

/**
 * Get available subscription plans
 */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiRequest<{ plans: SubscriptionPlan[] }>('/payments/plans');
  return response.plans;
}

/**
 * Get user's current subscription
 */
export async function getSubscription(): Promise<Subscription> {
  const response = await apiRequest<{ subscription: Subscription }>('/payments/subscription');
  return response.subscription;
}

/**
 * Create Stripe checkout session
 */
export async function createCheckout(planId: string): Promise<{ sessionId: string; url: string }> {
  return apiRequest<{ sessionId: string; url: string }>('/payments/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/payments/cancel-subscription', {
    method: 'POST',
  });
}

