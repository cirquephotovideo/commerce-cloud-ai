import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { SupplierConnectionConfig } from '@/components/SupplierConnectionConfig';
import { SupplierEmailConfig } from '@/components/SupplierEmailConfig';
import { FileUploadConfig } from '@/components/wizard/config/FileUploadConfig';
import { ExportPlatformConfig } from '@/components/wizard/config/ExportPlatformConfig';
import { EnrichmentProviderConfig } from '@/components/wizard/config/EnrichmentProviderConfig';
import { ProductAnalysisConfig } from '@/components/wizard/config/ProductAnalysisConfig';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Step3Configuration = () => {
  const { goToStep, state, updateConfiguration } = useWizard();

  const validateConfiguration = () => {
    // Import validations
    if (state.operationType === 'import') {
      if (!state.source) {
        toast.error('Aucune source sélectionnée');
        return false;
      }

      const sourceType = state.source.type;
      const config = state.configuration;

      if (sourceType === 'email') {
        if (!config.email_mode || !config.email_settings?.email_address) {
          toast.error('Configuration email incomplète');
          return false;
        }
      } else if (sourceType === 'ftp' || sourceType === 'sftp') {
        if (!config.host || !config.username) {
          toast.error('Configuration FTP/SFTP incomplète');
          return false;
        }
      } else if (sourceType === 'api') {
        if (!config.api_url) {
          toast.error('URL API requise');
          return false;
        }
      } else if (sourceType === 'file') {
        if (!config.fileName) {
          toast.error('Veuillez charger un fichier');
          return false;
        }
      }
    }

    // Export validations
    if (state.operationType === 'export') {
      if (!state.advancedOptions.exportPlatforms.length) {
        toast.error('Aucune plateforme d\'export sélectionnée');
        return false;
      }
      const configs = state.configuration.platformConfigs || {};
      for (const platform of state.advancedOptions.exportPlatforms) {
        if (!configs[platform]?.apiKey && !configs[platform]?.apiUrl) {
          toast.error(`Configuration ${platform} incomplète`);
          return false;
        }
      }
    }

    // Enrichment validations
    if (state.operationType === 'enrichment') {
      const provider = state.advancedOptions.aiProvider;
      if (provider === 'openai' && !state.configuration.aiApiKey) {
        toast.error('Clé API OpenAI requise');
        return false;
      }
      if (provider === 'ollama' && !state.configuration.ollamaUrl) {
        toast.error('URL Ollama requise');
        return false;
      }
      if (provider === 'lovable-ai' && !state.configuration.aiModel) {
        toast.error('Modèle Lovable AI requis');
        return false;
      }
    }

    // Analysis validations
    if (state.operationType === 'analysis') {
      if (!state.configuration.ean && !state.configuration.productUrl) {
        toast.error('EAN ou URL produit requis');
        return false;
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (validateConfiguration()) {
      goToStep(4);
    }
  };

  const renderConfigForm = () => {
    // Import operations
    if (state.operationType === 'import' && state.source) {
      const sourceType = state.source.type;

      if (sourceType === 'email') {
        return (
          <SupplierEmailConfig
            supplierId={state.source.id}
            config={state.configuration}
            onConfigChange={(config) => updateConfiguration(config)}
          />
        );
      }

      if (sourceType === 'ftp' || sourceType === 'sftp') {
        return (
          <SupplierConnectionConfig
            supplierType={sourceType}
            config={state.configuration}
            onConfigChange={(config) => updateConfiguration(config)}
          />
        );
      }

      if (sourceType === 'api') {
        return (
          <SupplierConnectionConfig
            supplierType="api"
            config={state.configuration}
            onConfigChange={(config) => updateConfiguration(config)}
          />
        );
      }

      if (sourceType === 'file') {
        return <FileUploadConfig />;
      }
    }

    // Export operations
    if (state.operationType === 'export') {
      return <ExportPlatformConfig />;
    }

    // Enrichment operations
    if (state.operationType === 'enrichment') {
      return <EnrichmentProviderConfig />;
    }

    // Analysis operations
    if (state.operationType === 'analysis') {
      return <ProductAnalysisConfig />;
    }

    // No operation selected
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Veuillez d'abord sélectionner une opération et une source aux étapes précédentes.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configuration</h2>
        <p className="text-muted-foreground">Paramètres de connexion et configuration</p>
      </div>

      {renderConfigForm()}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(2)}>Précédent</Button>
        <Button onClick={handleContinue}>Continuer</Button>
      </div>
    </div>
  );
};
