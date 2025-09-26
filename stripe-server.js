require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());
app.use(bodyParser.json());

// 创建 Stripe 充值订单
app.post('/api/payment/stripe', async (req, res) => {
  const { amount, userId } = req.body;
  if (!amount || amount < 5) return res.status(400).json({ error: '最少充值5美元' });
  if (!userId) return res.status(400).json({ error: '缺少 userId' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: '充值积分' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: { userId },
      success_url: 'https://prome.live/settings?payment=success',
      cancel_url: 'https://prome.live/settings?payment=cancel',
    });
    res.json({ sessionId: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stripe Webhook 回调（注意这里要用原始body）
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = session.amount_total / 100;
    const points = Math.floor(amount * 100);

    // 更新用户积分
    const { error } = await supabase
      .from('users')
      .update({ balance: supabase.rpc('increment', { x: points }) }) // 若没有rpc可直接: .update({ balance: points })
      .eq('id', userId);

    if (error) {
      console.error('Supabase 积分更新失败:', error);
      return res.status(500).send('Supabase 积分更新失败');
    }
    console.log(`用户${userId} 充值 ${amount} 美元，获得 ${points} 积分`);
  }
  res.json({ received: true });
});

// 兼容 Stripe webhook 原始body和其他json
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).send('Invalid JSON');
  } else {
    next();
  }
});

const PORT = process.env.STRIPE_PORT || 3111;
app.listen(PORT, () => {
  console.log(`Stripe backend running at http://localhost:${PORT}`);
});
