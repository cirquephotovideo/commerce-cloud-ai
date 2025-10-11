import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface EnrichmentTimelineProps {
  analysisId: string;
}

export const EnrichmentTimeline = ({ analysisId }: EnrichmentTimelineProps) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ['enrichment-timeline', analysisId],
    queryFn: async () => {
      const timeline: Array<{
        time: string;
        event: string;
        status: string;
        icon: React.ReactNode;
      }> = [];

      const [amazon, video, enrichmentQueue] = await Promise.all([
        supabase
          .from('amazon_product_data')
          .select('created_at, last_synced_at')
          .eq('analysis_id', analysisId)
          .maybeSingle(),
        supabase
          .from('product_videos')
          .select('created_at, status, completed_at')
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('enrichment_queue')
          .select('created_at, completed_at, status, enrichment_type')
          .eq('analysis_id', analysisId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      // Données Amazon
      if (amazon.data?.last_synced_at) {
        timeline.push({
          time: amazon.data.last_synced_at,
          event: '📦 Données Amazon synchronisées',
          status: 'success',
          icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        });
      }

      // Vidéo HeyGen
      if (video.data) {
        if (video.data.status === 'completed' && video.data.completed_at) {
          timeline.push({
            time: video.data.completed_at,
            event: '🎬 Vidéo HeyGen générée',
            status: 'success',
            icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
          });
        } else if (video.data.status === 'processing') {
          timeline.push({
            time: video.data.created_at,
            event: '🎬 Génération vidéo en cours',
            status: 'processing',
            icon: <Clock className="h-4 w-4 text-primary" />,
          });
        } else if (video.data.status === 'failed') {
          timeline.push({
            time: video.data.created_at,
            event: '🎬 Erreur génération vidéo',
            status: 'error',
            icon: <AlertCircle className="h-4 w-4 text-destructive" />,
          });
        }
      }

      // File d'enrichissement
      if (enrichmentQueue.data) {
        enrichmentQueue.data.forEach((item) => {
          const types = item.enrichment_type.join(', ');
          if (item.status === 'completed' && item.completed_at) {
            timeline.push({
              time: item.completed_at,
              event: `✅ Enrichissement complété (${types})`,
              status: 'success',
              icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
            });
          } else if (item.status === 'processing') {
            timeline.push({
              time: item.created_at,
              event: `⏳ Enrichissement en cours (${types})`,
              status: 'processing',
              icon: <Clock className="h-4 w-4 text-primary" />,
            });
          }
        });
      }

      // Trier par date décroissante
      timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      return timeline;
    },
    refetchInterval: 10000, // Rafraîchir toutes les 10 secondes
  });

  const getTimeDifference = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📅 Historique d'Enrichissement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📅 Historique d'Enrichissement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events && events.length > 0 ? (
            events.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 pb-3 border-b last:border-0"
              >
                <div className="mt-1">{item.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {getTimeDifference(item.time)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun événement d'enrichissement
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
