import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Twitter, Construction, Rocket } from 'lucide-react';

/**
 * X/Twitter 平台管理页面
 * 目前显示即将推出的消息，后续会添加完整功能
 */
export default function XManager() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/auto')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black rounded-lg">
            <Twitter className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">X / Twitter 管理</h1>
            <p className="text-gray-500 text-sm">管理您的 X 平台内容发布</p>
          </div>
        </div>
      </div>

      <Card className="border-2 border-dashed border-gray-300">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
              <Construction className="h-12 w-12 text-gray-600" />
            </div>
          </div>
          <CardTitle className="text-xl">功能开发中</CardTitle>
          <Badge variant="secondary" className="mt-2">
            <Rocket className="h-3 w-3 mr-1" />
            即将推出
          </Badge>
        </CardHeader>
        <CardContent className="text-center space-y-4 pb-8">
          <p className="text-gray-600 max-w-md mx-auto">
            X/Twitter 平台的完整管理功能正在开发中。目前您可以通过自动运营功能创建和发布内容。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button
              onClick={() => navigate('/auto')}
              className="bg-black hover:bg-gray-800"
            >
              <Twitter className="h-4 w-4 mr-2" />
              返回自动运营
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              查看仪表盘
            </Button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">即将支持的功能</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 推文自动发布与定时</li>
              <li>• 内容日历管理</li>
              <li>• 互动数据分析</li>
              <li>• AI 智能回复建议</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
