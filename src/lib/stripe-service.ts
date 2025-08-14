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
      const response = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: data.amount / 100, // Convert cents to dollars for server
          creditsAmount: data.creditsAmount,
          userId: data.userId,
          packageId: data.packageId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Server returns { clientSecret }, but we need to extract the payment intent ID
      // Payment intent ID is embedded in the client secret
      const clientSecret = result.clientSecret;
      const paymentIntentId = clientSecret.split('_secret_')[0];
      
      return {
        clientSecret,
        paymentIntentId
      };
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
   * 添加积分到用户账户
   * 通过数据库服务和认证服务协同处理
   */
  async addCreditsToUser(userId: string, creditsAmount: number): Promise<{ success: boolean; newBalance?: number }> {
    try {
      console.log(`[Stripe] Adding ${creditsAmount} credits to user ${userId}`);
      
      // 🔧 修复：使用正确的数据库服务和认证服务
      const { authService } = await import('./auth');
      const { db } = await import('./supabase');
      
      // 首先获取当前用户信息
      const currentUser = await authService.getCurrentUser();
      if (!currentUser || currentUser.id !== userId) {
        console.error(`[Stripe] User mismatch or not authenticated: expected ${userId}, got ${currentUser?.id}`);
        return { success: false };
      }
      
      // 计算新余额
      const currentBalance = currentUser.balance || 0;
      const newBalance = currentBalance + creditsAmount;
      
      // 更新数据库中的余额
      const updatedBalance = await db.updateUserBalance(userId, newBalance);
      
      // 添加计费记录
      await db.addBillingRecord(
        userId, 
        'charge', 
        creditsAmount, 
        `Stripe payment credit addition: $${(creditsAmount / 10000).toFixed(2)} USD`
      );
      
      // 更新认证服务中的用户信息（如果是当前用户）
      if (authService.currentUser && authService.currentUser.id === userId) {
        authService.currentUser.balance = updatedBalance;
        
        // 触发余额更新事件
        window.dispatchEvent(new CustomEvent('balance-updated', {
          detail: { balance: updatedBalance, source: 'stripe_payment' }
        }));
      }
      
      console.log(`[Stripe] Successfully added ${creditsAmount} credits, new balance: ${updatedBalance}`);
      return { success: true, newBalance: updatedBalance };
      
    } catch (error) {
      console.error('Failed to add credits to user:', error);
      return { success: false };
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;