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
      
      // AI & Providers
      const { data: prompts } = await supabase.from('ai_prompts').select('*');
      const { data: providers } = await supabase.from('ai_provider_configs').select('*');
      const { data: userPrefs } = await supabase.from('user_provider_preferences').select('*');
      const { data: ollama } = await supabase.from('ollama_configurations').select('*');
      
      // E-commerce Platforms
      const { data: platforms } = await supabase.from('platform_configurations').select('*');
      const { data: platformMappings } = await supabase.from('platform_field_mappings').select('*');
      const { data: platformPricing } = await supabase.from('platform_pricing_rules').select('*');
      const { data: platformCategories } = await supabase.from('platform_categories').select('*');
      const { data: odoo } = await supabase.from('odoo_configurations').select('*');
      const { data: odooMappings } = await supabase.from('odoo_field_mappings').select('*');
      
      // Marketing & Social Media
      const { data: emailCampaigns } = await supabase.from('email_campaigns').select('*');
      const { data: emailTemplates } = await supabase.from('email_templates').select('*');
      const { data: newsletters } = await supabase.from('newsletter_subscribers').select('*');
      
      // Market Intelligence
      const { data: competitorSites } = await supabase.from('competitor_sites').select('*');
      const { data: priceMonitoring } = await supabase.from('price_monitoring').select('*');
      const { data: priceHistory } = await supabase.from('price_history').select('*');
      const { data: marketTrends } = await supabase.from('market_trends').select('*');
      
      // Filter sensitive data
      const safePlatforms = platforms?.map(p => ({
        ...p,
        api_key_encrypted: '[REDACTED]',
        api_secret_encrypted: '[REDACTED]',
        access_token_encrypted: '[REDACTED]',
      }));
      
      const safeOdoo = odoo?.map(o => ({
        ...o,
        password_encrypted: '[REDACTED]',
      }));
      
      const safeNewsletters = newsletters?.map(n => ({
        ...n,
        email: n.status === 'active' ? n.email : '[REDACTED]',
      }));

      const fullConfig = {
        version: '2.0',
        exported_at: new Date().toISOString(),
        
        // AI & Providers
        prompts: prompts || [],
        providers: providers || [],
        user_preferences: userPrefs || [],
        ollama: ollama || [],
        
        // E-commerce Platforms
        platforms: safePlatforms || [],
        platform_mappings: platformMappings || [],
        platform_pricing: platformPricing || [],
        platform_categories: platformCategories || [],
        odoo: safeOdoo || [],
        odoo_mappings: odooMappings || [],
        
        // Marketing & Social Media
        email_campaigns: emailCampaigns || [],
        email_templates: emailTemplates || [],
        newsletter_subscribers: safeNewsletters || [],
        
        // Market Intelligence
        competitor_sites: competitorSites || [],
        price_monitoring: priceMonitoring || [],
        price_history: priceHistory || [],
        market_trends: marketTrends || [],
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
      if (!['1.0', '2.0'].includes(config.version)) {
        throw new Error(`Version de configuration incompatible: ${config.version}`);
      }
      
      const isLegacyVersion = config.version === '1.0';
      if (isLegacyVersion) {
        toast.info('Configuration v1.0 détectée. Import des données disponibles...');
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

      // Import Platform Categories (Google Shopping, etc.)
      if (config.platform_categories && Array.isArray(config.platform_categories)) {
        for (const category of config.platform_categories) {
          const { error } = await supabase.from('platform_categories').upsert(category);
          if (!error) importCount++;
        }
      }
      
      // Import Email Campaigns
      if (config.email_campaigns && Array.isArray(config.email_campaigns)) {
        for (const campaign of config.email_campaigns) {
          const { error } = await supabase.from('email_campaigns').upsert(campaign);
          if (!error) importCount++;
        }
      }
      
      // Import Email Templates
      if (config.email_templates && Array.isArray(config.email_templates)) {
        for (const template of config.email_templates) {
          const { error } = await supabase.from('email_templates').upsert(template);
          if (!error) importCount++;
        }
      }
      
      // Import Newsletter Subscribers
      if (config.newsletter_subscribers && Array.isArray(config.newsletter_subscribers)) {
        for (const subscriber of config.newsletter_subscribers) {
          const { error } = await supabase.from('newsletter_subscribers').upsert(subscriber);
          if (!error) importCount++;
        }
      }
      
      // Import Competitor Sites
      if (config.competitor_sites && Array.isArray(config.competitor_sites)) {
        for (const site of config.competitor_sites) {
          const { error } = await supabase.from('competitor_sites').upsert(site);
          if (!error) importCount++;
        }
      }
      
      // Import Price Monitoring
      if (config.price_monitoring && Array.isArray(config.price_monitoring)) {
        for (const monitoring of config.price_monitoring) {
          const { error } = await supabase.from('price_monitoring').upsert(monitoring);
          if (!error) importCount++;
        }
      }
      
      // Import Price History
      if (config.price_history && Array.isArray(config.price_history)) {
        for (const history of config.price_history) {
          const { error } = await supabase.from('price_history').upsert(history);
          if (!error) importCount++;
        }
      }
      
      // Import Market Trends
      if (config.market_trends && Array.isArray(config.market_trends)) {
        for (const trend of config.market_trends) {
          const { error } = await supabase.from('market_trends').upsert(trend);
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
            <li>Prompts IA et configurations des fournisseurs</li>
            <li>Préférences utilisateur et Ollama</li>
            
            <li className="font-semibold text-foreground mt-2">Plateformes E-commerce</li>
            <li>Configurations Shopify, WooCommerce, Odoo, etc.</li>
            <li>Mappings de champs et règles de pricing</li>
            <li>Catégories Google Shopping & Merchant Center</li>
            
            <li className="font-semibold text-foreground mt-2">Marketing & Communication</li>
            <li>Campagnes email et templates</li>
            <li>Abonnés newsletter</li>
            
            <li className="font-semibold text-foreground mt-2">Market Intelligence</li>
            <li>Sites concurrents surveillés</li>
            <li>Historique de surveillance des prix</li>
            <li>Tendances marché détectées</li>
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
