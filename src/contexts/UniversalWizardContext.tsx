import { createContext, useContext, useState, ReactNode } from 'react';

interface WizardState {
  currentStep: number;
  operationType: 'import' | 'export' | 'enrichment' | 'analysis' | null;
  source: any;
  configuration: Record<string, any>;
  selectedProducts: string[];
  advancedOptions: {
    autoEnrich: boolean;
    exportPlatforms: string[];
    enrichmentTypes: string[];
    aiProvider: 'lovable-ai' | 'ollama' | 'openai';
  };
  results: {
    preview: any | null;
    logs: string[];
    status: 'idle' | 'processing' | 'completed' | 'error';
  };
}

interface WizardContextType {
  state: WizardState;
  goToStep: (step: number) => void;
  updateOperationType: (type: WizardState['operationType']) => void;
  updateSource: (source: any) => void;
  updateConfiguration: (config: Record<string, any>) => void;
  selectProducts: (ids: string[]) => void;
  updateAdvancedOptions: (options: Partial<WizardState['advancedOptions']>) => void;
  launchOperation: () => Promise<void>;
  resetWizard: () => void;
}

const initialState: WizardState = {
  currentStep: 1,
  operationType: null,
  source: null,
  configuration: {},
  selectedProducts: [],
  advancedOptions: {
    autoEnrich: false,
    exportPlatforms: [],
    enrichmentTypes: [],
    aiProvider: 'lovable-ai',
  },
  results: {
    preview: null,
    logs: [],
    status: 'idle',
  },
};

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const UniversalWizardProvider = ({ children }: { children: ReactNode }) => {
  const [wizardState, setWizardState] = useState<WizardState>(initialState);

  const goToStep = (step: number) => {
    setWizardState(prev => ({ ...prev, currentStep: step }));
  };

  const updateOperationType = (type: WizardState['operationType']) => {
    setWizardState(prev => ({ ...prev, operationType: type }));
  };

  const updateSource = (source: any) => {
    setWizardState(prev => ({ ...prev, source }));
  };

  const updateConfiguration = (config: Record<string, any>) => {
    setWizardState(prev => ({ ...prev, configuration: { ...prev.configuration, ...config } }));
  };

  const selectProducts = (ids: string[]) => {
    setWizardState(prev => ({ ...prev, selectedProducts: ids }));
  };

  const updateAdvancedOptions = (options: Partial<WizardState['advancedOptions']>) => {
    setWizardState(prev => ({
      ...prev,
      advancedOptions: { ...prev.advancedOptions, ...options },
    }));
  };

  const launchOperation = async () => {
    setWizardState(prev => ({
      ...prev,
      results: { ...prev.results, status: 'processing', logs: ['Démarrage de l\'opération...'] },
    }));
    // Implementation will be in the step component
  };

  const resetWizard = () => {
    setWizardState(initialState);
  };

  return (
    <WizardContext.Provider
      value={{
        state: wizardState,
        goToStep,
        updateOperationType,
        updateSource,
        updateConfiguration,
        selectProducts,
        updateAdvancedOptions,
        launchOperation,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within UniversalWizardProvider');
  }
  return context;
};
