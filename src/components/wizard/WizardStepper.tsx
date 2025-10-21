import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  number: number;
  title: string;
  description: string;
}

interface WizardStepperProps {
  currentStep: number;
  steps: Step[];
  onStepClick: (step: number) => void;
}

export const WizardStepper = ({ currentStep, steps, onStepClick }: WizardStepperProps) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex-1">
            <div className="flex items-center">
              <button
                onClick={() => onStepClick(step.number)}
                disabled={step.number > currentStep}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  step.number < currentStep && "bg-primary border-primary text-primary-foreground",
                  step.number === currentStep && "border-primary text-primary",
                  step.number > currentStep && "border-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {step.number < currentStep ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <span className="text-lg font-semibold">{step.number}</span>
                )}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-1 flex-1 mx-2 transition-all",
                    step.number < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
            <div className="mt-2 hidden md:block">
              <p className={cn(
                "text-sm font-medium",
                step.number === currentStep ? "text-primary" : "text-muted-foreground"
              )}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
