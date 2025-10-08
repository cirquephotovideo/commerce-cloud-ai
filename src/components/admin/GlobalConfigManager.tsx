import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const GlobalConfigManager = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportAllSettings = async () => {
    setExporting(true);
    try {
      console.log('[GlobalConfig] Starting export...');
      
      const { data: prompts } = await supabase.from('ai_prompts').select('*');
      const { data: providers } = await supabase.from('ai_provider_configs').select('*');
      const { data: userPrefs } = await supabase.from('user_provider_preferences').select('*');
      const { data: ollama } = await supabase.from('ollama_configurations').select('*');
      const { data: platforms } = await supabase.from('platform_configurations').select('*');
      const { data: platformMappings } = await supabase.from('platform_field_mappings').select('*');
      const { data: platformPricing } = await supabase.from('platform_pricing_rules').select('*');
      const { data: odoo } = await supabase.from('odoo_configurations').select('*');
      const { data: odooMappings } = await supabase.from('odoo_field_mappings').select('*');

      const fullConfig = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        prompts: prompts || [],
        providers: providers || [],
        user_preferences: userPrefs || [],
        ollama: ollama || [],
        platforms: platforms || [],
        platform_mappings: platformMappings || [],
        platform_pricing: platformPricing || [],
        odoo: odoo || [],
        odoo_mappings: odooMappings || [],
      };

      console.log('[GlobalConfig] Config prepared:', fullConfig);

      const dataStr = JSON.stringify(fullConfig, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `global-config-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      toast.success('Configuration globale exportée avec succès !');
    } catch (error: any) {
      console.error('[GlobalConfig] Export error:', error);
      toast.error(`Erreur d'export: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const importAllSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      console.log('[GlobalConfig] Starting import...');
      
      const text = await file.text();
      const config = JSON.parse(text);

      console.log('[GlobalConfig] Config loaded:', config);

      // Validate version
      if (config.version !== '1.0') {
        throw new Error('Version de configuration incompatible');
      }

      let importCount = 0;

      // Import AI prompts
      if (config.prompts && Array.isArray(config.prompts)) {
        for (const prompt of config.prompts) {
          const { error } = await supabase.from('ai_prompts').upsert(prompt);
          if (!error) importCount++;
        }
      }

      // Import AI providers
      if (config.providers && Array.isArray(config.providers)) {
        for (const provider of config.providers) {
          const { error } = await supabase.from('ai_provider_configs').upsert(provider);
          if (!error) importCount++;
        }
      }

      // Import user preferences
      if (config.user_preferences && Array.isArray(config.user_preferences)) {
        for (const pref of config.user_preferences) {
          const { error } = await supabase.from('user_provider_preferences').upsert(pref);
          if (!error) importCount++;
        }
      }

      // Import Ollama configs
      if (config.ollama && Array.isArray(config.ollama)) {
        for (const item of config.ollama) {
          const { error } = await supabase.from('ollama_configurations').upsert(item);
          if (!error) importCount++;
        }
      }

      // Import platform configs
      if (config.platforms && Array.isArray(config.platforms)) {
        for (const platform of config.platforms) {
          const { error } = await supabase.from('platform_configurations').upsert(platform);
          if (!error) importCount++;
        }
      }

      // Import platform mappings
      if (config.platform_mappings && Array.isArray(config.platform_mappings)) {
        for (const mapping of config.platform_mappings) {
          const { error } = await supabase.from('platform_field_mappings').upsert(mapping);
          if (!error) importCount++;
        }
      }

      // Import platform pricing
      if (config.platform_pricing && Array.isArray(config.platform_pricing)) {
        for (const pricing of config.platform_pricing) {
          const { error } = await supabase.from('platform_pricing_rules').upsert(pricing);
          if (!error) importCount++;
        }
      }

      // Import Odoo configs
      if (config.odoo && Array.isArray(config.odoo)) {
        for (const item of config.odoo) {
          const { error } = await supabase.from('odoo_configurations').upsert(item);
          if (!error) importCount++;
        }
      }

      // Import Odoo mappings
      if (config.odoo_mappings && Array.isArray(config.odoo_mappings)) {
        for (const mapping of config.odoo_mappings) {
          const { error } = await supabase.from('odoo_field_mappings').upsert(mapping);
          if (!error) importCount++;
        }
      }

      console.log('[GlobalConfig] Import completed. Items imported:', importCount);
      toast.success(`Configuration globale importée avec succès ! (${importCount} éléments)`);
    } catch (error: any) {
      console.error('[GlobalConfig] Import error:', error);
      toast.error(`Erreur d'import: ${error.message}`);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Configuration Globale</CardTitle>
        </div>
        <CardDescription>
          Exportez ou importez toute votre configuration en un seul fichier JSON
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Contenu inclus :</p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Prompts IA et configurations</li>
            <li>Configurations des fournisseurs IA</li>
            <li>Préférences utilisateur</li>
            <li>Configurations Ollama</li>
            <li>Paramètres des plateformes (Shopify, WooCommerce, etc.)</li>
            <li>Mappings de champs et règles de pricing</li>
            <li>Configurations Odoo</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={exportAllSettings} 
            disabled={exporting}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Export en cours...' : 'Exporter tout'}
          </Button>

          <Button 
            variant="outline"
            disabled={importing}
            className="flex-1"
            asChild
          >
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Import en cours...' : 'Importer tout'}
              <input
                type="file"
                accept=".json"
                onChange={importAllSettings}
                className="hidden"
              />
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
