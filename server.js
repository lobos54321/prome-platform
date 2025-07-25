import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// 解析 JSON 请求体（如你有 API 需要接收 POST 数据）
app.use(express.json());

// 你的 Stripe 支付等 API 路由（示例，根据你的实际业务调整）
app.post('/api/payment/stripe', (req, res) => {
  // 这里写你的 Stripe 支付逻辑，比如获取 req.body 等
  // 示例返回
  res.json({ success: true, message: 'Stripe payment endpoint reached!' });
});

// 可以继续添加更多 API 路由
// app.get('/api/xxx', ...)

// 静态文件服务（生产环境构建产物一般在 dist 目录）
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由处理（放在所有 API 路由和静态服务之后）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
