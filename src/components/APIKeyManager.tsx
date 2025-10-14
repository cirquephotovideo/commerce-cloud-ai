import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const APIKeyManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const generateApiKey = () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  };

  const createApiKey = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!keyName.trim()) {
        throw new Error("Veuillez donner un nom à la clé API");
      }

      const apiKey = generateApiKey();
      const keyPrefix = apiKey.substring(0, 8);
      
      // Hash the key for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        name: keyName,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      });

      if (error) throw error;

      return apiKey;
    },
    onSuccess: (apiKey) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKeyValue(apiKey);
      setShowNewKey(true);
      setKeyName("");
      toast({ title: "Clé API créée avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleApiKey = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Statut de la clé mis à jour" });
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clé API supprimée" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papier" });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gestion des Clés API
          </CardTitle>
          <CardDescription>
            Créez et gérez vos clés API pour l'intégration externe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="key-name">Nom de la clé</Label>
              <Input
                id="key-name"
                placeholder="Ex: Production API Key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>

            <Button
              onClick={() => createApiKey.mutate()}
              disabled={!keyName.trim() || createApiKey.isPending}
              className="w-full"
            >
              {createApiKey.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Créer une nouvelle clé API
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Clés API existantes</h4>
            {apiKeys?.map((key) => (
              <div key={key.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {visibleKeys.has(key.id)
                        ? `${key.key_prefix}${"*".repeat(56)}`
                        : `${key.key_prefix}${"*".repeat(56)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleKeyVisibility(key.id)}
                    >
                      {visibleKeys.has(key.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(`${key.key_prefix}...`)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={() =>
                        toggleApiKey.mutate({ id: key.id, isActive: key.is_active })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteApiKey.mutate(key.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={key.is_active ? "default" : "secondary"}>
                    {key.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-muted-foreground">
                    Créée le {new Date(key.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  {key.last_used_at && (
                    <span className="text-muted-foreground">
                      Dernière utilisation:{" "}
                      {new Date(key.last_used_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {!apiKeys?.length && (
              <p className="text-center text-muted-foreground py-8">
                Aucune clé API créée. Créez-en une ci-dessus.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Clé API Créée</DialogTitle>
            <DialogDescription>
              Copiez cette clé maintenant. Vous ne pourrez plus la voir ensuite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-accent rounded-lg">
              <code className="text-sm break-all">{newKeyValue}</code>
            </div>
            <Button
              onClick={() => copyToClipboard(newKeyValue)}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copier la clé
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
