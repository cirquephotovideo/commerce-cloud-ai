import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface SupplierEmailConfigProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function SupplierEmailConfig({ config, onConfigChange }: SupplierEmailConfigProps) {
  const [userId, setUserId] = useState<string>('');
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const dedicatedEmail = `${userId.slice(0, 8)}@inbox.tarifique.com`;

  const copyEmail = () => {
    navigator.clipboard.writeText(dedicatedEmail);
    toast.success("Adresse email copiée");
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>Configuration Email</AlertTitle>
        <AlertDescription>
          Les tarifs reçus à cette adresse seront automatiquement traités et intégrés à votre catalogue.
        </AlertDescription>
      </Alert>
      
      <div>
        <Label>Adresse email dédiée</Label>
        <div className="flex gap-2 mt-1">
          <Input 
            value={dedicatedEmail} 
            disabled 
            className="font-mono"
          />
          <Button size="sm" variant="outline" onClick={copyEmail}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Demandez à vos fournisseurs d'envoyer leurs tarifs à cette adresse
        </p>
      </div>
      
      <div>
        <Label htmlFor="allowed_senders">Expéditeur(s) autorisé(s)</Label>
        <Textarea 
          id="allowed_senders"
          placeholder="fournisseur1@example.com&#10;fournisseur2@example.com"
          value={config?.allowed_senders?.join('\n') || ''}
          onChange={(e) => onConfigChange({
            ...config,
            allowed_senders: e.target.value.split('\n').filter(Boolean)
          })}
          rows={5}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Un email par ligne. Les emails d'expéditeurs non listés seront ignorés.
        </p>
      </div>

      <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <AlertDescription className="text-sm">
          💡 <strong>Conseil :</strong> Le système utilise l'IA pour détecter automatiquement le fournisseur et matcher les produits par EAN, référence ou similarité de nom.
        </AlertDescription>
      </Alert>
    </div>
  );
}
