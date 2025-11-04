import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichmentOptions {
  includeCategories: boolean;
  includeImages: boolean;
  includeShopping: boolean;
  includeAdvanced: boolean;
  includeOdoo: boolean;
  includeVideo: boolean;
}

interface EnrichmentResults {
  categories: any;
  images: any;
  shopping: any;
  advanced: any;
  odoo: any;
  video: any;
}

export const useEnrichmentPipeline = () => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  const runFullPipeline = async (
    analysisId: string,
    productData: any,
    options: EnrichmentOptions
  ): Promise<EnrichmentResults> => {
    const results: EnrichmentResults = {
      categories: null,
      images: null,
      shopping: null,
      advanced: null,
      odoo: null,
      video: null
    };

    setIsEnriching(true);

    try {
      // 1. Catégorisation
      if (options.includeCategories) {
        setCurrentStep('🏷️ Catégorisation...');
        try {
          const { data, error } = await supabase.functions.invoke('ai-taxonomy-categorizer', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title,
              description: productData.description
            }
          });
          if (error) {
            console.error('Catégorisation error:', error);
            results.categories = { 
              success: false, 
              message: error.message || 'Erreur de catégorisation',
              code: error.code 
            };
          } else if (data) {
            results.categories = { ...data, success: true };
          }
        } catch (error) {
          console.error('Catégorisation exception:', error);
          results.categories = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 2. Images
      if (options.includeImages) {
        setCurrentStep('🖼️ Recherche d\'images...');
        try {
          const { data, error } = await supabase.functions.invoke('search-product-images', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title
            }
          });
          if (error) {
            console.error('Images error:', error);
            results.images = { 
              success: false, 
              message: error.message || 'Erreur de recherche d\'images' 
            };
          } else if (data) {
            results.images = { ...data, success: true };
          }
        } catch (error) {
          console.error('Images exception:', error);
          results.images = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 3. Google Shopping
      if (options.includeShopping) {
        setCurrentStep('🛒 Google Shopping...');
        try {
          const { data, error } = await supabase.functions.invoke('google-shopping-search', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title,
              ean: productData.ean
            }
          });
          if (error) {
            console.error('Google Shopping error:', error);
            results.shopping = { 
              success: false, 
              message: error.message || 'Erreur Google Shopping' 
            };
          } else if (data) {
            results.shopping = { ...data, success: true };
          }
        } catch (error) {
          console.error('Google Shopping exception:', error);
          results.shopping = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 4. Enrichissements avancés
      if (options.includeAdvanced) {
        setCurrentStep('✨ Enrichissements avancés...');
        try {
          const { data, error } = await supabase.functions.invoke('enrich-all', {
            body: { 
              analysisId,
              productData,
              purchasePrice: productData.purchase_price
            }
          });
          if (error) {
            console.error('Advanced enrichment error:', error);
            results.advanced = { 
              success: false, 
              message: error.message || 'Erreur enrichissements avancés' 
            };
          } else if (data) {
            results.advanced = { ...data, success: true };
          }
        } catch (error) {
          console.error('Advanced enrichment exception:', error);
          results.advanced = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 5. Attributs Odoo
      if (options.includeOdoo) {
        setCurrentStep('📋 Attributs Odoo...');
        try {
          const { data, error } = await supabase.functions.invoke('enrich-odoo-attributes', {
            body: { 
              analysisId,
              provider: 'lovable',
              webSearchEnabled: true
            }
          });
          if (error) {
            console.error('Odoo attributes error:', error);
            results.odoo = { 
              success: false, 
              message: error.message || 'Erreur attributs Odoo' 
            };
          } else if (data) {
            results.odoo = { ...data, success: true };
          }
        } catch (error) {
          console.error('Odoo attributes exception:', error);
          results.odoo = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 6. Vidéo (optionnel)
      if (options.includeVideo) {
        setCurrentStep('🎥 Génération vidéo...');
        try {
          const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
            body: { 
              action: 'generate',
              analysis_id: analysisId
            }
          });
          if (error) {
            console.error('Video generation error:', error);
            results.video = { 
              success: false, 
              message: error.message || 'Erreur génération vidéo' 
            };
          } else if (data) {
            results.video = { ...data, success: true };
          }
        } catch (error) {
          console.error('Video generation exception:', error);
          results.video = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      setCurrentStep('✅ Enrichissement terminé');
      return results;

    } catch (error) {
      console.error('Pipeline error:', error);
      toast.error('Erreur lors de l\'enrichissement');
      throw error;
    } finally {
      setIsEnriching(false);
      setCurrentStep('');
    }
  };

  return { 
    runFullPipeline, 
    isEnriching, 
    currentStep 
  };
};
