import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    aiProvider: 'lovable-ai' | 'ollama' | 'openai' | 'anthropic' | 'ollama_cloud';
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
    const addLog = (message: string) => {
      setWizardState(prev => ({
        ...prev,
        results: { ...prev.results, logs: [...prev.results.logs, message] }
      }));
    };

    const setStatus = (status: 'idle' | 'processing' | 'completed' | 'error') => {
      setWizardState(prev => ({
        ...prev,
        results: { ...prev.results, status }
      }));
    };

    setWizardState(prev => ({
      ...prev,
      results: { ...prev.results, status: 'processing', logs: ['Démarrage de l\'opération...'] },
    }));

    try {
      addLog('Validation de la configuration…');

      // Pour l'instant, seul Import Fichier est implémenté
      if (wizardState.operationType !== 'import') {
        addLog('❌ Type d\'opération non encore implémenté');
        setStatus('error');
        return;
      }

      if (wizardState.source?.type !== 'file') {
        addLog('❌ Source non encore implémentée (seul fichier est supporté pour l\'instant)');
        setStatus('error');
        return;
      }

      // Validation des données requises
      const { supplierId } = wizardState.source;
      const { filePath, fileType, columnMapping, skipRows = 0, delimiter } = wizardState.configuration;

      if (!supplierId) {
        addLog('❌ Fournisseur manquant');
        setStatus('error');
        return;
      }

      if (!filePath) {
        addLog('❌ Fichier non uploadé');
        setStatus('error');
        return;
      }

      if (!fileType) {
        addLog('❌ Type de fichier manquant');
        setStatus('error');
        return;
      }

      addLog(`📁 Fichier détecté: ${filePath}`);
      
      // Déterminer la fonction edge à appeler
      const functionName = fileType === 'xlsx' ? 'supplier-import-xlsx' : 'supplier-import-csv';
      addLog(`🚀 Appel de la fonction d'import: ${functionName}…`);

      // Construire le body
      const body: any = {
        supplierId,
        filePath,
        columnMapping: columnMapping || {},
        skipRows
      };

      if (fileType === 'csv' && delimiter) {
        body.delimiter = delimiter;
      }

      // Appel de la fonction
      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        addLog(`❌ Erreur: ${error.message}`);
        setStatus('error');
        return;
      }

      if (data?.error) {
        addLog(`❌ Erreur serveur: ${data.error}`);
        setStatus('error');
        return;
      }

      // Succès de l'import
      addLog(`✅ Import terminé avec succès`);
      if (data?.processed) {
        addLog(`📊 ${data.processed} produits traités`);
      }
      if (data?.created) {
        addLog(`➕ ${data.created} nouveaux produits créés`);
      }
      if (data?.updated) {
        addLog(`🔄 ${data.updated} produits mis à jour`);
      }

      // Option: Enchaîner l'enrichissement si demandé
      const { enrichmentTypes = [] } = wizardState.advancedOptions;
      const { selectedProducts = [] } = wizardState;

      if (enrichmentTypes.length > 0 && selectedProducts.length > 0) {
        addLog(`🤖 Démarrage de l'enrichissement pour ${selectedProducts.length} produit(s)…`);

        // Mapper le provider UI vers le provider backend
        const providerMap: Record<string, string> = {
          'lovable-ai': 'lovable',
          'openai': 'openai',
          'anthropic': 'claude',
          'ollama': 'ollama',
          'ollama_cloud': 'ollama'
        };
        const provider = providerMap[wizardState.advancedOptions.aiProvider] || 'lovable';

        // Appeler l'enrichissement pour chaque produit sélectionné
        for (const productId of selectedProducts) {
          try {
            if (enrichmentTypes.includes('odoo_attributes')) {
              await supabase.functions.invoke('enrich-odoo-attributes', {
                body: { analysisId: productId, provider }
              });
            } else {
              await supabase.functions.invoke('re-enrich-product', {
                body: { productId, enrichmentTypes, provider }
              });
            }
          } catch (enrichError) {
            console.error('Enrichment error:', enrichError);
          }
        }

        addLog(`✨ Enrichissement déclenché (en cours en arrière-plan)`);
      }

      setStatus('completed');
    } catch (error: any) {
      addLog(`❌ Erreur: ${error.message || 'Erreur inconnue'}`);
      setStatus('error');
      console.error('Launch operation error:', error);
    }
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
