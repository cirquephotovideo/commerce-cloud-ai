import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEnrichmentProgress } from './useEnrichmentProgress';

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

// Helper pour ajouter un timeout aux appels Supabase
const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number = 28000,
  stepName: string = 'Operation'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${timeoutMs / 1000}s pour ${stepName}`)), timeoutMs)
    ),
  ]);
};

export const useEnrichmentPipeline = () => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const { progress, initializeSteps, updateStep, completeEnrichment } = useEnrichmentProgress();

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

    // Initialize progress steps
    const enabledOptions = Object.entries(options)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key.replace('include', '').toLowerCase());
    
    initializeSteps(enabledOptions);

    console.log('[useEnrichmentPipeline] 🚀 Starting unified pipeline with options:', options);

    try {
      // Helper pour appeler unified-lovable-enrichment avec timeout et gestion d'erreur
      const callUnifiedEnrichment = async (
        enrichmentType: string,
        stepId: string,
        stepLabel: string
      ) => {
        updateStep(stepId, { status: 'processing', startTime: Date.now() });
        setCurrentStep(stepLabel);
        
        try {
          console.log(`[useEnrichmentPipeline] ⚡ Calling unified-lovable-enrichment: ${enrichmentType}`);
          
          const enrichmentPromise = supabase.functions.invoke('unified-lovable-enrichment', {
            body: { 
              analysisId,
              enrichment_type: enrichmentType,
              productData: {
                product_name: productData.product_name || productData.title || 'Produit',
                ean: productData.ean,
                description: productData.description,
                purchase_price: productData.purchase_price
              },
              purchasePrice: productData.purchase_price
            }
          });

          const { data, error } = await withTimeout(enrichmentPromise, 28000, enrichmentType);
          
          if (error) {
            console.error(`[useEnrichmentPipeline] ❌ ${enrichmentType} error:`, error);
            updateStep(stepId, { 
              status: 'failed', 
              endTime: Date.now(), 
              details: error.message || 'Erreur inconnue' 
            });
            return { success: false, message: error.message || 'Erreur' };
          }
          
          if (data) {
            console.log(`[useEnrichmentPipeline] ✅ ${enrichmentType} completed:`, data);
            updateStep(stepId, { status: 'completed', endTime: Date.now() });
            return { ...data, success: true };
          }
          
          throw new Error('Pas de données reçues');
          
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue';
          console.error(`[useEnrichmentPipeline] ❌ ${enrichmentType} exception:`, message);
          updateStep(stepId, { 
            status: 'failed', 
            endTime: Date.now(), 
            details: message 
          });
          return { success: false, message };
        }
      };

      // 1. Categories (optionnel, rapide avec timeout court)
      if (options.includeCategories) {
        updateStep('categories', { status: 'processing', startTime: Date.now() });
        setCurrentStep('🏷️ Catégorisation...');
        try {
          const categoriesPromise = supabase.functions.invoke('ai-taxonomy-categorizer', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title,
              description: productData.description
            }
          });
          const { data, error } = await withTimeout(categoriesPromise, 20000, 'categories');
          
          if (error) {
            console.warn('[useEnrichmentPipeline] ⚠️ Categories failed (optional):', error.message);
            updateStep('categories', { status: 'failed', endTime: Date.now(), details: 'Timeout' });
            results.categories = { success: false, message: 'Timeout' };
          } else {
            updateStep('categories', { status: 'completed', endTime: Date.now() });
            results.categories = { ...data, success: true };
          }
        } catch (error) {
          console.warn('[useEnrichmentPipeline] ⚠️ Categories skipped:', error);
          updateStep('categories', { status: 'failed', endTime: Date.now() });
          results.categories = { success: false, message: 'Skipped' };
        }
      }

      // 2. Images officielles via unified-lovable-enrichment
      if (options.includeImages) {
        results.images = await callUnifiedEnrichment('images', 'images', '🖼️ Images officielles...');
      }

      // 3. Shopping (intégré dans cost_analysis)
      if (options.includeShopping) {
        updateStep('shopping', { status: 'completed', endTime: Date.now() });
        results.shopping = { success: true, message: 'Intégré dans analyse coûts' };
      }

      // 4. Advanced = description + specifications + cost_analysis + rsgp
      if (options.includeAdvanced) {
        // Description longue
        const descResult = await callUnifiedEnrichment(
          'description', 
          'advanced', 
          '📝 Description longue...'
        );
        
        // Spécifications techniques
        const specsResult = await callUnifiedEnrichment(
          'specifications',
          'advanced',
          '🔧 Spécifications...'
        );
        
        // Analyse coûts et prix
        const costResult = await callUnifiedEnrichment(
          'cost_analysis',
          'advanced',
          '💰 Analyse coûts...'
        );
        
        // RSGP + Réparabilité + Environnement + HS Code
        const rsgpResult = await callUnifiedEnrichment(
          'rsgp',
          'advanced',
          '♻️ RSGP & Impact...'
        );

        // Fusionner les résultats
        results.advanced = {
          success: true,
          description: descResult,
          specifications: specsResult,
          cost_analysis: costResult,
          rsgp: rsgpResult
        };
      }

      // 5. Odoo (optionnel, peut être skippé si trop long)
      if (options.includeOdoo) {
        updateStep('odoo', { status: 'processing', startTime: Date.now() });
        setCurrentStep('📊 Attributs Odoo...');
        try {
          const odooPromise = supabase.functions.invoke('fetch-odoo-attributes', {
            body: { 
              analysisId,
              productData: {
                name: productData.product_name || productData.title,
                category: productData.category
              }
            }
          });
          const { data, error } = await withTimeout(odooPromise, 15000, 'odoo');
          
          if (error) {
            console.warn('[useEnrichmentPipeline] ⚠️ Odoo skipped:', error.message);
            updateStep('odoo', { status: 'failed', endTime: Date.now() });
            results.odoo = { success: false, message: 'Skipped' };
          } else {
            updateStep('odoo', { status: 'completed', endTime: Date.now() });
            results.odoo = { ...data, success: true };
          }
        } catch (error) {
          console.warn('[useEnrichmentPipeline] ⚠️ Odoo error:', error);
          updateStep('odoo', { status: 'failed', endTime: Date.now() });
          results.odoo = { success: false };
        }
      }

      // 6. Video (optionnel, lancé en background)
      if (options.includeVideo) {
        updateStep('video', { status: 'processing', startTime: Date.now() });
        setCurrentStep('🎥 Vidéo (background)...');
        // On lance mais on n'attend pas
        supabase.functions.invoke('generate-product-video', {
          body: { 
            analysisId,
            productData: {
              name: productData.product_name || productData.title,
              description: productData.description
            }
          }
        }).then(({ data, error }) => {
          if (error) {
            console.warn('[useEnrichmentPipeline] ⚠️ Video failed:', error.message);
          } else {
            console.log('[useEnrichmentPipeline] ✅ Video started in background');
          }
        });
        // Marquer comme completed immédiatement
        updateStep('video', { status: 'completed', endTime: Date.now() });
        results.video = { success: true, message: 'Lancée en arrière-plan' };
      }

      console.log('[useEnrichmentPipeline] ✅ Pipeline completed. Results:', results);

    } catch (error) {
      console.error('[useEnrichmentPipeline] ❌ Critical pipeline error:', error);
      toast.error('Erreur critique dans le pipeline d\'enrichissement');
    } finally {
      completeEnrichment();
      setIsEnriching(false);
      setCurrentStep('');
    }

    return results;
  };

  return {
    runFullPipeline,
    isEnriching,
    currentStep,
    progress
  };
};
