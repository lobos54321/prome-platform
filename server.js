import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// 初始化 Stripe，确保 Zeabur 或本地 .env 设置了 STRIPE_SECRET_KEY
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// 初始化 Supabase (如果配置了环境变量)
let supabase = null;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

app.use(cors());

// 注意：对于 webhook，需要原始 body，所以要在其他中间件之前设置
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// 创建 Stripe 充值订单
app.post('/api/payment/stripe', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    
    // 验证参数 (优先验证参数，然后检查配置)
    if (!amount || amount < 5) {
      return res.status(400).json({ error: '最少充值5美元' });
    }
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    // 检查 Stripe 是否已配置
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe 未配置，请设置 STRIPE_SECRET_KEY 环境变量' });
    }

    // 创建 Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: '充值积分' },
          unit_amount: Math.round(amount * 100), // Stripe 以分为单位
        },
        quantity: 1,
      }],
      metadata: { userId },
      success_url: `${req.protocol}://${req.get('host')}/settings?payment=success`,
      cancel_url: `${req.protocol}://${req.get('host')}/settings?payment=cancel`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook 回调处理
app.post('/api/stripe/webhook', async (req, res) => {
  // 检查 Stripe 是否已配置
  if (!stripe) {
    return res.status(500).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = session.amount_total / 100; // 转换为美元
    const points = Math.floor(amount * 100); // 1美元 = 100积分

    console.log(`Processing payment for user ${userId}: $${amount} -> ${points} points`);

    // 检查 Supabase 是否已配置
    if (!supabase) {
      console.error('Supabase not configured - cannot update user balance');
      return res.status(500).send('Database not configured');
    }

    try {
      // 更新用户积分 - 首先获取当前余额
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch user balance:', fetchError);
        return res.status(500).send('Failed to fetch user balance');
      }

      const currentBalance = currentUser?.balance || 0;
      const newBalance = currentBalance + points;

      // 更新余额
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) {
        console.error('Supabase balance update failed:', updateError);
        return res.status(500).send('Supabase balance update failed');
      }

      console.log(`User ${userId} recharged $${amount}, received ${points} points. New balance: ${newBalance}`);
    } catch (supabaseError) {
      console.error('Supabase operation failed:', supabaseError);
      return res.status(500).send('Database operation failed');
    }
  }

  res.json({ received: true });
});

// 其它 API 路由可继续添加...

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
