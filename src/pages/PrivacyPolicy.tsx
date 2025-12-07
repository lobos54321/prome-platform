import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, FileText, Database, UserCheck, Mail } from 'lucide-react';

const PrivacyPolicy = () => {
    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                    隐私政策
                </h1>
                <p className="text-gray-600 text-lg">
                    Prome 小红书助手重视您的隐私，我们承诺保护您的个人数据安全
                </p>
            </div>

            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Shield className="w-6 h-6 text-blue-500" />
                            1. 数据收集与使用
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-700 leading-relaxed space-y-4">
                        <p>
                            <strong>Prome 小红书助手 (Prome RedNote Assistant)</strong> 是一款帮助创作者进行小红书运营的工具。
                            为了提供服务，我们会收集以下类型的数据：
                        </p>
                        <ul className="list-disc list-inside pl-4 space-y-2">
                            <li><strong>账号 Cookie信息：</strong> 仅用于验证您的小红书登录状态，以便进行数据同步。我们不会保存您的登录密码。</li>
                            <li><strong>笔记数据：</strong> 我们会同步您的小红书笔记数据（如浏览量、点赞数、评论数等），用于生成数据分析报告。</li>
                            <li><strong>用户配置：</strong> 保存您的插件设置和偏好选项。</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Database className="w-6 h-6 text-purple-500" />
                            2. 数据存储
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-700 leading-relaxed">
                        <p>
                            您的数据主要存储在您的本地浏览器（Chrome Storage）中。
                            经过您授权同步的数据，会加密传输并存储在 Prome 的安全服务器上（使用 Supabase 提供服务）。
                            我们采用行业标准的加密技术（TLS/SSL）传输数据，确保传输过程的安全。
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Lock className="w-6 h-6 text-green-500" />
                            3. 权限使用说明
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-700 leading-relaxed">
                        <p className="mb-4">为了实现自动化功能，本扩展需要申请以下权限：</p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <li className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                                <span className="font-mono bg-gray-200 px-2 rounded text-sm">storage</span>
                                <span>用于保存您的用户设置和未同步的临时数据。</span>
                            </li>
                            <li className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                                <span className="font-mono bg-gray-200 px-2 rounded text-sm">cookies</span>
                                <span>用于检测小红书网站的登录状态，实现数据同步。</span>
                            </li>
                            <li className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                                <span className="font-mono bg-gray-200 px-2 rounded text-sm">host_permissions</span>
                                <span>用于访问小红书创作者中心接口以获取数据分析所需的统计信息。</span>
                            </li>
                            <li className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                                <span className="font-mono bg-gray-200 px-2 rounded text-sm">alarms</span>
                                <span>用于执行定时任务，如定时检查数据更新。</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <UserCheck className="w-6 h-6 text-orange-500" />
                            4. 第三方服务
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-700 leading-relaxed">
                        <p>
                            我们不会将您的个人数据出售、交易或转让给外部第三方。
                            作为服务的一部分，我们会与可信赖的第三方服务提供商（如 Supabase, Zeabur）合作，
                            这些合作伙伴同样受严格的保密协议约束。
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Mail className="w-6 h-6 text-red-500" />
                            5. 联系我们
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-700 leading-relaxed">
                        <p>
                            如果您对本隐私政策有任何疑问，请联系我们：
                        </p>
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block text-blue-700 font-medium">
                            support@prome.live
                        </div>
                    </CardContent>
                </Card>

                <div className="text-center text-gray-500 text-sm pt-8">
                    <p>最后更新日期：2025年1月1日</p>
                    <p>© 2025 Prome.Live. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
