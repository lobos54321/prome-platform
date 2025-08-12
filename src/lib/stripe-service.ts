/**
 * Stripe支付服务集成
 * 处理积分充值的支付流程
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { toast } from 'sonner';

interface PaymentIntentData {
  amount: number; // USD cents
  creditsAmount: number;
  userId: string;
  packageId?: string;
}

interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

class StripeService {
  private stripePromise: Promise<Stripe | null>;

  constructor() {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey || publishableKey === 'your_stripe_publishable_key_here') {
      console.warn('Stripe publishable key not configured');
      this.stripePromise = Promise.resolve(null);
    } else {
      this.stripePromise = loadStripe(publishableKey);
    }
  }

  /**
   * 检查Stripe是否已正确配置
   */
  async isConfigured(): Promise<boolean> {
    const stripe = await this.stripePromise;
    return stripe !== null;
  }

  /**
   * 创建支付意图
   */
  async createPaymentIntent(data: PaymentIntentData): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: data.amount,
          creditsAmount: data.creditsAmount,
          userId: data.userId,
          packageId: data.packageId,
          currency: 'usd',
          metadata: {
            type: 'credit_purchase',
            credits: data.creditsAmount.toString(),
            user_id: data.userId,
            package_id: data.packageId || 'custom'
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw new Error('Failed to initialize payment. Please try again.');
    }
  }

  /**
   * 处理支付流程
   */
  async processPayment(
    clientSecret: string, 
    paymentMethod: string,
    billingDetails?: {
      name?: string;
      email?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = await this.stripePromise;
      
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod,
        ...(billingDetails && {
          payment_method_data: {
            billing_details: billingDetails
          }
        })
      });

      if (error) {
        console.error('Payment failed:', error);
        return {
          success: false,
          error: error.message || 'Payment failed'
        };
      }

      if (paymentIntent?.status === 'succeeded') {
        toast.success('Payment successful! Credits will be added to your account.');
        return { success: true };
      }

      return {
        success: false,
        error: 'Payment was not completed successfully'
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  }

  /**
   * 创建Stripe Elements
   */
  async createElements(clientSecret: string) {
    const stripe = await this.stripePromise;
    
    if (!stripe) {
      throw new Error('Stripe not initialized');
    }

    const elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#ffffff',
          colorText: '#1f2937',
          colorDanger: '#ef4444',
          fontFamily: 'system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '6px',
        },
      },
    });

    return { stripe, elements };
  }

  /**
   * 验证支付状态并更新用户余额
   */
  async verifyPayment(paymentIntentId: string): Promise<{
    success: boolean;
    status?: string;
    creditsAdded?: number;
  }> {
    try {
      // 临时实现：直接从PaymentIntent元数据获取积分数量
      // 在生产环境中，应该通过后端API验证
      console.log('[Stripe] Payment verification - simulated for development');
      
      // 这里应该调用后端API验证支付
      // const response = await fetch('/api/stripe/verify-payment', {...});
      
      // 临时方案：使用PaymentIntent ID解析积分数量
      // 生产环境中必须通过后端验证！
      const mockCreditsAdded = 50000; // 临时值，实际应该从后端获取
      
      console.log(`[Stripe] Simulated payment verification: ${mockCreditsAdded} credits added`);
      
      return {
        success: true,
        status: 'completed',
        creditsAdded: mockCreditsAdded
      };
    } catch (error) {
      console.error('Failed to verify payment:', error);
      return { success: false };
    }
  }

  /**
   * 模拟添加积分到用户账户 (开发环境)
   * 生产环境中应该通过后端API处理
   */
  async addCreditsToUser(userId: string, creditsAmount: number): Promise<{ success: boolean; newBalance?: number }> {
    try {
      // 临时方案：直接调用认证服务更新余额
      // 生产环境中应该通过后端API处理以确保安全性
      
      console.log(`[Stripe] Adding ${creditsAmount} credits to user ${userId}`);
      
      // 这里调用我们现有的认证服务来更新余额
      const { authService } = await import('./auth');
      const result = await authService.addBalance(creditsAmount);
      
      if (result.success) {
        console.log(`[Stripe] Successfully added credits, new balance: ${result.newBalance}`);
        return { success: true, newBalance: result.newBalance };
      }
      
      return { success: false };
    } catch (error) {
      console.error('Failed to add credits to user:', error);
      return { success: false };
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;