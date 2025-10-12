import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Video, Download, ExternalLink, Clock, Calendar, User, Mic } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface VideoHistoryDialogProps {
  analysisId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoHistoryDialog({ analysisId, open, onOpenChange }: VideoHistoryDialogProps) {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchVideoHistory();
    }
  }, [open, analysisId]);

  const fetchVideoHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_videos')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error('Error fetching video history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">✅ Terminé</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Erreur</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Historique des vidéos
          </DialogTitle>
          <DialogDescription>
            Toutes les vidéos générées pour ce produit
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Video className="w-12 h-12 text-muted-foreground opacity-50 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune vidéo dans l'historique</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="p-4 border rounded-lg space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(video.status)}
                        <span className="text-xs text-muted-foreground">
                          ID: {video.video_id?.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(video.created_at), {
                            addSuffix: true,
                            locale: fr
                          })}
                        </div>
                        {video.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round(video.duration)}s
                          </div>
                        )}
                      </div>
                    </div>

                    {video.video_url && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(video.video_url, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Télécharger
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(video.video_url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ouvrir
                        </Button>
                      </div>
                    )}
                  </div>

                  {video.avatar_id && (
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>Avatar: {video.avatar_id.substring(0, 12)}...</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mic className="w-3 h-3" />
                        <span>Voix: {video.voice_id?.substring(0, 12)}...</span>
                      </div>
                    </div>
                  )}

                  {video.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {video.error_message}
                    </p>
                  )}

                  {video.script && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Voir le script
                      </summary>
                      <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                        {video.script}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}