/**
 * Database connection and schema validation utility
 * Ensures database is properly configured for production
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { emitDatabaseError, emitDatabaseRecover } from '@/components/ui/DatabaseStatusIndicator';

interface DatabaseTest {
  name: string;
  description: string;
  test: () => Promise<boolean>;
  required: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

interface DatabaseValidationResult {
  isValid: boolean;
  allTestsPassed: boolean;
  requiredTestsPassed: boolean;
  results: TestResult[];
  summary: string;
}

export class DatabaseConnectionTester {
  
  private tests: DatabaseTest[] = [
    {
      name: 'Connection',
      description: 'Test basic database connection',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!.from('users').select('count').limit(1);
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'UsersTable',
      description: 'Verify users table structure and access',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('users')
          .select('id, name, email, role, balance, created_at')
          .limit(1);
        
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'ModelConfigsTable',
      description: 'Verify model_configs table exists and is accessible',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('model_configs')
          .select('id, model_name, input_token_price, output_token_price, is_active')
          .limit(1);
        
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'ExchangeRatesTable',
      description: 'Verify exchange_rates table exists and has data',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('exchange_rates')
          .select('id, rate, is_active')
          .eq('is_active', true)
          .limit(1);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          throw new Error('No active exchange rate found');
        }
        
        return true;
      }
    },
    {
      name: 'TokenUsageTable',
      description: 'Verify token_usage table structure',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('token_usage')
          .select('id, user_id, service_id, tokens_used, cost, created_at')
          .limit(1);
        
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'BillingRecordsTable',
      description: 'Verify billing_records table with created_at field',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('billing_records')
          .select('id, user_id, type, amount, description, created_at, status')
          .limit(1);
        
        if (error) throw error;
        return true;
      }
    },
    {
      name: 'AuthConnection',
      description: 'Test Supabase Auth functionality',
      required: true,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!.auth.getSession();
        if (error) throw error;
        
        // Just check that auth is responding, session may be null
        return true;
      }
    },
    {
      name: 'RLSPolicies',
      description: 'Test Row Level Security policies (non-critical)',
      required: false,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        // Try to access data without authentication - should work for reading if RLS is properly configured
        const { data, error } = await supabase!
          .from('model_configs')
          .select('model_name')
          .eq('is_active', true)
          .limit(1);
        
        // If error includes RLS-related messages, it means policies are active
        if (error && error.message.includes('row-level security')) {
          return true; // RLS is working
        }
        
        return data !== null; // Should still work for public read access
      }
    },
    {
      name: 'DefaultData',
      description: 'Check if default model configurations exist',
      required: false,
      test: async () => {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase not configured');
        }
        
        const { data, error } = await supabase!
          .from('model_configs')
          .select('model_name')
          .eq('is_active', true);
        
        if (error) throw error;
        
        const expectedModels = ['gpt-4', 'gpt-3.5-turbo'];
        const hasBasicModels = expectedModels.some(model => 
          data?.some(config => config.model_name === model)
        );
        
        if (!hasBasicModels) {
          throw new Error('Basic model configurations (GPT-4, GPT-3.5) not found');
        }
        
        return true;
      }
    }
  ];

  public async runAllTests(): Promise<DatabaseValidationResult> {
    const results: TestResult[] = [];
    let allTestsPassed = true;
    let requiredTestsPassed = true;

    console.log('🔍 Running database validation tests...');

    for (const test of this.tests) {
      console.log(`Testing: ${test.name}...`);
      
      try {
        const passed = await test.test();
        results.push({
          name: test.name,
          passed,
          details: passed ? '✅ Passed' : '❌ Failed'
        });
        
        if (!passed) {
          allTestsPassed = false;
          if (test.required) {
            requiredTestsPassed = false;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          name: test.name,
          passed: false,
          error: errorMessage,
          details: `❌ Failed: ${errorMessage}`
        });
        
        allTestsPassed = false;
        if (test.required) {
          requiredTestsPassed = false;
        }
      }
    }

    const isValid = requiredTestsPassed;
    const summary = this.generateSummary(results, isValid, allTestsPassed, requiredTestsPassed);

    return {
      isValid,
      allTestsPassed,
      requiredTestsPassed,
      results,
      summary
    };
  }

  public async testBasicConnection(): Promise<boolean> {
    if (!isSupabaseConfigured) {
      console.log('⚠️ Supabase not configured - using mock database');
      return false;
    }

    try {
      const { data, error } = await supabase!.from('users').select('count').limit(1);
      if (error) {
        console.error('❌ Database connection failed:', error.message);
        emitDatabaseError('连接测试', error);
        return false;
      }
      
      console.log('✅ Database connection successful');
      emitDatabaseRecover();
      return true;
    } catch (error) {
      console.error('❌ Database connection error:', error);
      emitDatabaseError('连接测试', error);
      return false;
    }
  }

  public async validateProductionReadiness(): Promise<boolean> {
    const validation = await this.runAllTests();
    
    console.log('\n📊 Database Validation Summary');
    console.log('═'.repeat(50));
    console.log(validation.summary);
    
    if (validation.isValid) {
      console.log('\n✅ Database is ready for production use');
      emitDatabaseRecover();
    } else {
      console.log('\n❌ Database is not ready for production');
      emitDatabaseError('生产环境验证', new Error('Database validation failed'));
    }

    return validation.isValid;
  }

  private generateSummary(
    results: TestResult[], 
    isValid: boolean, 
    allTestsPassed: boolean, 
    requiredTestsPassed: boolean
  ): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const requiredTests = this.tests.filter(t => t.required).length;
    const passedRequiredTests = results.filter((r, i) => r.passed && this.tests[i].required).length;

    let summary = `Overall Status: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`;
    summary += `Tests Passed: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)\n`;
    summary += `Required Tests: ${passedRequiredTests}/${requiredTests} ${requiredTestsPassed ? '✅' : '❌'}\n\n`;

    summary += 'Test Results:\n';
    results.forEach((result, index) => {
      const test = this.tests[index];
      const icon = result.passed ? '✅' : '❌';
      const required = test.required ? '[REQUIRED]' : '[OPTIONAL]';
      summary += `  ${icon} ${result.name} ${required}\n`;
      if (result.error) {
        summary += `      Error: ${result.error}\n`;
      }
    });

    if (!isValid) {
      summary += '\n🔧 Recommendations:\n';
      if (!requiredTestsPassed) {
        summary += '  • Run database migrations: see supabase/schema.sql\n';
        summary += '  • Check Supabase project configuration\n';
        summary += '  • Verify environment variables are correct\n';
      }
    }

    return summary;
  }

  public logDetailedResults(results: DatabaseValidationResult): void {
    console.log('\n🔍 Detailed Database Test Results');
    console.log('═'.repeat(60));
    
    results.results.forEach((result, index) => {
      const test = this.tests[index];
      console.log(`\n${result.passed ? '✅' : '❌'} ${result.name} ${test.required ? '[REQUIRED]' : '[OPTIONAL]'}`);
      console.log(`   Description: ${test.description}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log(`\n📊 Summary: ${results.isValid ? 'READY FOR PRODUCTION' : 'NEEDS FIXES'}`);
  }
}

// Create global instance
export const databaseTester = new DatabaseConnectionTester();

// Development helper
if (import.meta.env.DEV) {
  (window as Record<string, unknown>).testDatabase = async () => {
    const results = await databaseTester.runAllTests();
    databaseTester.logDetailedResults(results);
    return results;
  };
}