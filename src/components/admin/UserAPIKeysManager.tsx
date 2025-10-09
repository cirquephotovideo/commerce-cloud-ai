import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Search, Key } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserAPIKey {
  id: string;
  user_id: string | null;
  provider: string;
  is_active: boolean;
  created_at: string;
  user_email?: string;
}

const PROVIDERS = [
  { id: 'claude', name: 'Claude (Anthropic)' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'heygen', name: 'HeyGen' },
  { id: 'ollama', name: 'Ollama' },
];

export const UserAPIKeysManager = () => {
  const [apiKeys, setApiKeys] = useState<UserAPIKey[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    setIsLoading(true);
    try {
      const { data: configs, error } = await supabase
        .from('ai_provider_configs')
        .select(`
          id,
          user_id,
          provider,
          is_active,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails for configs with user_id
      const { data: authData } = await supabase.auth.admin.listUsers();
      const users = authData?.users || [];

      const enrichedKeys = configs?.map(config => ({
        ...config,
        user_email: config.user_id 
          ? users.find(u => u.id === config.user_id)?.email || 'Unknown'
          : 'Global (System)'
      })) || [];

      setApiKeys(enrichedKeys);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les clés API",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette clé API ?")) return;

    try {
      const { error } = await supabase
        .from('ai_provider_configs')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: "✅ Clé supprimée",
        description: "La clé API a été supprimée avec succès"
      });
      loadAPIKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la clé API",
        variant: "destructive"
      });
    }
  };

  const handleAddGlobalKey = async () => {
    if (!selectedProvider || !newApiKey) {
      toast({
        title: "Champs requis",
        description: "Veuillez sélectionner un provider et entrer une clé API",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_provider_configs')
        .insert({
          user_id: null, // Global key
          provider: selectedProvider,
          api_key_encrypted: newApiKey,
          is_active: true,
          priority: 0
        });

      if (error) throw error;

      toast({
        title: "✅ Clé globale ajoutée",
        description: "La clé API globale a été créée avec succès"
      });
      
      setIsDialogOpen(false);
      setSelectedProvider("");
      setNewApiKey("");
      loadAPIKeys();
    } catch (error) {
      console.error('Error adding global key:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la clé globale",
        variant: "destructive"
      });
    }
  };

  const filteredKeys = apiKeys.filter(key => 
    !searchEmail || key.user_email?.toLowerCase().includes(searchEmail.toLowerCase())
  );

  const getProviderName = (providerId: string) => {
    return PROVIDERS.find(p => p.id === providerId)?.name || providerId;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Gestion des Clés API Utilisateurs
            </CardTitle>
            <CardDescription>
              Gérez toutes les clés API des utilisateurs et les clés globales système
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter Clé Globale
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une Clé API Globale</DialogTitle>
                <DialogDescription>
                  Cette clé sera utilisée comme fallback pour tous les utilisateurs qui n'ont pas configuré leur propre clé
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="password"
                  placeholder="Clé API"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
                <Button onClick={handleAddGlobalKey} className="w-full">
                  Créer Clé Globale
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune clé API trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.user_email}
                      </TableCell>
                      <TableCell>{getProviderName(key.provider)}</TableCell>
                      <TableCell>
                        <Badge variant={key.user_id ? "default" : "outline"}>
                          {key.user_id ? "🔐 Personnelle" : "🔓 Globale"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.is_active ? "default" : "secondary"}>
                          {key.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(key.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
