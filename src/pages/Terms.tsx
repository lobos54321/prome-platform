import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/register">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回注册
            </Button>
          </Link>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">服务条款</CardTitle>
            <p className="text-center text-gray-600 mt-2">最后更新时间：2025年1月</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. 服务说明</h2>
              <p className="text-gray-700 leading-relaxed">
                ProMe AI 服务平台（以下简称"本平台"）是一个连接 Dify AI 应用与专业服务的平台，
                为用户提供高效、可靠的人工智能解决方案。通过使用本平台，您同意遵守本服务条款。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. 用户责任</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                作为本平台的用户，您同意：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>提供真实、准确的个人信息</li>
                <li>不得使用本平台进行任何违法活动</li>
                <li>尊重知识产权，不得侵犯他人权益</li>
                <li>合理使用平台资源，不得恶意攻击系统</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. 服务费用</h2>
              <p className="text-gray-700 leading-relaxed">
                本平台采用按需付费的模式，具体费用标准请参考价格页面。
                我们保留调整价格的权利，但会提前通知用户。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. 隐私保护</h2>
              <p className="text-gray-700 leading-relaxed">
                我们重视您的隐私，会按照隐私政策保护您的个人信息。
                详细内容请查看我们的<Link to="/privacy" className="text-blue-600 hover:underline">隐私政策</Link>。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. 服务变更</h2>
              <p className="text-gray-700 leading-relaxed">
                我们可能会更新、修改或停止部分服务功能。重大变更会提前通知用户，
                继续使用服务即表示您接受相关变更。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. 免责声明</h2>
              <p className="text-gray-700 leading-relaxed">
                本平台按"现状"提供服务，不保证服务完全无错误或中断。
                用户使用本平台服务所产生的风险由用户自行承担。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. 联系我们</h2>
              <p className="text-gray-700 leading-relaxed">
                如果您对本服务条款有任何疑问，请通过平台客服联系我们。
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}