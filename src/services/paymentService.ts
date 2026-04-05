import { apiRequest } from './apiClient';

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'annually' | null;
  badge: string | null;
  features: string[];
};

export type PlanLimits = {
  maxItems: number;
  dailyRecommendations: number;
  bulkUpload: boolean;
  destinationWeather: boolean;
  styleCoach: boolean;
  analytics: boolean;
  planner: boolean;
};

export type Subscription = {
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'attention' | 'non-renewing';
  currentPeriodEnd?: string;
};

export async function getPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiRequest<{ plans: SubscriptionPlan[] }>('/payments/plans');
  return response.plans;
}

export async function getSubscription(): Promise<{ subscription: Subscription; limits: PlanLimits }> {
  return apiRequest<{ subscription: Subscription; limits: PlanLimits }>('/payments/subscription');
}

export async function initializePayment(planId: string): Promise<{
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}> {
  return apiRequest('/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
}

export async function verifyPayment(reference: string): Promise<{ success: boolean; planId: string; status: string }> {
  return apiRequest(`/payments/verify/${reference}`);
}

export async function cancelSubscription(): Promise<{ success: boolean; message: string }> {
  return apiRequest('/payments/cancel-subscription', {
    method: 'POST',
  });
}
