import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Search, ArrowRight, Bot } from 'lucide-react';
import { Service } from '@/types';
import { servicesAPI } from '@/lib/services';
import { authService } from '@/lib/auth';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const user = authService.getCurrentUser();

  useEffect(() => {
    const fetchServices = async () => {
      const data = await servicesAPI.getServices();
      setServices(data);
    };
    fetchServices();
  }, []);

  const categories = ['all', ...new Set(services.map(service => service.category))];

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseService = (service: Service) => {
    if (!user) {
      navigate('/login');
    } else {
      navigate(`/chat/${service.id}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">服务目录</h1>
        <p className="text-gray-600">探索我们的AI服务，满足您的各种需求</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 md:items-center mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="搜索服务..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            className="w-full md:w-auto"
          >
            <TabsList className="w-full md:w-auto">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category === 'all' ? '全部' : category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.length > 0 ? (
          filteredServices.map((service) => (
            <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`h-2 ${service.popular ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <div className="rounded-full bg-gray-100 p-2">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>{service.name}</CardTitle>
                  </div>
                  {service.popular && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      热门
                    </Badge>
                  )}
                </div>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {service.features.map((feature, index) => (
                    <Badge key={index} variant="outline">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <div className="flex items-center">
                  <Badge className="bg-green-100 text-green-800">
                    ¥{service.pricePerToken}/Token
                  </Badge>
                </div>
                <Button onClick={() => handleUseService(service)}>
                  使用服务
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500 mb-4">未找到匹配的服务</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
            >
              清除筛选条件
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}