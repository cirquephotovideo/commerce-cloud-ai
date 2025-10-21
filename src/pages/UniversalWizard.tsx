import { UniversalWizardProvider, useWizard } from '@/contexts/UniversalWizardContext';
import { WizardStepper } from '@/components/wizard/WizardStepper';
import { ConfigurationPanel } from '@/components/wizard/ConfigurationPanel';
import { ResultsPanel } from '@/components/wizard/ResultsPanel';
import { Step1OperationType } from '@/components/wizard/steps/Step1OperationType';
import { Step2SourceSelection } from '@/components/wizard/steps/Step2SourceSelection';
import { Step3Configuration } from '@/components/wizard/steps/Step3Configuration';
import { Step4ProductSelection } from '@/components/wizard/steps/Step4ProductSelection';
import { Step5AdvancedOptions } from '@/components/wizard/steps/Step5AdvancedOptions';
import { Step6Summary } from '@/components/wizard/steps/Step6Summary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

const steps = [
  { number: 1, title: 'Type', description: 'Opération' },
  { number: 2, title: 'Source', description: 'Sélection' },
  { number: 3, title: 'Config', description: 'Paramètres' },
  { number: 4, title: 'Produits', description: 'Sélection' },
  { number: 5, title: 'Options', description: 'Avancées' },
  { number: 6, title: 'Résumé', description: 'Lancement' },
];

const WizardContent = () => {
  const { state, goToStep } = useWizard();

  const renderStep = () => {
    switch (state.currentStep) {
      case 1: return <Step1OperationType />;
      case 2: return <Step2SourceSelection />;
      case 3: return <Step3Configuration />;
      case 4: return <Step4ProductSelection />;
      case 5: return <Step5AdvancedOptions />;
      case 6: return <Step6Summary />;
      default: return <Step1OperationType />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-3xl">
            <Sparkles className="h-8 w-8 text-primary" />
            Wizard Universel Tarifique
          </CardTitle>
          <CardDescription className="text-base">
            Assistant intelligent pour importer, enrichir et exporter vos produits en quelques clics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WizardStepper currentStep={state.currentStep} steps={steps} onStepClick={goToStep} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigurationPanel>{renderStep()}</ConfigurationPanel>
        <ResultsPanel />
      </div>
    </div>
  );
};

export default function UniversalWizard() {
  return (
    <UniversalWizardProvider>
      <WizardContent />
    </UniversalWizardProvider>
  );
}
