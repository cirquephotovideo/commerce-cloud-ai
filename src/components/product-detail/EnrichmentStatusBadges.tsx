import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, TestTube } from 'lucide-react';
import { useProductEnrichmentStatus } from '@/hooks/useProductEnrichmentStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface EnrichmentStatusBadgesProps {
  analysisId: string;
  onEnrichClick?: (type: 'amazon' | 'video' | 'images') => void;
}

export const EnrichmentStatusBadges = ({ analysisId, onEnrichClick }: EnrichmentStatusBadgesProps) => {
  const { status, refetch } = useProductEnrichmentStatus(analysisId);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestEnrichment = async () => {
    setIsTesting(true);
    const startTime = Date.now();
    
    try {
      toast.info('🧪 Test enrichissement lancé...', {
        description: 'Appel de unified-lovable-enrichment en cours'
      });

      const { data, error } = await supabase.functions.invoke('unified-lovable-enrichment', {
        body: {
          analysisId,
          enrichment_type: 'description',
          productData: { product_name: 'Test Product' }
        }
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('Test enrichment error:', error);
        toast.error('❌ Test échoué', {
          description: `${error.message} (${duration}ms)`
        });
        return;
      }

      console.log('Test enrichment result:', data);
      toast.success('✅ Test réussi !', {
        description: `Enrichissement terminé en ${duration}ms avec ${data.model_used}`
      });
      
      // Rafraîchir le statut
      setTimeout(() => refetch(), 1000);
      
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error('Test enrichment exception:', err);
      toast.error('❌ Erreur inattendue', {
        description: `${err.message} (${duration}ms)`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = (
    isCompleted: boolean,
    isProcessing: boolean,
    label: string,
    icon: React.ReactNode
  ) => {
    if (isProcessing) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {label} en cours
        </Badge>
      );
    }
    if (isCompleted) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 text-white">
          <CheckCircle2 className="h-3 w-3" />
          {label}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {label} manquant
      </Badge>
    );
  };

  const getVideoBadge = () => {
    switch (status.video) {
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3" />
            🎬 Vidéo
          </Badge>
        );
      case 'processing':
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            🎬 Vidéo en cours
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            🎬 Vidéo erreur
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            🎬 Vidéo manquante
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Statuts d'enrichissement */}
      <div className="flex flex-wrap gap-2">
        {getStatusBadge(status.ai_analysis, false, '🤖 IA Analysé', null)}
        {getStatusBadge(status.amazon, status.isEnriching, '📦 Amazon', null)}
        {getVideoBadge()}
        {status.images > 0 ? (
          <Badge variant="default" className="gap-1 bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3" />
            📸 {status.images} image{status.images > 1 ? 's' : ''}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            📸 Images manquantes
          </Badge>
        )}
      </div>

      {/* Badge de statut global */}
      {status.isEnriching && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">⚡ Enrichissement en cours...</span>
          <Button size="sm" variant="ghost" onClick={refetch}>
            Actualiser
          </Button>
        </div>
      )}

      {/* Bouton de test pour debugging */}
      <Button
        size="sm"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={handleTestEnrichment}
        disabled={isTesting}
      >
        {isTesting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Test en cours...
          </>
        ) : (
          <>
            <TestTube className="h-4 w-4" />
            🧪 Test Enrichment (Debug)
          </>
        )}
      </Button>

      {/* Actions rapides pour enrichissements manquants */}
      {!status.isEnriching && onEnrichClick && (
        <div className="space-y-2">
          {!status.amazon && (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => onEnrichClick('amazon')}
            >
              📦 Enrichir avec Amazon (30s)
            </Button>
          )}
          {!status.video && (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => onEnrichClick('video')}
            >
              🎬 Générer vidéo promotionnelle (2 min)
            </Button>
          )}
          {status.images < 5 && (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => onEnrichClick('images')}
            >
              🎨 Générer images IA (1 min)
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
