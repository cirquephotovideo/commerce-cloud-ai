import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, User, Mic, ChevronRight, ChevronLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface HeyGenVideoWizardProps {
  analysisId: string;
  onGenerate: (avatarId: string, voiceId: string) => void;
  onClose: () => void;
}

interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
  gender?: string;
}

interface Voice {
  voice_id: string;
  voice_name: string;
  language?: string;
  gender?: string;
  preview_audio_url?: string;
}

export function HeyGenVideoWizard({ analysisId, onGenerate, onClose }: HeyGenVideoWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "⚠️ Authentification requise",
        description: "Veuillez vous connecter",
        variant: "destructive"
      });
      onClose();
      return;
    }

    const { data } = await supabase
      .from('ai_provider_configs')
      .select('id')
      .eq('provider', 'heygen')
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (!data) {
      const { data: globalKey } = await supabase
        .from('ai_provider_configs')
        .select('id')
        .eq('provider', 'heygen')
        .eq('is_active', true)
        .is('user_id', null)
        .maybeSingle();
        
      if (!globalKey) {
        toast({
          title: "⚠️ Configuration requise",
          description: "Configurez votre clé HeyGen dans Paramètres → Providers IA",
          variant: "destructive"
        });
        onClose();
        return;
      }
    }
    
    loadAvatars();
    loadVoices();
  };

  const loadAvatars = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
        body: {
          action: 'list_resources',
          resource_type: 'avatars'
        }
      });

      if (error) throw error;
      setAvatars(data?.avatars || []);
    } catch (error: any) {
      console.error('Erreur chargement avatars:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les avatars disponibles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
        body: {
          action: 'list_resources',
          resource_type: 'voices'
        }
      });

      if (error) throw error;
      setVoices(data?.voices || []);
    } catch (error: any) {
      console.error('Erreur chargement voix:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les voix disponibles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedAvatar) {
      setStep(2);
      loadVoices();
    } else if (step === 2 && selectedVoice) {
      handleGenerate();
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleGenerate = () => {
    if (selectedAvatar && selectedVoice) {
      console.log('[WIZARD] Generating video with:', {
        analysisId,
        avatarId: selectedAvatar,
        voiceId: selectedVoice
      });
      onGenerate(selectedAvatar, selectedVoice);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Générer une vidéo HeyGen
          </DialogTitle>
          <DialogDescription>
            Étape {step}/2: {step === 1 ? 'Sélectionnez un avatar' : 'Sélectionnez une voix'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicateur de progression */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1
          </div>
          <div className={`h-0.5 w-16 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Étape 1: Sélection Avatar */}
            {step === 1 && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.avatar_id}
                      onClick={() => setSelectedAvatar(avatar.avatar_id)}
                      className={`relative p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                        selectedAvatar === avatar.avatar_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                        {avatar.preview_image_url ? (
                          <img 
                            src={avatar.preview_image_url} 
                            alt={avatar.avatar_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{avatar.avatar_name}</p>
                      {avatar.gender && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {avatar.gender}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                {avatars.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun avatar disponible
                  </p>
                )}
              </ScrollArea>
            )}

            {/* Étape 2: Sélection Voix */}
            {step === 2 && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {voices.map((voice) => (
                    <button
                      key={voice.voice_id}
                      onClick={() => setSelectedVoice(voice.voice_id)}
                      className={`w-full p-4 rounded-lg border-2 transition-all hover:shadow-md text-left ${
                        selectedVoice === voice.voice_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Mic className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{voice.voice_name}</p>
                          <div className="flex gap-2 mt-1">
                            {voice.language && (
                              <Badge variant="outline" className="text-xs">
                                {voice.language}
                              </Badge>
                            )}
                            {voice.gender && (
                              <Badge variant="secondary" className="text-xs">
                                {voice.gender}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {voices.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune voix disponible
                  </p>
                )}
              </ScrollArea>
            )}
          </>
        )}

        {/* Boutons de navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 1 ? onClose : handleBack}
            disabled={loading}
          >
            {step === 1 ? (
              'Annuler'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </>
            )}
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading || (step === 1 ? !selectedAvatar : !selectedVoice)}
          >
            {step === 1 ? (
              <>
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              'Générer la vidéo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
