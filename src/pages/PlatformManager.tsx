import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Construction, Rocket, Globe } from 'lucide-react';
import { PLATFORM_CONFIGS } from '@/components/ui/PlatformSwitcher';

interface PlatformManagerProps {
    platformId: string;
}

/**
 * 通用平台管理页面 (占位符)
 * 用于显示尚未完全实现的平台管理界面
 */
export default function PlatformManager({ platformId }: PlatformManagerProps) {
    const navigate = useNavigate();
    const config = PLATFORM_CONFIGS[platformId] || {
        displayName: platformId,
        icon: '🌐',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50'
    };

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
                    <div className={`p-2 rounded-lg ${config.bgColor || 'bg-gray-100'}`}>
                        <span className="text-2xl">{config.icon}</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{config.displayName} 管理</h1>
                        <p className="text-gray-500 text-sm">管理您的 {config.displayName} 平台内容发布</p>
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
                        {config.displayName} 平台的完整管理功能正在开发中。目前您可以通过自动运营功能创建和发布内容。
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                        <Button
                            onClick={() => navigate('/auto')}
                            className="bg-black hover:bg-gray-800"
                        >
                            <Globe className="h-4 w-4 mr-2" />
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
                            <li>• 自动化内容发布与排程</li>
                            <li>• 数据分析与效果追踪</li>
                            <li>• 评论管理与互动</li>
                            <li>• 账号多维分析</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
