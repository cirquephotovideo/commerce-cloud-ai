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

    try {
      // Load Ollama preferences at the start
      const { data: { session } } = await supabase.auth.getSession();
      let ollamaPreferences = { preferredModel: 'gpt-oss:20b-cloud', webSearchEnabled: false };
      
      if (session?.user) {
        const { data: ollamaConfig } = await supabase
          .from('ollama_configurations')
          .select('default_model, web_search_enabled')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (ollamaConfig) {
          ollamaPreferences = {
            preferredModel: ollamaConfig.default_model || 'gpt-oss:20b-cloud',
            webSearchEnabled: ollamaConfig.web_search_enabled || false
          };
          console.log('[useEnrichmentPipeline] Loaded Ollama preferences:', ollamaPreferences);
        }
      }
      // 1. Catégorisation
      if (options.includeCategories) {
        updateStep('categories', { status: 'processing', startTime: Date.now() });
        setCurrentStep('🏷️ Catégorisation...');
        try {
          const { data, error } = await supabase.functions.invoke('ai-taxonomy-categorizer', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title,
              description: productData.description,
              preferred_model: ollamaPreferences.preferredModel,
              web_search_enabled: ollamaPreferences.webSearchEnabled
            }
          });
          if (error) {
            console.error('Catégorisation error:', error);
            updateStep('categories', { status: 'failed', endTime: Date.now(), details: error.message });
            results.categories = { 
              success: false, 
              message: error.message || 'Erreur de catégorisation',
              code: error.code 
            };
          } else if (data) {
            updateStep('categories', { status: 'completed', endTime: Date.now() });
            results.categories = { ...data, success: true };
          }
        } catch (error) {
          console.error('Catégorisation exception:', error);
          updateStep('categories', { status: 'failed', endTime: Date.now() });
          results.categories = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 2. Images avec sous-étapes détaillées
      if (options.includeImages) {
        updateStep('images-scraping', { status: 'processing', startTime: Date.now() });
        setCurrentStep('🖼️ Recherche d\'images officielles...');
        
        try {
          const { data, error } = await supabase.functions.invoke('fetch-and-store-official-images', {
            body: { 
              analysisId,
              productName: productData.product_name || productData.title,
              brand: productData.brand,
              productUrl: productData.url,
              ean: productData.ean,
              asin: productData.asin
            }
          });

          if (error) {
            console.error('Images error:', error);
            ['images-scraping', 'images-ollama', 'images-amazon', 'images-google'].forEach(id => {
              updateStep(id, { status: 'failed', endTime: Date.now(), details: error.message });
            });
            results.images = { 
              success: false, 
              message: error.message || 'Erreur de recherche d\'images' 
            };
          } else if (data) {
            // Mettre à jour les étapes en fonction des sources utilisées
            if (data.sources) {
              const scrapingCount = data.sources.filter((s: string) => s === 'direct_scraping').length;
              const ollamaCount = data.sources.filter((s: string) => s === 'ollama_web_search').length;
              const amazonCount = data.sources.filter((s: string) => s === 'amazon').length;
              const googleCount = data.sources.filter((s: string) => s === 'google_shopping').length;
              
              updateStep('images-scraping', { 
                status: scrapingCount > 0 ? 'completed' : 'skipped', 
                endTime: Date.now(), 
                details: scrapingCount > 0 ? `✓ ${scrapingCount} image(s)` : undefined 
              });
              updateStep('images-ollama', { 
                status: ollamaCount > 0 ? 'completed' : 'skipped', 
                endTime: Date.now(), 
                details: ollamaCount > 0 ? `✓ ${ollamaCount} image(s)` : undefined 
              });
              updateStep('images-amazon', { 
                status: amazonCount > 0 ? 'completed' : 'skipped', 
                endTime: Date.now(), 
                details: amazonCount > 0 ? `✓ ${amazonCount} image(s)` : undefined 
              });
              updateStep('images-google', { 
                status: googleCount > 0 ? 'completed' : 'skipped', 
                endTime: Date.now(), 
                details: googleCount > 0 ? `✓ ${googleCount} image(s)` : undefined 
              });
            }

            results.images = { 
              urls: data.images,
              sources: data.sources,
              count: data.count,
              success: true 
            };
          }
        } catch (error) {
          console.error('Images exception:', error);
          ['images-scraping', 'images-ollama', 'images-amazon', 'images-google'].forEach(id => {
            updateStep(id, { status: 'failed', endTime: Date.now() });
          });
          results.images = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 3. Google Shopping
      if (options.includeShopping) {
        updateStep('shopping', { status: 'processing', startTime: Date.now() });
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
            updateStep('shopping', { status: 'failed', endTime: Date.now(), details: error.message });
            results.shopping = { 
              success: false, 
              message: error.message || 'Erreur Google Shopping' 
            };
          } else if (data) {
            updateStep('shopping', { status: 'completed', endTime: Date.now() });
            results.shopping = { ...data, success: true };
          }
        } catch (error) {
          console.error('Google Shopping exception:', error);
          updateStep('shopping', { status: 'failed', endTime: Date.now() });
          results.shopping = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 4. Enrichissements avancés
      if (options.includeAdvanced) {
        updateStep('specifications', { status: 'processing', startTime: Date.now() });
        updateStep('technical', { status: 'processing', startTime: Date.now() });
        updateStep('cost', { status: 'processing', startTime: Date.now() });
        setCurrentStep('✨ Enrichissements avancés...');
        try {
          const { data, error } = await supabase.functions.invoke('enrich-all', {
            body: { 
              analysisId,
              productData,
              purchasePrice: productData.purchase_price,
              preferred_model: ollamaPreferences.preferredModel,
              web_search_enabled: ollamaPreferences.webSearchEnabled
            }
          });
          if (error) {
            console.error('Advanced enrichment error:', error);
            updateStep('specifications', { status: 'failed', endTime: Date.now() });
            updateStep('technical', { status: 'failed', endTime: Date.now() });
            updateStep('cost', { status: 'failed', endTime: Date.now() });
            results.advanced = { 
              success: false, 
              message: error.message || 'Erreur enrichissements avancés' 
            };
          } else if (data) {
            updateStep('specifications', { status: 'completed', endTime: Date.now() });
            updateStep('technical', { status: 'completed', endTime: Date.now() });
            updateStep('cost', { status: 'completed', endTime: Date.now() });
            results.advanced = { ...data, success: true };
          }
        } catch (error) {
          console.error('Advanced enrichment exception:', error);
          updateStep('specifications', { status: 'failed', endTime: Date.now() });
          updateStep('technical', { status: 'failed', endTime: Date.now() });
          updateStep('cost', { status: 'failed', endTime: Date.now() });
          results.advanced = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 5. Attributs Odoo
      if (options.includeOdoo) {
        updateStep('odoo', { status: 'processing', startTime: Date.now() });
        setCurrentStep('📋 Attributs Odoo...');
        try {
          const { data, error } = await supabase.functions.invoke('enrich-odoo-attributes', {
            body: { 
              analysisId,
              provider: 'lovable',
              webSearchEnabled: ollamaPreferences.webSearchEnabled,
              preferred_model: ollamaPreferences.preferredModel
            }
          });
          if (error) {
            console.error('Odoo attributes error:', error);
            updateStep('odoo', { status: 'failed', endTime: Date.now(), details: error.message });
            results.odoo = { 
              success: false, 
              message: error.message || 'Erreur attributs Odoo' 
            };
          } else if (data) {
            updateStep('odoo', { status: 'completed', endTime: Date.now() });
            results.odoo = { ...data, success: true };
          }
        } catch (error) {
          console.error('Odoo attributes exception:', error);
          updateStep('odoo', { status: 'failed', endTime: Date.now() });
          results.odoo = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      // 6. Vidéo (optionnel)
      if (options.includeVideo) {
        updateStep('video', { status: 'processing', startTime: Date.now() });
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
            updateStep('video', { status: 'failed', endTime: Date.now(), details: error.message });
            results.video = { 
              success: false, 
              message: error.message || 'Erreur génération vidéo' 
            };
          } else if (data) {
            updateStep('video', { status: 'completed', endTime: Date.now() });
            results.video = { ...data, success: true };
          }
        } catch (error) {
          console.error('Video generation exception:', error);
          updateStep('video', { status: 'failed', endTime: Date.now() });
          results.video = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inconnue' 
          };
        }
      }

      completeEnrichment();
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
    currentStep,
    progress
  };
};
