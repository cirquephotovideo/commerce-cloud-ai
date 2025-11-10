import { useState, useCallback } from 'react';

export interface EnrichmentStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  details?: string;
  progress?: number;
}

export interface EnrichmentProgress {
  overall: number;
  steps: EnrichmentStep[];
  currentStep: string | null;
  isEnriching: boolean;
}

export const useEnrichmentProgress = () => {
  const [progress, setProgress] = useState<EnrichmentProgress>({
    overall: 0,
    steps: [],
    currentStep: null,
    isEnriching: false
  });

  const initializeSteps = useCallback((enabledOptions: string[]) => {
    const allSteps: EnrichmentStep[] = [];
    
    if (enabledOptions.includes('categories')) {
      allSteps.push({ id: 'categories', name: '🏷️ Catégorisation', status: 'pending' });
    }
    
    if (enabledOptions.includes('images')) {
      allSteps.push(
        { id: 'images-scraping', name: '📄 Scraping site officiel', status: 'pending' },
        { id: 'images-ollama', name: '🤖 Recherche Ollama Web', status: 'pending' },
        { id: 'images-amazon', name: '📦 Images Amazon', status: 'pending' },
        { id: 'images-google', name: '🛒 Google Shopping', status: 'pending' }
      );
    }
    
    if (enabledOptions.includes('shopping')) {
      allSteps.push({ id: 'shopping', name: '💰 Prix concurrents', status: 'pending' });
    }
    
    if (enabledOptions.includes('advanced')) {
      allSteps.push(
        { id: 'specifications', name: '📋 Spécifications', status: 'pending' },
        { id: 'technical', name: '🔧 Description technique', status: 'pending' },
        { id: 'cost', name: '💵 Analyse coûts', status: 'pending' }
      );
    }
    
    if (enabledOptions.includes('odoo')) {
      allSteps.push({ id: 'odoo', name: '🏢 Attributs Odoo', status: 'pending' });
    }
    
    if (enabledOptions.includes('video')) {
      allSteps.push({ id: 'video', name: '🎬 Génération vidéo', status: 'pending' });
    }

    setProgress({
      overall: 0,
      steps: allSteps,
      currentStep: null,
      isEnriching: true
    });
  }, []);

  const updateStep = useCallback((stepId: string, updates: Partial<EnrichmentStep>) => {
    setProgress(prev => {
      const updatedSteps = prev.steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      );
      
      const completedSteps = updatedSteps.filter(s => 
        s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
      ).length;
      const overall = updatedSteps.length > 0 
        ? Math.round((completedSteps / updatedSteps.length) * 100) 
        : 0;
      
      return {
        ...prev,
        steps: updatedSteps,
        overall,
        currentStep: updates.status === 'processing' ? stepId : prev.currentStep
      };
    });
  }, []);

  const completeEnrichment = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      overall: 100,
      currentStep: null,
      isEnriching: false
    }));
  }, []);

  const reset = useCallback(() => {
    setProgress({
      overall: 0,
      steps: [],
      currentStep: null,
      isEnriching: false
    });
  }, []);

  return {
    progress,
    initializeSteps,
    updateStep,
    completeEnrichment,
    reset
  };
};
