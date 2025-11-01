import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ResearchCycle {
  query: string;
  findings: string;
  knowledgeGaps: string[];
  sources: string[];
}

export interface DeepResearchResult {
  cycles: ResearchCycle[];
  finalSynthesis: {
    long_description: string;
    specifications: any;
    cost_analysis: any;
    hs_code: string | null;
    rsgp_compliance: any;
  };
  allSources: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  totalCycles: number;
}

interface UseDeepResearchState {
  isResearching: boolean;
  currentCycle: number;
  maxCycles: number;
  result: DeepResearchResult | null;
}

/**
 * Hook pour effectuer une recherche approfondie itérative inspirée de local-deep-researcher
 * 
 * Ce hook implémente un pattern de recherche en boucle qui:
 * 1. Effectue une recherche web initiale
 * 2. Analyse les résultats et identifie les lacunes
 * 3. Génère de nouvelles requêtes pour combler ces lacunes
 * 4. Répète le processus pour un nombre configurable de cycles
 * 5. Synthétise toutes les découvertes en un enrichissement final
 * 
 * @example
 * ```tsx
 * const { startDeepResearch, state } = useDeepResearch();
 * 
 * await startDeepResearch({
 *   analysisId: 'uuid',
 *   productData: { name: 'Product', brand: 'Brand' },
 *   purchasePrice: 50,
 *   maxCycles: 3
 * });
 * ```
 */
export function useDeepResearch() {
  const [state, setState] = useState<UseDeepResearchState>({
    isResearching: false,
    currentCycle: 0,
    maxCycles: 3,
    result: null
  });

  const startDeepResearch = async ({
    analysisId,
    productData,
    purchasePrice,
    maxCycles = 3,
    silent = false
  }: {
    analysisId: string;
    productData: {
      name: string;
      brand?: string;
      supplier_reference?: string;
      ean?: string;
    };
    purchasePrice?: number;
    maxCycles?: number;
    silent?: boolean;
  }) => {
    setState({
      isResearching: true,
      currentCycle: 0,
      maxCycles,
      result: null
    });

    if (!silent) {
      toast.info(`🔬 Démarrage de la recherche approfondie (${maxCycles} cycles max)...`);
    }

    try {
      const { data, error } = await supabase.functions.invoke('deep-research-enrichment', {
        body: {
          analysisId,
          productData,
          purchasePrice,
          maxCycles
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Deep research failed');
      }

      const result = data.result as DeepResearchResult;

      setState({
        isResearching: false,
        currentCycle: result.totalCycles,
        maxCycles,
        result
      });

      if (!silent) {
        const confidenceEmoji = 
          result.confidenceLevel === 'high' ? '🎯' :
          result.confidenceLevel === 'medium' ? '✅' : '⚠️';
        
        toast.success(
          `${confidenceEmoji} Recherche terminée!\n${result.totalCycles} cycles • ${result.allSources.length} sources • Confiance: ${result.confidenceLevel}`,
          { duration: 5000 }
        );
      }

      return { success: true, result };

    } catch (error: any) {
      console.error('[useDeepResearch] Error:', error);
      
      setState(prev => ({
        ...prev,
        isResearching: false
      }));

      if (!silent) {
        toast.error(`❌ Erreur lors de la recherche approfondie: ${error.message}`);
      }

      return { success: false, error: error.message };
    }
  };

  const reset = () => {
    setState({
      isResearching: false,
      currentCycle: 0,
      maxCycles: 3,
      result: null
    });
  };

  return {
    state,
    startDeepResearch,
    reset,
    isResearching: state.isResearching,
    result: state.result
  };
}
