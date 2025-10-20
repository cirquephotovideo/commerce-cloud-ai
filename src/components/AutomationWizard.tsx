import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Step1Type } from './automation-wizard/Step1Type';
import { Step2Source } from './automation-wizard/Step2Source';
import { Step3Trigger } from './automation-wizard/Step3Trigger';
import { Step4Actions } from './automation-wizard/Step4Actions';
import { Step5Errors } from './automation-wizard/Step5Errors';
import { Step6Summary } from './automation-wizard/Step6Summary';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutomationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AutomationWizard = ({ open, onOpenChange }: AutomationWizardProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Wizard state
  const [selectedType, setSelectedType] = useState<string>('');
  const [sourceConfig, setSourceConfig] = useState<any>({});
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [actionsConfig, setActionsConfig] = useState<any>({});
  const [errorConfig, setErrorConfig] = useState<any>({});
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return selectedType !== '';
      case 2:
        return sourceConfig.supplierId || sourceConfig.sourceType;
      case 3:
        return triggerConfig.type !== undefined;
      case 4:
        return true; // Actions are optional
      case 5:
        return errorConfig.strategy !== undefined;
      case 6:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps && canGoNext()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Build trigger configuration
      const triggerFrequency = triggerConfig.type === 'schedule' 
        ? triggerConfig.frequency || 'daily'
        : null;

      // Build action configuration
      const actionConfig = {
        autoEnrich: actionsConfig.autoEnrich || false,
        enrichmentTypes: actionsConfig.enrichmentTypes || [],
        autoLink: actionsConfig.autoLink || false,
        linkConfidence: actionsConfig.linkConfidence || 80,
        autoAlerts: actionsConfig.autoAlerts || false,
        alertRules: actionsConfig.alertRules || [],
        autoExport: actionsConfig.autoExport || false,
        exportPlatforms: actionsConfig.exportPlatforms || [],
      };

      // Build error handling config
      const errorHandling = {
        strategy: errorConfig.strategy || 'continue',
        retryCount: errorConfig.retryCount || 3,
        retryDelay: errorConfig.retryDelay || 5,
        notificationEmail: errorConfig.notificationEmail || '',
      };

      // Create the automation rule
      const { error: insertError } = await supabase
        .from('automation_master_rules')
        .insert({
          user_id: user.id,
          rule_name: ruleName || `${selectedType} automation`,
          rule_description: ruleDescription,
          rule_category: selectedType,
          trigger_type: triggerConfig.type || 'schedule',
          trigger_config: {
            frequency: triggerFrequency,
            ...triggerConfig,
          },
          actions: actionConfig,
          source_config: sourceConfig,
          is_active: true,
          priority: 5,
          on_error_action: errorConfig.strategy || 'continue',
        });

      if (insertError) throw insertError;

      toast.success('Automatisation créée avec succès');
      onOpenChange(false);
      
      // Reset wizard
      setCurrentStep(1);
      setSelectedType('');
      setSourceConfig({});
      setTriggerConfig({});
      setActionsConfig({});
      setErrorConfig({});
      setRuleName('');
      setRuleDescription('');

    } catch (error: any) {
      console.error('Error creating automation:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Créer une automatisation - Étape {currentStep}/{totalSteps}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Type</span>
              <span>Source</span>
              <span>Déclencheur</span>
              <span>Actions</span>
              <span>Erreurs</span>
              <span>Résumé</span>
            </div>
          </div>

          {/* Step content */}
          <div className="min-h-[400px]">
            {currentStep === 1 && (
              <Step1Type 
                selectedType={selectedType}
                onTypeChange={setSelectedType}
              />
            )}
            {currentStep === 2 && (
              <Step2Source
                selectedType={selectedType}
                sourceConfig={sourceConfig}
                onSourceConfigChange={setSourceConfig}
              />
            )}
            {currentStep === 3 && (
              <Step3Trigger
                triggerConfig={triggerConfig}
                onTriggerConfigChange={setTriggerConfig}
              />
            )}
            {currentStep === 4 && (
              <Step4Actions
                selectedType={selectedType}
                actionsConfig={actionsConfig}
                onActionsConfigChange={setActionsConfig}
              />
            )}
            {currentStep === 5 && (
              <Step5Errors
                errorConfig={errorConfig}
                onErrorConfigChange={setErrorConfig}
              />
            )}
            {currentStep === 6 && (
              <Step6Summary
                selectedType={selectedType}
                sourceConfig={sourceConfig}
                triggerConfig={triggerConfig}
                actionsConfig={actionsConfig}
                errorConfig={errorConfig}
                ruleName={ruleName}
                ruleDescription={ruleDescription}
                onRuleNameChange={setRuleName}
                onRuleDescriptionChange={setRuleDescription}
              />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>

            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext()}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Création...' : 'Créer l\'automatisation'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
