import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductLink {
  id: string;
  analysis_id: string;
  supplier_product_id: string;
  link_type: 'auto' | 'manual' | 'suggested';
  confidence_score: number;
  created_at: string;
  created_by: string;
  supplier_product?: any;
}

/**
 * Phase C.2: Hook pour gérer les liens produits
 */
export function useProductLinks(analysisId?: string) {
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = async () => {
    if (!analysisId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('product_links')
        .select(`
          *,
          supplier_product:supplier_products(*)
        `)
        .eq('analysis_id', analysisId)
        .order('confidence_score', { ascending: false });

      if (fetchError) throw fetchError;

      setLinks((data || []) as ProductLink[]);
    } catch (err: any) {
      console.error('[useProductLinks] Error loading links:', err);
      setError(err.message);
      toast.error('Erreur lors du chargement des liens produits');
    } finally {
      setIsLoading(false);
    }
  };

  const createLink = async (supplierProductId: string, linkType: 'manual' | 'suggested' = 'manual', confidenceScore: number = 1.0) => {
    if (!analysisId) return null;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('product_links')
        .insert({
          analysis_id: analysisId,
          supplier_product_id: supplierProductId,
          link_type: linkType,
          confidence_score: confidenceScore,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Lien créé avec succès');
      loadLinks();
      return data;
    } catch (err: any) {
      console.error('[useProductLinks] Error creating link:', err);
      toast.error('Erreur lors de la création du lien');
      return null;
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('product_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast.success('Lien supprimé');
      loadLinks();
    } catch (err: any) {
      console.error('[useProductLinks] Error deleting link:', err);
      toast.error('Erreur lors de la suppression du lien');
    }
  };

  const autoLink = async () => {
    if (!analysisId) return null;
    
    try {
      toast.info('Recherche de correspondances...');
      
      const { data, error } = await supabase.functions.invoke('auto-link-products', {
        body: { 
          analysis_id: analysisId,
          auto_mode: true 
        }
      });

      if (error) throw error;

      if (data.links_created > 0) {
        toast.success(`${data.links_created} lien(s) créé(s) automatiquement`);
        loadLinks();
      } else if (data.matches && data.matches.length > 0) {
        toast.info(`${data.matches.length} correspondance(s) trouvée(s), mais aucun lien auto (score < 95)`);
      } else {
        toast.warning('Aucune correspondance trouvée');
      }

      return data;
    } catch (err: any) {
      console.error('[useProductLinks] Error auto-linking:', err);
      
      if (err.status === 401) {
        toast.error('Session expirée, veuillez vous reconnecter');
      } else {
        toast.error('Erreur lors de l\'auto-linking');
      }
      return null;
    }
  };

  useEffect(() => {
    if (analysisId) {
      loadLinks();
    }
  }, [analysisId]);

  return {
    links,
    isLoading,
    error,
    loadLinks,
    createLink,
    deleteLink,
    autoLink
  };
}