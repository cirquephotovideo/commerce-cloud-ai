import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AmazonCredential {
  id: string;
  client_id: string;
  is_active: boolean;
  secret_expires_at: string | null;
  last_rotation_at: string | null;
  rotation_warning_sent: boolean;
  marketplace_id: string;
}

interface RotationHistory {
  id: string;
  rotation_date: string;
  status: string;
  error_message: string | null;
  rotated_by: string;
  new_expiry_date: string | null;
}

export function AmazonCredentialsManager() {
  const queryClient = useQueryClient();

  const { data: credentials, isLoading: credentialsLoading } = useQuery<AmazonCredential>({
    queryKey: ['amazon-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: rotationHistory } = useQuery<RotationHistory[]>({
    queryKey: ['amazon-rotation-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_credential_rotations')
        .select('*')
        .order('rotation_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('rotate-amazon-credentials', {
        body: { force: true }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amazon-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['amazon-rotation-history'] });
      toast.success('Rotation des credentials lancée avec succès');
    },
    onError: (error: any) => {
      toast.error('Erreur lors de la rotation', {
        description: error.message
      });
    },
  });

  const getDaysUntilExpiry = () => {
    if (!credentials?.secret_expires_at) return null;
    const expiryDate = new Date(credentials.secret_expires_at);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiry = getDaysUntilExpiry();

  const getExpiryBadge = () => {
    if (daysUntilExpiry === null) return null;
    
    if (daysUntilExpiry < 7) {
      return <Badge variant="destructive">Expire dans {daysUntilExpiry} jours</Badge>;
    } else if (daysUntilExpiry < 30) {
      return <Badge className="bg-yellow-500 text-white">Expire dans {daysUntilExpiry} jours</Badge>;
    } else {
      return <Badge variant="outline">Expire dans {daysUntilExpiry} jours</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Succès</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Échec</Badge>;
      case 'manual_required':
        return <Badge className="gap-1 bg-yellow-500 text-white"><AlertCircle className="w-3 h-3" />Action manuelle requise</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (credentialsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Amazon Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!credentials) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Amazon Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Aucun credential Amazon configuré</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Amazon Credentials</span>
            {getExpiryBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client ID:</span>
              <p className="font-mono">{credentials.client_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Marketplace:</span>
              <p>{credentials.marketplace_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date d'expiration:</span>
              <p>
                {credentials.secret_expires_at
                  ? format(new Date(credentials.secret_expires_at), 'dd/MM/yyyy à HH:mm', { locale: fr })
                  : 'Non définie'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Dernière rotation:</span>
              <p>
                {credentials.last_rotation_at
                  ? format(new Date(credentials.last_rotation_at), 'dd/MM/yyyy à HH:mm', { locale: fr })
                  : 'Jamais'}
              </p>
            </div>
          </div>

          {daysUntilExpiry !== null && daysUntilExpiry < 30 && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive">Action requise</p>
                <p className="text-sm text-muted-foreground">
                  Les credentials expirent dans {daysUntilExpiry} jours. Une rotation automatique sera tentée.
                  Vous pouvez forcer la rotation maintenant.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() => rotateMutation.mutate()}
            disabled={rotateMutation.isPending}
            className="w-full"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
            {rotateMutation.isPending ? 'Rotation en cours...' : 'Forcer la rotation'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des rotations</CardTitle>
        </CardHeader>
        <CardContent>
          {!rotationHistory || rotationHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Aucune rotation enregistrée
            </div>
          ) : (
            <div className="space-y-3">
              {rotationHistory.map((rotation) => (
                <div
                  key={rotation.id}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(rotation.status)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(rotation.rotation_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Par:</span> {rotation.rotated_by}
                    </p>
                    {rotation.new_expiry_date && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Nouvelle expiration:</span>{' '}
                        {format(new Date(rotation.new_expiry_date), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    )}
                    {rotation.error_message && (
                      <p className="text-sm text-destructive">{rotation.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
