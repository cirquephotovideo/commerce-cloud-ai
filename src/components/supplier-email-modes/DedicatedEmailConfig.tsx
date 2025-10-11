import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DedicatedEmailConfigProps {
  supplierId?: string | null;
}

export function DedicatedEmailConfig({ supplierId }: DedicatedEmailConfigProps) {
  const [userId, setUserId] = useState<string>('');
  const [dedicatedEmail, setDedicatedEmail] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    const initEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      
      // Si pas de supplierId, on est en mode création -> montrer un preview
      if (!supplierId) {
        const previewEmail = `[id-auto]-${user.id.slice(0, 8)}@inbox.tarifique.com`;
        setDedicatedEmail(previewEmail);
        return;
      }
      
      // Vérifier si un email dédié existe déjà en DB
      const { data: supplier } = await supabase
        .from('supplier_configurations')
        .select('dedicated_email')
        .eq('id', supplierId)
        .maybeSingle();
      
      if (supplier?.dedicated_email) {
        setDedicatedEmail(supplier.dedicated_email);
      } else {
        // Générer l'email au format: {supplier_id_court}-{user_id_court}@inbox.tarifique.com
        const email = `${supplierId.slice(0, 8)}-${user.id.slice(0, 8)}@inbox.tarifique.com`;
        setDedicatedEmail(email);
        
        // Sauvegarder automatiquement en DB
        await supabase
          .from('supplier_configurations')
          .update({ dedicated_email: email })
          .eq('id', supplierId);
      }
    };
    
    initEmail();
  }, [supplierId]);

  const regenerateEmail = async () => {
    if (!supplierId) {
      toast.error("Veuillez d'abord créer le fournisseur");
      return;
    }
    
    setIsGenerating(true);
    const newEmail = `${supplierId.slice(0, 8)}-${userId.slice(0, 8)}-${Date.now().toString(36)}@inbox.tarifique.com`;
    
    const { error } = await supabase
      .from('supplier_configurations')
      .update({ dedicated_email: newEmail })
      .eq('id', supplierId);
    
    if (error) {
      toast.error("Erreur lors de la régénération");
    } else {
      setDedicatedEmail(newEmail);
      toast.success("Nouvelle adresse générée");
    }
    setIsGenerating(false);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(dedicatedEmail);
    toast.success("Adresse email copiée");
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>📧 Adresse Email Dédiée</AlertTitle>
        <AlertDescription>
          Cette adresse est unique à ce fournisseur. Les emails reçus ici seront automatiquement 
          identifiés et traités sans risque d'erreur.
        </AlertDescription>
      </Alert>
      
      <div>
        <Label>Adresse email dédiée à ce fournisseur</Label>
        <div className="flex gap-2 mt-1">
          <Input 
            value={dedicatedEmail} 
            disabled 
            className="font-mono text-sm"
          />
          {supplierId && (
            <Button size="sm" variant="outline" onClick={copyEmail}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!supplierId ? (
          <p className="text-xs text-muted-foreground mt-1">
            ⏳ L'adresse finale sera générée après la création du fournisseur
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Communiquez cette adresse à votre fournisseur pour l'envoi de ses tarifs
          </p>
        )}
        <Button 
          type="button"
          size="sm" 
          variant="ghost" 
          onClick={regenerateEmail}
          disabled={isGenerating || !supplierId}
          className="mt-2"
        >
          {isGenerating ? "Génération..." : "🔄 Régénérer l'adresse"}
        </Button>
      </div>

      <Alert variant="default" className="bg-green-50 dark:bg-green-950 border-green-200">
        <AlertDescription className="text-sm">
          ✅ <strong>Avantage :</strong> Identification instantanée à 100% sans IA. 
          Chaque fournisseur a sa propre "boîte aux lettres".
        </AlertDescription>
      </Alert>
    </div>
  );
}
