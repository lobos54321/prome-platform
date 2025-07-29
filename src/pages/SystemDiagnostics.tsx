import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Shield, 
  Settings,
  Users,
  CreditCard,
  Activity
} from 'lucide-react';
import { environmentValidator } from '@/lib/environment-validator';
import { databaseTester } from '@/lib/database-tester';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';

interface SystemCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'testing';
  message: string;
  details?: string;
  icon: React.ElementType;
}

export default function SystemDiagnostics() {
  const [checks, setChecks] = useState<SystemCheckResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  const initialChecks: SystemCheckResult[] = [
    {
      name: 'Environment Configuration',
      status: 'testing',
      message: 'Checking environment variables...',
      icon: Settings
    },
    {
      name: 'Database Connection',
      status: 'testing',
      message: 'Testing database connectivity...',
      icon: Database
    },
    {
      name: 'Authentication System',
      status: 'testing',
      message: 'Validating auth configuration...',
      icon: Shield
    },
    {
      name: 'User Management',
      status: 'testing',
      message: 'Testing user operations...',
      icon: Users
    },
    {
      name: 'Model Configurations',
      status: 'testing',
      message: 'Checking model configs...',
      icon: Activity
    },
    {
      name: 'Payment System',
      status: 'testing',
      message: 'Validating billing setup...',
      icon: CreditCard
    }
  ];

  useEffect(() => {
    runSystemChecks();
  }, []);

  const runSystemChecks = async () => {
    setIsRunning(true);
    setChecks(initialChecks);

    const results: SystemCheckResult[] = [];

    try {
      // 1. Environment Configuration Check
      console.log('🔍 Checking environment configuration...');
      const envValidation = environmentValidator.validateEnvironment();
      results.push({
        name: 'Environment Configuration',
        status: envValidation.isValid ? 'pass' : (envValidation.issues.length > 0 ? 'fail' : 'warning'),
        message: envValidation.isValid 
          ? `✅ Environment configured for ${envValidation.mode} mode`
          : `❌ Configuration issues detected`,
        details: envValidation.issues.length > 0 
          ? `Issues: ${envValidation.issues.join(', ')}`
          : envValidation.warnings.join(', '),
        icon: Settings
      });

      // 2. Database Connection Check
      console.log('🔍 Testing database connection...');
      try {
        const dbValidation = await databaseTester.runAllTests();
        results.push({
          name: 'Database Connection',
          status: dbValidation.isValid ? 'pass' : 'fail',
          message: dbValidation.isValid 
            ? '✅ Database connection and schema validated'
            : '❌ Database validation failed',
          details: `${dbValidation.results.filter(r => r.passed).length}/${dbValidation.results.length} tests passed`,
          icon: Database
        });
      } catch (error) {
        results.push({
          name: 'Database Connection',
          status: 'fail',
          message: '❌ Database connection failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          icon: Database
        });
      }

      // 3. Authentication System Check
      console.log('🔍 Testing authentication system...');
      try {
        const currentUser = authService.getCurrentUserSync();
        const isAuthenticated = authService.isAuthenticated();
        
        results.push({
          name: 'Authentication System',
          status: 'pass',
          message: isAuthenticated 
            ? `✅ User authenticated: ${currentUser?.email || 'Unknown'}`
            : '✅ Auth system ready (no user logged in)',
          details: `Mode: ${envValidation.mode}, Role: ${currentUser?.role || 'None'}`,
          icon: Shield
        });
      } catch (error) {
        results.push({
          name: 'Authentication System',
          status: 'fail',
          message: '❌ Authentication system error',
          details: error instanceof Error ? error.message : 'Unknown error',
          icon: Shield
        });
      }

      // 4. User Management Check
      console.log('🔍 Testing user management...');
      try {
        const currentUser = authService.getCurrentUserSync();
        if (currentUser) {
          const userFromDb = await authService.getUserById(currentUser.id);
          results.push({
            name: 'User Management',
            status: userFromDb ? 'pass' : 'warning',
            message: userFromDb 
              ? `✅ User data accessible (Balance: ${userFromDb.balance})`
              : '⚠️ User data not found in database',
            details: `User ID: ${currentUser.id}`,
            icon: Users
          });
        } else {
          results.push({
            name: 'User Management',
            status: 'warning',
            message: '⚠️ No user logged in to test',
            details: 'Login to test user management features',
            icon: Users
          });
        }
      } catch (error) {
        results.push({
          name: 'User Management',
          status: 'fail',
          message: '❌ User management error',
          details: error instanceof Error ? error.message : 'Unknown error',
          icon: Users
        });
      }

      // 5. Model Configurations Check
      console.log('🔍 Testing model configurations...');
      try {
        const modelConfigs = await db.getModelConfigs();
        const exchangeRate = await db.getCurrentExchangeRate();
        
        results.push({
          name: 'Model Configurations',
          status: modelConfigs.length > 0 ? 'pass' : 'warning',
          message: modelConfigs.length > 0 
            ? `✅ ${modelConfigs.length} model configs loaded`
            : '⚠️ No model configurations found',
          details: `Exchange rate: ${exchangeRate} points/USD`,
          icon: Activity
        });
      } catch (error) {
        results.push({
          name: 'Model Configurations',
          status: 'fail',
          message: '❌ Model configuration error',
          details: error instanceof Error ? error.message : 'Unknown error',
          icon: Activity
        });
      }

      // 6. Payment System Check
      console.log('🔍 Testing payment system...');
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      results.push({
        name: 'Payment System',
        status: stripeKey ? 'pass' : 'warning',
        message: stripeKey 
          ? '✅ Stripe integration configured'
          : '⚠️ Stripe not configured',
        details: stripeKey ? 'Payment features available' : 'Payment features disabled',
        icon: CreditCard
      });

    } catch (error) {
      console.error('System checks failed:', error);
    }

    setChecks(results);
    setIsRunning(false);
    setLastRunTime(new Date());
  };

  const getStatusColor = (status: SystemCheckResult['status']) => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-100';
      case 'fail': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'testing': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: SystemCheckResult['status']) => {
    switch (status) {
      case 'pass': return CheckCircle;
      case 'fail': return XCircle;
      case 'warning': return AlertCircle;
      case 'testing': return RefreshCw;
      default: return AlertCircle;
    }
  };

  const overallStatus = checks.length > 0 ? (
    checks.every(c => c.status === 'pass') ? 'pass' :
    checks.some(c => c.status === 'fail') ? 'fail' : 'warning'
  ) : 'testing';

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Diagnostics</h1>
          <p className="text-gray-600 mt-1">
            Validate your production deployment configuration
          </p>
        </div>
        <Button 
          onClick={runSystemChecks} 
          disabled={isRunning}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running...' : 'Run Checks'}</span>
        </Button>
      </div>

      {/* Overall Status */}
      <Alert className={`border-2 ${
        overallStatus === 'pass' ? 'border-green-200 bg-green-50' :
        overallStatus === 'fail' ? 'border-red-200 bg-red-50' :
        'border-yellow-200 bg-yellow-50'
      }`}>
        <div className="flex items-center space-x-3">
          {(() => {
            const Icon = getStatusIcon(overallStatus);
            return <Icon className="h-5 w-5" />;
          })()}
          <AlertDescription className="font-medium">
            {overallStatus === 'pass' && '✅ All systems operational - Ready for production'}
            {overallStatus === 'fail' && '❌ Critical issues detected - Needs attention'}
            {overallStatus === 'warning' && '⚠️ Some warnings detected - Review recommended'}
            {overallStatus === 'testing' && '🔍 Running system diagnostics...'}
          </AlertDescription>
        </div>
      </Alert>

      {lastRunTime && (
        <p className="text-sm text-gray-500">
          Last checked: {lastRunTime.toLocaleString()}
        </p>
      )}

      {/* System Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checks.map((check, index) => {
          const StatusIcon = getStatusIcon(check.status);
          const CheckIcon = check.icon;
          
          return (
            <Card key={index} className="border-l-4 border-l-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-3">
                    <CheckIcon className="h-5 w-5 text-gray-600" />
                    <span>{check.name}</span>
                  </div>
                  <Badge className={getStatusColor(check.status)}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {check.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-2">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {check.details}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Debug Information */}
      {import.meta.env.DEV && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Mode:</strong> {import.meta.env.MODE}</p>
              <p><strong>Environment:</strong> {import.meta.env.PROD ? 'Production' : 'Development'}</p>
              <p><strong>Test Flags:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>VITE_TEST_MODE: {import.meta.env.VITE_TEST_MODE || 'false'}</li>
                <li>VITE_NON_ADMIN_TEST: {import.meta.env.VITE_NON_ADMIN_TEST || 'false'}</li>
                <li>VITE_PROBLEMATIC_USER_TEST: {import.meta.env.VITE_PROBLEMATIC_USER_TEST || 'false'}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}