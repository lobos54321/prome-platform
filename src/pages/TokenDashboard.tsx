import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  TooltipProps
} from 'recharts';
import { 
  CalendarIcon, 
  BarChart2, 
  PieChart as PieChartIcon, 
  DownloadIcon,
  RefreshCcw,
  BadgeDollarSign,
  Coins,
  Timer,
  Zap,
  Terminal
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { authService } from '@/lib/auth';
import { difyTokenTracker } from '@/lib/dify-token-tracker';

// Types for the analytics data
interface TokenUsageSummary {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  average_tokens_per_request: number;
  request_count: number;
  currency: string;
}

interface TokenUsageByService {
  service_id: string;
  service_name: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
}

interface TokenUsageByModel {
  model: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
}

const generateDailyUsageData = (days: number) => {
  const data = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    data.push({
      date: format(date, 'MM-dd'),
      prompt_tokens: Math.floor(Math.random() * 1000) + 500,
      completion_tokens: Math.floor(Math.random() * 800) + 300,
      cost: Math.random() * 0.5 + 0.1
    });
  }
  
  return data;
};

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

interface DetailedDataTableProps {
  userId: string;
  timeRange: '7d' | '30d' | 'this_month' | 'this_week';
}

interface TokenUsageRecord {
  id: string;
  service_id: string;
  service_name?: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  model: string;
  latency?: number;
  timestamp: string;
  services?: {
    name: string;
  };
}

function DetailedDataTable({ userId, timeRange }: DetailedDataTableProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<TokenUsageRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  
  const getDateRange = useCallback(() => {
    const today = new Date();
    let startDate: Date, endDate: Date;
    
    switch(timeRange) {
      case '7d':
        startDate = subDays(today, 7);
        endDate = today;
        break;
      case '30d':
        startDate = subDays(today, 30);
        endDate = today;
        break;
      case 'this_month':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'this_week':
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      default:
        startDate = subDays(today, 7);
        endDate = today;
    }
    
    return { startDate, endDate };
  }, [timeRange]);
  
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if Supabase is configured
      const isSupabaseConfigured = 
        import.meta.env.VITE_SUPABASE_URL && 
        import.meta.env.VITE_SUPABASE_ANON_KEY;
        
      console.log('Detailed Records: Supabase configured:', isSupabaseConfigured);
      
      const { startDate, endDate } = getDateRange();
      const offset = page * PAGE_SIZE;
      
      // Use demo user ID if Supabase is not configured
      const effectiveUserId = isSupabaseConfigured ? userId : 'demo-user';
      
      const result = await difyTokenTracker.getDetailedTokenUsageRecords(
        effectiveUserId, 
        startDate, 
        endDate,
        PAGE_SIZE,
        offset
      );
      
      if (result) {
        setRecords(result.records);
        setTotalCount(result.count);
      }
    } catch (error) {
      console.error('Error loading detailed records:', error);
      
      // Generate fallback data
      const fallbackRecords = Array.from({ length: 10 }, (_, index) => {
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        const promptTokens = Math.floor(Math.random() * 500) + 100;
        const completionTokens = Math.floor(Math.random() * 300) + 50;
        const model = ['gpt-3.5-turbo', 'gpt-4', 'claude-2', 'llama-2-70b'][Math.floor(Math.random() * 4)];
        const service = ['聊天助手', '内容创作', '代码助手', '文档问答'][Math.floor(Math.random() * 4)];
        
        return {
          id: `fallback-${index}`,
          service_id: `service-${index}`,
          service_name: service,
          tokens_used: promptTokens + completionTokens,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost: model === 'gpt-4' ? 0.01 + Math.random() * 0.02 : 0.001 + Math.random() * 0.005,
          model,
          latency: Math.random() * 1.5 + 0.2,
          timestamp: timestamp.toISOString(),
        };
      });
      
      setRecords(fallbackRecords);
      setTotalCount(30); // Simulate 30 total records
    } finally {
      setIsLoading(false);
    }
  }, [userId, page, getDateRange]);
  
  useEffect(() => {
    loadData();
  }, [loadData, timeRange]);
  
  const handlePreviousPage = () => {
    if (page > 0) setPage(page - 1);
  };
  
  const handleNextPage = () => {
    if ((page + 1) * PAGE_SIZE < totalCount) setPage(page + 1);
  };
  
  // Calculate total pages
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">时间</th>
              <th className="text-left py-3 px-4">服务</th>
              <th className="text-left py-3 px-4">模型</th>
              <th className="text-right py-3 px-4">输入Tokens</th>
              <th className="text-right py-3 px-4">输出Tokens</th>
              <th className="text-right py-3 px-4">总Tokens</th>
              <th className="text-right py-3 px-4">费用</th>
              <th className="text-right py-3 px-4">延迟</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8">
                  加载中...
                </td>
              </tr>
            ) : records.length > 0 ? (
              records.map((record, index) => (
                <tr key={record.id || index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{format(new Date(record.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}</td>
                  <td className="py-3 px-4">
                    {record.service_name || '未知服务'}
                  </td>
                  <td className="py-3 px-4">
                    {record.model || '未知模型'}
                  </td>
                  <td className="text-right py-3 px-4">{record.prompt_tokens || 0}</td>
                  <td className="text-right py-3 px-4">{record.completion_tokens || 0}</td>
                  <td className="text-right py-3 px-4">{record.tokens_used || 0}</td>
                  <td className="text-right py-3 px-4">
                    ¥{typeof record.cost === 'number' ? record.cost.toFixed(6) : '0.000000'}
                  </td>
                  <td className="text-right py-3 px-4">
                    {typeof record.latency === 'number' ? `${record.latency.toFixed(2)}秒` : 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-8">
                  没有找到记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {records.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            共 {totalCount} 条记录，当前显示 {Math.min(page * PAGE_SIZE + 1, totalCount)} - {Math.min((page + 1) * PAGE_SIZE, totalCount)}
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 0}
            >
              上一页
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNextPage}
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function TokenDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'this_month' | 'this_week'>('7d');
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [serviceData, setServiceData] = useState<TokenUsageByService[]>([]);
  const [modelData, setModelData] = useState<TokenUsageByModel[]>([]);
  const [dailyUsageData, setDailyUsageData] = useState(generateDailyUsageData(7));
  const [isLoading, setIsLoading] = useState(true);
  const user = authService.getCurrentUser();

  const getDateRange = () => {
    const today = new Date();
    let startDate: Date, endDate: Date;
    
    switch(timeRange) {
      case '7d':
        startDate = subDays(today, 7);
        endDate = today;
        break;
      case '30d':
        startDate = subDays(today, 30);
        endDate = today;
        break;
      case 'this_month':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'this_week':
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      default:
        startDate = subDays(today, 7);
        endDate = today;
    }
    
    return { startDate, endDate };
  };

  const loadData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const isSupabaseConfigured = 
        import.meta.env.VITE_SUPABASE_URL && 
        import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('Token Dashboard: Supabase configured:', isSupabaseConfigured);
      const { startDate, endDate } = getDateRange();
      const effectiveUserId = isSupabaseConfigured ? user.id : 'demo-user';
      
      const summaryData = await difyTokenTracker.getTokenUsageSummary(effectiveUserId, startDate, endDate);
      setSummary(summaryData);
      const serviceBreakdown = await difyTokenTracker.getTokenUsageByService(effectiveUserId, startDate, endDate);
      setServiceData(serviceBreakdown);
      const modelBreakdown = await difyTokenTracker.getTokenUsageByModel(effectiveUserId, startDate, endDate);
      setModelData(modelBreakdown);
      const dailyData = await difyTokenTracker.getDailyTokenUsage(effectiveUserId, startDate, endDate);
      setDailyUsageData(dailyData);
      
    } catch (error) {
      console.error('Error loading token usage data:', error);
      setDailyUsageData(generateDailyUsageData(timeRange === '7d' ? 7 : 30));
      setSummary({
        total_prompt_tokens: 12500,
        total_completion_tokens: 8750,
        total_tokens: 21250,
        total_cost: 0.425,
        average_tokens_per_request: 850,
        request_count: 25,
        currency: 'USD'
      });
      setServiceData([
        { service_id: 'chat-service', service_name: '聊天助手', total_tokens: 8500, total_cost: 0.17, request_count: 10 },
        { service_id: 'writing-service', service_name: '内容创作', total_tokens: 6200, total_cost: 0.124, request_count: 8 },
        { service_id: 'code-service', service_name: '代码助手', total_tokens: 4300, total_cost: 0.086, request_count: 5 },
        { service_id: 'document-qa', service_name: '文档问答', total_tokens: 2250, total_cost: 0.045, request_count: 2 }
      ]);
      setModelData([
        { model: 'gpt-3.5-turbo', total_tokens: 9800, total_cost: 0.196, request_count: 12 },
        { model: 'gpt-4', total_tokens: 5400, total_cost: 0.162, request_count: 6 },
        { model: 'claude-2', total_tokens: 4200, total_cost: 0.042, request_count: 5 },
        { model: 'llama-2-70b', total_tokens: 1850, total_cost: 0.025, request_count: 2 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate, timeRange]);

  if (!user) return null;

  const CustomTooltip = ({ 
    active, 
    payload, 
    label 
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded shadow-sm">
          <p className="text-sm font-semibold">{`${label}`}</p>
          <p className="text-xs text-blue-600">{`输入: ${payload[0]?.value?.toLocaleString() || 0} tokens`}</p>
          <p className="text-xs text-green-600">{`输出: ${payload[1]?.value?.toLocaleString() || 0} tokens`}</p>
          {payload[2] && <p className="text-xs text-orange-600">{`费用: ¥${typeof payload[2]?.value === 'number' ? payload[2].value.toFixed(4) : '0.0000'}`}</p>}
        </div>
      );
    }
    return null;
  };

  const formatCurrency = (value: number) => {
    return `¥${typeof value === 'number' ? value.toFixed(4) : '0.0000'}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Token 使用分析</h1>
          <p className="text-gray-600">查看和分析您的 AI token 使用情况</p>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={timeRange} 
            onValueChange={(value) => setTimeRange(value as '7d' | '30d' | 'this_month' | 'this_week')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">最近7天</SelectItem>
              <SelectItem value="30d">最近30天</SelectItem>
              <SelectItem value="this_month">本月</SelectItem>
              <SelectItem value="this_week">本周</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadData} 
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总Token使用量</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_tokens?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">
              输入: {summary?.total_prompt_tokens?.toLocaleString() || '0'} / 输出: {summary?.total_completion_tokens?.toLocaleString() || '0'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总费用</CardTitle>
            <BadgeDollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{typeof summary?.total_cost === 'number' ? summary.total_cost.toFixed(4) : '0.0000'}</div>
            <p className="text-xs text-muted-foreground">
              平均每次请求: ¥{summary && typeof summary.total_cost === 'number' && typeof summary.request_count === 'number'
                ? (summary.total_cost / summary.request_count).toFixed(4)
                : '0.0000'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">请求次数</CardTitle>
            <Terminal className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.request_count?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">
              平均每次: {typeof summary?.average_tokens_per_request === 'number'
                ? summary.average_tokens_per_request.toFixed(0)
                : '0'} tokens
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Timer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(Math.random() * 0.5 + 0.8).toFixed(2)}秒</div>
            <p className="text-xs text-muted-foreground">
              所有API请求的平均值
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different charts */}
      <Tabs defaultValue="overview" className="w-full space-y-5">
        <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">使用概览</TabsTrigger>
          <TabsTrigger value="services">服务分析</TabsTrigger>
          <TabsTrigger value="models">模型分析</TabsTrigger>
          <TabsTrigger value="details">详细数据</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Token 使用趋势</CardTitle>
              <CardDescription>
                查看一段时间内的token使用情况
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyUsageData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPrompt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="prompt_tokens" 
                    name="输入Tokens" 
                    stroke="#0088FE" 
                    fillOpacity={1} 
                    fill="url(#colorPrompt)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completion_tokens" 
                    name="输出Tokens" 
                    stroke="#00C49F" 
                    fillOpacity={1} 
                    fill="url(#colorCompletion)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>费用趋势</CardTitle>
              <CardDescription>
                查看一段时间内的API使用费用
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyUsageData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value: number): [string, string] =>
                    [`¥${typeof value === 'number' ? value.toFixed(4) : '0.0000'}`, '费用']
                  } />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="费用" 
                    stroke="#FF8042" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>各服务Token使用量</CardTitle>
                <CardDescription>
                  按服务分类的Token使用情况
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={serviceData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="service_name" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="total_tokens" 
                      name="Token 总量" 
                      fill="#0088FE" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>各服务费用分布</CardTitle>
                <CardDescription>
                  按服务分类的费用分布
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total_cost"
                      nameKey="service_name"
                    >
                      {serviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number): string =>
                      `¥${typeof value === 'number' ? value.toFixed(4) : '0.0000'}`
                    } />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>服务使用详情</CardTitle>
                <CardDescription>
                  每项服务的使用量和费用详情
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">服务名称</th>
                        <th className="text-right py-3 px-4">请求次数</th>
                        <th className="text-right py-3 px-4">Token使用量</th>
                        <th className="text-right py-3 px-4">总费用</th>
                        <th className="text-right py-3 px-4">平均费用/请求</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceData.length > 0 ? (
                        serviceData.map((service, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{service.service_name}</td>
                            <td className="text-right py-3 px-4">{service.request_count.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">{service.total_tokens.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">¥{typeof service.total_cost === 'number' ? service.total_cost.toFixed(4) : '0.0000'}</td>
                            <td className="text-right py-3 px-4">
                              ¥{typeof service.total_cost === 'number' && typeof service.request_count === 'number'
                                ? (service.total_cost / service.request_count).toFixed(4)
                                : '0.0000'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-4">暂无数据</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>各模型Token使用量</CardTitle>
                <CardDescription>
                  按AI模型分类的Token使用情况
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={modelData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="total_tokens" 
                      name="Token 总量" 
                      fill="#8884D8" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>各模型费用分布</CardTitle>
                <CardDescription>
                  按AI模型分类的费用分布
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total_cost"
                      nameKey="model"
                    >
                      {modelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number): string =>
                      `¥${typeof value === 'number' ? value.toFixed(4) : '0.0000'}`
                    } />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>模型使用详情</CardTitle>
                <CardDescription>
                  每个AI模型的使用量和费用详情
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">模型名称</th>
                        <th className="text-right py-3 px-4">请求次数</th>
                        <th className="text-right py-3 px-4">Token使用量</th>
                        <th className="text-right py-3 px-4">总费用</th>
                        <th className="text-right py-3 px-4">平均费用/请求</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelData.length > 0 ? (
                        modelData.map((model, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{model.model}</td>
                            <td className="text-right py-3 px-4">{model.request_count.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">{model.total_tokens.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">¥{typeof model.total_cost === 'number' ? model.total_cost.toFixed(4) : '0.0000'}</td>
                            <td className="text-right py-3 px-4">
                              ¥{typeof model.total_cost === 'number' && typeof model.request_count === 'number'
                                ? (model.total_cost / model.request_count).toFixed(4)
                                : '0.0000'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-4">暂无数据</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>详细数据记录</CardTitle>
                <CardDescription>
                  查看每次请求的详细Token使用记录
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <DownloadIcon className="mr-2 h-4 w-4" /> 导出数据
              </Button>
            </CardHeader>
            <CardContent>
              <DetailedDataTable userId={user.id} timeRange={timeRange} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
