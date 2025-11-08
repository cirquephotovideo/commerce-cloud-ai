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
        .single();

      if (configError) throw configError;
      if (!config) throw new Error('Configuration introuvable');

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
      toast.success(
        `Import réussi ! ${data?.imported || 0} produits importés${
          data?.updated ? `, ${data.updated} mis à jour` : ''
        }`,
        { duration: 5000 }
      );
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
    },
    onError: (error: Error) => {
      console.error('Erreur import plateforme:', error);
      toast.error(`Erreur lors de l'import : ${error.message}`);
    },
  });

  return { importFromPlatform };
};
