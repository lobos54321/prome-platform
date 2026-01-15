/**
 * SetupWizard - 小红书自动化设置向导
 *
 * 3 步设置流程：
 * 1. 产品配置 - 产品名称、目标客户、素材上传
 * 2. 账号绑定 - Chrome 插件检测、Cookie 同步
 * 3. 运营偏好 - 营销目标、发布频率、内容形式
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useXiaohongshuStore } from '@/stores/xiaohongshu-store';
import { WizardProgress, type WizardStep } from './wizard/WizardProgress';
import { ProductConfigSection } from './wizard/ProductConfigSection';
import { AccountBindingSection } from './wizard/AccountBindingSection';
import { PreferencesSection } from './wizard/PreferencesSection';

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { identity, data, ui, actions } = useXiaohongshuStore();
  const [currentStep, setCurrentStep] = useState<WizardStep>('product');
  const [loading, setLoading] = useState(true);

  // Initialize and load data on mount
  useEffect(() => {
    const init = async () => {
      if (!identity.supabaseUuid || !identity.xhsUserId) {
        setLoading(false);
        return;
      }

      try {
        // Load all data from backend/supabase
        await actions.loadAll();
      } catch (err) {
        console.error('Failed to load wizard data:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [identity.supabaseUuid, identity.xhsUserId]);

  // Determine initial step based on existing data
  useEffect(() => {
    if (ui.initialized && !loading) {
      // If already on dashboard, stay there
      if (ui.step === 'dashboard') {
        onComplete();
        return;
      }

      // Otherwise, determine which wizard step to show based on saved data
      // Check if product config is complete (has product name)
      const hasProductConfig = !!data.profile?.product_name;

      // Check if account is bound (has login status in store)
      const hasAccountBound = !!data.status?.isLoggedIn;

      if (!hasProductConfig) {
        // No product config yet, start from beginning
        setCurrentStep('product');
      } else if (!hasAccountBound) {
        // Has product but no account, go to account binding
        setCurrentStep('account');
      } else {
        // Has both, go to preferences
        setCurrentStep('preferences');
      }
    }
  }, [ui.initialized, ui.step, loading, data.profile, data.status]);

  const handleProductNext = () => {
    setCurrentStep('account');
  };

  const handleAccountNext = () => {
    setCurrentStep('preferences');
  };

  const handleAccountPrev = () => {
    setCurrentStep('product');
  };

  const handlePreferencesPrev = () => {
    setCurrentStep('account');
  };

  const handlePreferencesComplete = () => {
    // Workflow completed, switch to dashboard
    actions.setStep('dashboard');
    onComplete();
  };

  if (loading || !identity.supabaseUuid) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Progress Stepper */}
      <div className="mb-8">
        <WizardProgress currentStep={currentStep} />
      </div>

      {/* Step Content */}
      <div className="px-4">
        {currentStep === 'product' && (
          <ProductConfigSection onNext={handleProductNext} />
        )}

        {currentStep === 'account' && (
          <AccountBindingSection
            onNext={handleAccountNext}
            onPrev={handleAccountPrev}
          />
        )}

        {currentStep === 'preferences' && (
          <PreferencesSection
            onPrev={handlePreferencesPrev}
            onComplete={handlePreferencesComplete}
          />
        )}
      </div>
    </div>
  );
}

export default SetupWizard;
