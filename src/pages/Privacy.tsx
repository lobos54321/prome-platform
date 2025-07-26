import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
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
            <CardTitle className="text-3xl font-bold text-center">隐私政策</CardTitle>
            <p className="text-center text-gray-600 mt-2">最后更新时间：2025年1月</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. 信息收集</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                我们可能收集以下类型的信息：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>账户信息：姓名、邮箱地址、密码等注册信息</li>
                <li>使用数据：服务使用记录、操作日志等</li>
                <li>技术信息：IP地址、设备信息、浏览器类型等</li>
                <li>交互内容：您与AI服务的对话内容</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. 信息使用</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                我们使用收集的信息用于：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>提供和改进我们的服务</li>
                <li>处理您的请求和交易</li>
                <li>发送服务相关通知</li>
                <li>维护平台安全和防止欺诈</li>
                <li>遵守法律法规要求</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. 信息共享</h2>
              <p className="text-gray-700 leading-relaxed">
                我们不会出售、交易或租赁您的个人信息给第三方。
                但在以下情况下，我们可能会共享您的信息：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 mt-2">
                <li>获得您的明确同意</li>
                <li>法律法规要求或政府部门要求</li>
                <li>为提供服务而必需的技术服务商（如 Dify AI）</li>
                <li>保护我们或其他用户的权利和安全</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. 数据安全</h2>
              <p className="text-gray-700 leading-relaxed">
                我们采用多种安全措施保护您的个人信息：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 mt-2">
                <li>加密传输和存储敏感信息</li>
                <li>定期进行安全审计和漏洞扫描</li>
                <li>限制员工访问个人信息的权限</li>
                <li>建立数据泄露应急响应机制</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. 数据保留</h2>
              <p className="text-gray-700 leading-relaxed">
                我们会在提供服务所需的期间保留您的个人信息。
                当您删除账户或停止使用服务时，我们会按照相关法律法规要求处理您的个人信息。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. 您的权利</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                根据相关法律法规，您有权：
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>访问和查看您的个人信息</li>
                <li>更正不准确的个人信息</li>
                <li>删除您的个人信息</li>
                <li>限制或反对处理您的个人信息</li>
                <li>数据可携带性</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cookie 使用</h2>
              <p className="text-gray-700 leading-relaxed">
                我们使用 Cookie 和类似技术来改善用户体验、分析使用情况和个性化内容。
                您可以通过浏览器设置管理 Cookie 偏好。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. 政策更新</h2>
              <p className="text-gray-700 leading-relaxed">
                我们可能会定期更新本隐私政策。重大变更会通过邮件或平台通知的方式告知用户。
                继续使用服务即表示您同意更新后的隐私政策。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. 联系我们</h2>
              <p className="text-gray-700 leading-relaxed">
                如果您对本隐私政策有任何疑问或需要行使您的权利，
                请通过平台客服或邮件联系我们。我们会在合理时间内回复您的请求。
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}