/**
 * Stripe支付处理的后端API路由
 * 处理支付意图创建和支付验证
 */

const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// 初始化Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// 汇率配置 (应该从数据库获取)
const EXCHANGE_RATE = 10000; // 1 USD = 10000 积分

// 创建支付意图
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, creditsAmount, userId, packageId, currency = 'usd', metadata = {} } = req.body;

    // 验证请求参数
    if (!amount || !creditsAmount || !userId) {
      return res.status(400).json({
        error: 'Missing required parameters: amount, creditsAmount, userId'
      });
    }

    // 验证金额
    if (amount < 500) { // 最小5美元
      return res.status(400).json({
        error: 'Minimum amount is $5.00 USD'
      });
    }

    // 创建支付意图
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
      metadata: {
        userId,
        creditsAmount: creditsAmount.toString(),
        packageId: packageId || 'custom',
        ...metadata
      },
      description: `Purchase ${creditsAmount.toLocaleString()} credits`,
    });

    console.log(`Created PaymentIntent ${paymentIntent.id} for user ${userId}: $${amount/100} USD -> ${creditsAmount} credits`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
});

// 验证支付并添加积分
router.post('/verify-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'Missing paymentIntentId'
      });
    }

    // 从Stripe获取支付意图详情
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }

    const userId = paymentIntent.metadata.userId;
    const creditsAmount = parseInt(paymentIntent.metadata.creditsAmount);
    const amountPaid = paymentIntent.amount / 100; // Convert from cents

    console.log(`Payment verified: ${paymentIntentId} - Adding ${creditsAmount} credits to user ${userId}`);

    // TODO: 调用实际的数据库服务来添加积分
    // 这里需要集成你的用户余额更新逻辑
    /*
    const result = await updateUserBalance(userId, creditsAmount);
    if (!result.success) {
      throw new Error('Failed to update user balance');
    }
    */

    // 创建账单记录
    // TODO: 保存到数据库
    const billingRecord = {
      userId,
      paymentIntentId,
      amount: amountPaid,
      creditsAdded: creditsAmount,
      type: 'stripe_payment',
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    console.log('Billing record created:', billingRecord);

    res.json({
      success: true,
      creditsAdded: creditsAmount,
      status: 'completed',
      billingRecord
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

// Webhook处理 (用于异步支付状态更新)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 处理事件
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`💰 PaymentIntent succeeded: ${paymentIntent.id}`);
      
      // TODO: 更新数据库中的支付状态
      // await updatePaymentStatus(paymentIntent.id, 'succeeded');
      
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log(`❌ Payment failed: ${failedPayment.id}`);
      
      // TODO: 处理支付失败
      // await updatePaymentStatus(failedPayment.id, 'failed');
      
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;