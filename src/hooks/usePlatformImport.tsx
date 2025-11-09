import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePlatformImport = () => {
  const queryClient = useQueryClient();

  const importFromPlatform = useMutation({
    mutationFn: async (platformId: string) => {
      // 1. Récupérer la config de la plateforme
      const { data: config, error: configError } = await supabase
        .from('platform_configurations')
        .select('*')
        .eq('id', platformId)
        .maybeSingle();

      if (configError) {
        console.error('[usePlatformImport] Config fetch error:', configError);
        throw configError;
      }
      if (!config) {
        console.error('[usePlatformImport] No config found for platformId:', platformId);
        throw new Error('Configuration introuvable');
      }

      console.log('[usePlatformImport] Config loaded:', {
        platformId,
        platform_type: config.platform_type,
        platform_url: config.platform_url
      });

      // 2. Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      // 3. Reconstruct credentials from correct columns
      const credentials: Record<string, any> = config.platform_type === 'odoo' 
        ? (typeof config.additional_config === 'object' && config.additional_config !== null 
            ? config.additional_config as Record<string, any>
            : {})
        : {
            apiKey: config.api_key_encrypted,
            apiSecret: config.api_secret_encrypted,
            accessToken: config.access_token_encrypted
          };

      // 4. Créer ou récupérer le supplier_configuration correspondant
      const platformType = config.platform_type === 'odoo' || config.platform_type === 'prestashop' 
        ? config.platform_type 
        : 'api';
      
      const { data: existingSupplier } = await supabase
        .from('supplier_configurations')
        .select('id')
        .eq('user_id', user.id)
        .eq('supplier_name', `Import ${config.platform_type}`)
        .single();

      let supplierId: string;

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const { data: newSupplier, error: supplierError } = await supabase
          .from('supplier_configurations')
          .insert([{
            user_id: user.id,
            supplier_name: `Import ${config.platform_type}`,
            supplier_type: platformType,
            is_active: true,
          }])
          .select()
          .single();

        if (supplierError) throw supplierError;
        supplierId = newSupplier.id;
      }

      // 5. Appeler l'orchestrateur d'import pour créer un job trackable
      const platformConfig = config.platform_type === 'odoo' 
        ? {
            platform_url: config.platform_url,
            additional_config: credentials
          }
        : {
            url: config.platform_url,
            ...credentials
          };
      
      const { data, error } = await supabase.functions.invoke('orchestrate-platform-import', {
        body: {
          supplier_id: supplierId,
          platform: config.platform_type,
          options: {
            config: platformConfig,
            importType: 'full',
            autoEnrich: false,
            matchByEan: true,
          },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const totalProducts = data?.total_products || 0;
      const estimatedChunks = data?.estimated_chunks || 0;
      
      toast.success(
        `Import démarré • ${totalProducts} produits à traiter en ${estimatedChunks} lots`,
        { duration: 5000 }
      );
      
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
    onError: (error: any) => {
      console.error('[usePlatformImport] Error:', error);
      
      let errorMessage = "Une erreur s'est produite lors de l'import";
      let errorTitle = "Erreur d'import";
      let duration = 5000;
      
      // Handle Supabase client errors
      if (error?.message?.includes('Cannot coerce')) {
        errorTitle = "Configuration introuvable";
        errorMessage = "La plateforme sélectionnée n'a pas pu être trouvée. Veuillez rafraîchir la page.";
        duration = 8000;
      }
      // Handle missing configuration
      else if (error?.message === 'Configuration introuvable') {
        errorTitle = "Configuration introuvable";
        errorMessage = "Cette plateforme n'est pas configurée. Veuillez la configurer dans les paramètres.";
        duration = 8000;
      }
      // Try to extract structured error from edge functions
      else if (error?.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.user_message || parsed.error) {
            errorMessage = parsed.user_message || parsed.error;
          }
          if (parsed.requires_configuration) {
            errorTitle = "⚙️ Configuration requise";
            errorMessage += "\n\nRendez-vous dans les paramètres du fournisseur pour configurer la plateforme.";
            duration = 10000;
          }
          if (parsed.error_code) {
            console.error('[usePlatformImport] Error code:', parsed.error_code);
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        description: errorTitle !== "Erreur d'import" ? undefined : "Veuillez réessayer",
        duration,
      });
    },
  });

  return { importFromPlatform };
};
