import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HealthStatus = 'valid' | 'invalid' | 'expired' | 'unauthorized' | 'missing' | 'loading' | 'error';

export const AmazonHealthStatus = () => {
  const [status, setStatus] = useState<HealthStatus>('loading');
  const [message, setMessage] = useState('');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-amazon-credentials');
      
      if (error) throw error;

      setStatus(data.status);
      setMessage(data.message);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check error:', error);
      setStatus('error');
      setMessage('Impossible de vérifier le statut');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Vérifier toutes les minutes
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'valid':
        return {
          badge: <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Valide</Badge>,
          icon: <CheckCircle className="w-5 h-5 text-green-500" />
        };
      case 'invalid':
      case 'expired':
        return {
          badge: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Invalide</Badge>,
          icon: <XCircle className="w-5 h-5 text-destructive" />
        };
      case 'unauthorized':
        return {
          badge: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Non autorisé</Badge>,
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />
        };
      case 'missing':
        return {
          badge: <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Manquant</Badge>,
          icon: <AlertCircle className="w-5 h-5 text-muted-foreground" />
        };
      default:
        return {
          badge: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Vérification...</Badge>,
          icon: <Clock className="w-5 h-5 text-muted-foreground" />
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        {config.icon}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Statut Amazon</span>
            {config.badge}
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
          {lastCheck && (
            <p className="text-xs text-muted-foreground mt-1">
              Dernière vérification : {lastCheck.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={checkHealth}
        disabled={checking}
      >
        <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
};
