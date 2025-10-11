import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Download, RefreshCw, Edit } from "lucide-react";
import { VideoPlayer } from "../VideoPlayer";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface VideoSectionProps {
  analysis: any;
}

export const VideoSection = ({ analysis }: VideoSectionProps) => {
  const videoUrl = analysis?.video_url;
  const videoCreatedAt = analysis?.video_created_at;

  if (!videoUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Vidéo Promotionnelle IA
          </CardTitle>
          <CardDescription>
            Aucune vidéo disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full gap-2">
            <Video className="h-4 w-4" />
            Générer une vidéo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Vidéo Promotionnelle IA
        </CardTitle>
        <CardDescription>
          Vidéo générée automatiquement par intelligence artificielle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lecteur vidéo */}
        <div className="rounded-lg overflow-hidden border">
          <VideoPlayer analysisId={analysis.id} showCard={false} />
        </div>

        {/* Informations sur la vidéo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Durée</span>
            <span className="font-medium">1:30</span>
          </div>
          
          {videoCreatedAt && (
            <div className="flex flex-col">
              <span className="text-muted-foreground">Générée</span>
              <span className="font-medium">
                {formatDistanceToNow(new Date(videoCreatedAt), {
                  addSuffix: true,
                  locale: fr
                })}
              </span>
            </div>
          )}
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Avatar</span>
            <span className="font-medium">Sarah (Anglais)</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-muted-foreground">Script</span>
            <Badge variant="outline" className="w-fit">Auto-généré IA</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href={videoUrl} download>
              <Download className="h-3 w-3" />
              Télécharger MP4
            </a>
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Régénérer
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <Edit className="h-3 w-3" />
            Modifier script
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
