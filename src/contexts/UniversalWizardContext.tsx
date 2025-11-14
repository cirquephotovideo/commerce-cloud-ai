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
    importStats?: {
      found?: number;
      imported?: number;
      matched?: number;
      errors?: number;
      supplierId?: string;
    };
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

      if (wizardState.operationType !== 'import') {
        addLog('❌ Type d\'opération non encore implémenté');
        setStatus('error');
        return;
      }

      // Router vers la bonne logique d'import selon la source
      switch (wizardState.source?.type) {
        case 'file':
          await handleFileImport(addLog, setStatus);
          break;
        case 'ftp':
        case 'sftp':
          await handleFtpImport(addLog, setStatus);
          break;
        case 'email':
          await handleEmailImport(addLog, setStatus);
          break;
        case 'api':
          await handleApiImport(addLog, setStatus);
          break;
        default:
          addLog('❌ Type de source non reconnu');
          setStatus('error');
          return;
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

  const handleFileImport = async (
    addLog: (msg: string) => void,
    setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void
  ) => {
    const { supplierId } = wizardState.source;
    const { filePath, fileType, columnMapping, skipRows = 0, delimiter } = wizardState.configuration;

    if (!supplierId || !filePath || !fileType) {
      addLog('❌ Configuration fichier incomplète');
      setStatus('error');
      return;
    }

    addLog(`📁 Fichier détecté: ${filePath}`);
    const functionName = fileType === 'xlsx' ? 'supplier-import-xlsx' : 'supplier-import-csv';
    addLog(`🚀 Appel de la fonction: ${functionName}…`);

    const body: any = { supplierId, filePath, columnMapping: columnMapping || {}, skipRows };
    if (fileType === 'csv' && delimiter) body.delimiter = delimiter;

    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error || data?.error) {
      addLog(`❌ Erreur: ${error?.message || data?.error}`);
      setStatus('error');
      return;
    }

    addLog(`✅ Import terminé avec succès`);
    if (data?.processed) addLog(`📊 ${data.processed} produits traités`);
    if (data?.created) addLog(`➕ ${data.created} créés`);
    if (data?.updated) addLog(`🔄 ${data.updated} mis à jour`);
  };

  const handleFtpImport = async (
    addLog: (msg: string) => void,
    setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void
  ) => {
    const { supplierId } = wizardState.source;
    const config = wizardState.configuration;

    if (!supplierId || !config.host || !config.username) {
      addLog('❌ Configuration FTP incomplète');
      setStatus('error');
      return;
    }

    addLog(`🖥️ Connexion FTP à ${config.host}...`);
    
    const { data, error } = await supabase.functions.invoke('supplier-sync-ftp', {
      body: {
        supplierId,
        host: config.host,
        port: config.port || 21,
        username: config.username,
        password: config.password,
        secure: config.secure || false,
        remoteFilePath: config.filePath || config.remote_path
      }
    });

    if (error || data?.error) {
      addLog(`❌ Erreur FTP: ${error?.message || data?.error}`);
      setStatus('error');
      return;
    }

    addLog(`✅ Import FTP terminé`);
    if (data?.found) addLog(`📦 ${data.found} produits trouvés dans le fichier`);
    if (data?.imported) addLog(`➕ ${data.imported} nouveaux produits créés`);
    if (data?.matched) addLog(`🔄 ${data.matched} produits existants mis à jour`);
    if (data?.errors > 0) addLog(`⚠️ ${data.errors} erreurs rencontrées`);
    
    setWizardState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        importStats: {
          found: data?.found,
          imported: data?.imported,
          matched: data?.matched,
          errors: data?.errors,
          supplierId
        }
      }
    }));
  };

  const handleEmailImport = async (
    addLog: (msg: string) => void,
    setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void
  ) => {
    const { supplierId } = wizardState.source;

    if (!supplierId) {
      addLog('❌ ID fournisseur manquant');
      setStatus('error');
      return;
    }

    addLog(`📧 Traitement des emails...`);
    
    const { data, error } = await supabase.functions.invoke('batch-process-emails', {
      body: { supplier_id: supplierId, maxConcurrent: 5 }
    });

    if (error || data?.error) {
      addLog(`❌ Erreur Email: ${error?.message || data?.error}`);
      setStatus('error');
      return;
    }

    addLog(`✅ Emails traités`);
    if (data?.found) addLog(`📦 ${data.found} emails trouvés`);
    if (data?.processed) addLog(`📊 ${data.processed} emails traités`);
    if (data?.successful) addLog(`➕ ${data.successful} produits importés`);
    if (data?.errors > 0) addLog(`⚠️ ${data.errors} erreurs rencontrées`);
    
    setWizardState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        importStats: {
          found: data?.found,
          imported: data?.successful,
          matched: data?.matched,
          errors: data?.errors,
          supplierId
        }
      }
    }));
  };

  const handleApiImport = async (
    addLog: (msg: string) => void,
    setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void
  ) => {
    const { supplierId } = wizardState.source;
    const config = wizardState.configuration;

    if (!supplierId || !config.api_url) {
      addLog('❌ Configuration API incomplète');
      setStatus('error');
      return;
    }

    addLog(`🔗 Appel API ${config.api_url}...`);
    
    const { data, error } = await supabase.functions.invoke('supplier-sync-api', {
      body: {
        supplierId,
        apiEndpoint: config.api_url,
        apiKey: config.api_key,
        method: config.method || 'GET',
        headers: config.headers || {}
      }
    });

    if (error || data?.error) {
      addLog(`❌ Erreur API: ${error?.message || data?.error}`);
      setStatus('error');
      return;
    }

    addLog(`✅ Import API terminé`);
    if (data?.found) addLog(`📦 ${data.found} produits trouvés`);
    if (data?.imported) addLog(`➕ ${data.imported} nouveaux produits créés`);
    if (data?.matched) addLog(`🔄 ${data.matched} produits existants mis à jour`);
    if (data?.errors > 0) addLog(`⚠️ ${data.errors} erreurs rencontrées`);
    
    setWizardState(prev => ({
      ...prev,
      results: {
        ...prev.results,
        importStats: {
          found: data?.found,
          imported: data?.imported,
          matched: data?.matched,
          errors: data?.errors,
          supplierId
        }
      }
    }));
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
