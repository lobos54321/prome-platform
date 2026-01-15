import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

export type WizardStep = 'product' | 'account' | 'preferences';

interface WizardProgressProps {
  currentStep: WizardStep;
}

const steps: { id: WizardStep; label: string; number: number }[] = [
  { id: 'product', label: '产品配置', number: 1 },
  { id: 'account', label: '账号绑定', number: 2 },
  { id: 'preferences', label: '运营偏好', number: 3 },
];

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle & Label */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-6 h-6" /> : step.number}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                    isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 w-24 h-[2px] mx-2 bg-gray-200 relative -top-3">
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                    style={{
                      width: isCompleted ? '100%' : '0%',
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
