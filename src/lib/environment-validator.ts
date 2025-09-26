/**
 * Environment validation utility for production deployments
 * Ensures all required configuration is properly set
 */

interface EnvironmentConfig {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  testMode: boolean;
  nonAdminTest: boolean;
  problematicUserTest: boolean;
  difyIntegration: boolean;
  stripeKey: string | undefined;
}

interface ValidationResult {
  isValid: boolean;
  mode: 'production' | 'test' | 'development';
  issues: string[];
  warnings: string[];
  config: EnvironmentConfig;
}

export class EnvironmentValidator {
  
  private getEnvironmentConfig(): EnvironmentConfig {
    return {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      testMode: import.meta.env.VITE_TEST_MODE === 'true',
      nonAdminTest: import.meta.env.VITE_NON_ADMIN_TEST === 'true',
      problematicUserTest: import.meta.env.VITE_PROBLEMATIC_USER_TEST === 'true',
      difyIntegration: import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true',
      stripeKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    };
  }

  public validateEnvironment(): ValidationResult {
    const config = this.getEnvironmentConfig();
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Determine mode
    let mode: 'production' | 'test' | 'development' = 'development';
    
    if (config.testMode || config.nonAdminTest || config.problematicUserTest) {
      mode = 'test';
    } else if (import.meta.env.PROD) {
      mode = 'production';
    }

    // Validate based on mode
    if (mode === 'production') {
      this.validateProductionMode(config, issues, warnings);
    } else if (mode === 'test') {
      this.validateTestMode(config, issues, warnings);
    } else {
      this.validateDevelopmentMode(config, issues, warnings);
    }

    return {
      isValid: issues.length === 0,
      mode,
      issues,
      warnings,
      config
    };
  }

  private validateProductionMode(config: EnvironmentConfig, issues: string[], warnings: string[]): void {
    // Critical production requirements
    if (!config.supabaseUrl || config.supabaseUrl === 'https://test.supabase.co') {
      issues.push('Production requires a valid Supabase URL');
    }

    if (!config.supabaseAnonKey || config.supabaseAnonKey === 'test_key_for_development') {
      issues.push('Production requires a valid Supabase anonymous key');
    }

    // Supabase URL format validation
    if (config.supabaseUrl && !config.supabaseUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/)) {
      warnings.push('Supabase URL format may be incorrect for production');
    }

    // Test mode flags should not be enabled in production
    if (config.testMode) {
      warnings.push('VITE_TEST_MODE is enabled - this should be disabled in production');
    }

    if (config.nonAdminTest) {
      warnings.push('VITE_NON_ADMIN_TEST is enabled - this should be disabled in production');
    }

    if (config.problematicUserTest) {
      warnings.push('VITE_PROBLEMATIC_USER_TEST is enabled - this should be disabled in production');
    }

    // Optional features warnings
    if (!config.stripeKey) {
      warnings.push('Stripe integration not configured - payment features will be disabled');
    }

    if (!config.difyIntegration) {
      warnings.push('Dify integration is disabled - token monitoring features may be limited');
    }
  }

  private validateTestMode(config: EnvironmentConfig, issues: string[], warnings: string[]): void {
    // Test mode is more flexible
    if (!config.supabaseUrl && !config.testMode) {
      warnings.push('No Supabase URL configured - using mock database');
    }

    // Validate test mode flags consistency
    const testFlags = [config.testMode, config.nonAdminTest, config.problematicUserTest];
    const enabledFlags = testFlags.filter(Boolean).length;
    
    if (enabledFlags > 1) {
      warnings.push('Multiple test mode flags are enabled - only one should be active');
    }

    if (enabledFlags === 0 && import.meta.env.DEV) {
      warnings.push('No test mode flags enabled - system will attempt real authentication');
    }
  }

  private validateDevelopmentMode(config: EnvironmentConfig, issues: string[], warnings: string[]): void {
    // Development mode is most flexible
    if (!config.supabaseUrl) {
      warnings.push('No Supabase URL configured - using mock database');
    }

    if (!config.supabaseAnonKey) {
      warnings.push('No Supabase key configured - authentication will use fallbacks');
    }
  }

  public getRecommendations(): string[] {
    const validation = this.validateEnvironment();
    const recommendations: string[] = [];

    if (validation.mode === 'production') {
      recommendations.push('✅ Ensure your Supabase database schema is up to date using the provided SQL migrations');
      recommendations.push('✅ Verify RLS (Row Level Security) policies are properly configured');
      recommendations.push('✅ Test authentication flow with real user accounts');
      recommendations.push('✅ Validate CSP settings allow necessary external resources');
      
      if (validation.config.difyIntegration) {
        recommendations.push('✅ Test Dify API integration and token monitoring');
      }
      
      if (validation.config.stripeKey) {
        recommendations.push('✅ Verify Stripe webhook endpoints are configured');
      }
    } else if (validation.mode === 'test') {
      recommendations.push('🧪 Test mode enabled - authentication will use mock data');
      recommendations.push('🧪 Database operations will use fallback mechanisms');
      recommendations.push('🧪 Remember to disable test flags for production deployment');
    } else {
      recommendations.push('🔧 Development mode - configure environment variables for production');
      recommendations.push('🔧 Create .env file based on .env.example');
    }

    return recommendations;
  }

  public logValidationResults(): void {
    const validation = this.validateEnvironment();
    
    console.log(`🔍 Environment Validation Results (Mode: ${validation.mode.toUpperCase()})`);
    console.log('═'.repeat(60));
    
    if (validation.isValid) {
      console.log('✅ Environment configuration is valid');
    } else {
      console.log('❌ Environment configuration has issues');
    }

    if (validation.issues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      validation.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log('\n📋 Configuration:');
    console.log(`  • Supabase URL: ${validation.config.supabaseUrl ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  • Supabase Key: ${validation.config.supabaseAnonKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  • Test Mode: ${validation.config.testMode ? '🧪 Enabled' : '✅ Disabled'}`);
    console.log(`  • Dify Integration: ${validation.config.difyIntegration ? '✅ Enabled' : '⚠️  Disabled'}`);
    console.log(`  • Stripe: ${validation.config.stripeKey ? '✅ Configured' : '⚠️  Not configured'}`);

    const recommendations = this.getRecommendations();
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('═'.repeat(60));
  }
}

// Create global instance
export const environmentValidator = new EnvironmentValidator();

// Auto-validate on import in development
if (import.meta.env.DEV) {
  setTimeout(() => {
    environmentValidator.logValidationResults();
  }, 1000);
}