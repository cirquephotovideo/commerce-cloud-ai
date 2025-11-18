import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AmazonProductLink {
  id: string;
  analysis_id: string;
  enrichment_id: string;
  link_type: 'automatic' | 'manual';
  confidence_score: number;
  matched_on: string;
  validation_status?: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  product_analyses?: {
    id: string;
    ean: string;
    analysis_result: any;
  };
  code2asin_enrichments?: {
    id: string;
    ean: string;
    asin: string;
    title: string;
    brand: string;
    buybox_price: number;
    image_urls: string[];
  };
}

export function useAmazonProductLinks() {
  const [links, setLinks] = useState<AmazonProductLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('product_amazon_links')
        .select(`
          *,
          product_analyses (
            id,
            ean,
            analysis_result
          ),
          code2asin_enrichments (
            id,
            ean,
            asin,
            title,
            brand,
            buybox_price,
            image_urls
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks((data as any) || []);
      setError(null);
    } catch (err: any) {
      console.error('Error loading Amazon links:', err);
      setError(err.message);
      toast({
        title: "Erreur",
        description: "Impossible de charger les liens Amazon",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createLink = async (
    analysisId: string,
    enrichmentId: string,
    linkType: 'automatic' | 'manual' = 'manual',
    confidenceScore: number = 100
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('product_amazon_links')
        .insert({
          user_id: user.id,
          analysis_id: analysisId,
          enrichment_id: enrichmentId,
          link_type: linkType,
          confidence_score: confidenceScore,
          matched_on: linkType === 'manual' ? 'manual' : 'ean'
        });

      if (error) throw error;

      toast({
        title: "Lien créé",
        description: "Le produit a été lié avec succès aux données Amazon",
      });

      await loadLinks();
    } catch (err: any) {
      console.error('Error creating Amazon link:', err);
      toast({
        title: "Erreur",
        description: "Impossible de créer le lien: " + err.message,
        variant: "destructive",
      });
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('product_amazon_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: "Lien supprimé",
        description: "Le lien Amazon a été supprimé avec succès",
      });

      await loadLinks();
    } catch (err: any) {
      console.error('Error deleting Amazon link:', err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le lien: " + err.message,
        variant: "destructive",
      });
    }
  };

  const startAutoLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Count total analyses to process (le filtrage des produits sans nom est fait backend)
      const { count: totalCount } = await supabase
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null);

      // Create job
      const { data: job, error: jobError } = await supabase
        .from('amazon_auto_link_jobs')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_to_process: totalCount || 0
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Start processing
      const { error: invokeError } = await supabase.functions.invoke('process-amazon-auto-link', {
        body: {
          job_id: job.id,
          offset: 0,
          batch_size: 500
        }
      });

      if (invokeError) throw invokeError;

      toast({
        title: "Fusion automatique démarrée",
        description: "La recherche de correspondances Amazon est en cours...",
      });

      return job.id;
    } catch (err: any) {
      console.error('Error starting auto-link:', err);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la fusion: " + err.message,
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  return {
    links,
    isLoading,
    error,
    loadLinks,
    createLink,
    deleteLink,
    startAutoLink
  };
}
