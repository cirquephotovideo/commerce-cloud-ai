import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, X, Edit, History, TestTube, Download, Upload } from "lucide-react";
import { Loader2 } from "lucide-react";
import { ImportExportButtons } from "./ImportExportButtons";

interface AIPrompt {
  id: string;
  function_name: string;
  prompt_key: string;
  prompt_type: string;
  prompt_content: string;
  model: string;
  temperature: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

const FUNCTION_GROUPS = {
  'product-analyzer': { label: '📦 Analyseur de Produits', icon: '📦' },
  'advanced-product-analyzer': { label: '🔬 Analyseur Avancé', icon: '🔬' },
  'ai-taxonomy-categorizer': { label: '🏷️ Catégorisation', icon: '🏷️' },
  'google-shopping-scraper': { label: '🛒 Google Shopping', icon: '🛒' },
  'generate-image': { label: '🖼️ Génération Images', icon: '🖼️' },
  'ai-chat': { label: '💬 Chat IA', icon: '💬' },
  'heygen-video-generator': { label: '🎥 Vidéos HeyGen', icon: '🎥' },
  'rsgp-compliance-generator': { label: '📋 Conformité RSGP', icon: '📋' },
  'enrich-odoo-attributes': { label: '🏭 Attributs Odoo', icon: '🏭' },
};

const AVAILABLE_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash-image-preview',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
];

export const AIPromptsManagement = () => {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<Partial<AIPrompt>>({});
  const [selectedFunction, setSelectedFunction] = useState<string>('product-analyzer');
  const { toast } = useToast();

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('function_name')
        .order('prompt_key');

      if (error) throw error;
      setPrompts(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (prompt: AIPrompt) => {
    setEditingId(prompt.id);
    setEditedPrompt({ ...prompt });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedPrompt({});
  };

  const savePrompt = async () => {
    if (!editingId || !editedPrompt) return;

    try {
      const { error } = await supabase
        .from('ai_prompts')
        .update({
          prompt_content: editedPrompt.prompt_content,
          model: editedPrompt.model,
          temperature: editedPrompt.temperature,
          is_active: editedPrompt.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Prompt mis à jour avec succès",
      });

      await loadPrompts();
      cancelEdit();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImport = async (data: any) => {
    if (!Array.isArray(data)) {
      throw new Error('Format invalide: un tableau de prompts est attendu');
    }

    for (const prompt of data) {
      const { error } = await supabase.from('ai_prompts').upsert(prompt);
      if (error) throw error;
    }

    await loadPrompts();
  };

  const filteredPrompts = prompts.filter(p => p.function_name === selectedFunction);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">🎯 Gestion des Prompts IA</h2>
          <p className="text-muted-foreground">
            Éditez et gérez les prompts utilisés par les fonctions IA
          </p>
        </div>
        <ImportExportButtons
          data={prompts}
          filename="ai-prompts"
          onImport={handleImport}
          disabled={loading}
        />
      </div>

      <Tabs value={selectedFunction} onValueChange={setSelectedFunction}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          {Object.entries(FUNCTION_GROUPS).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key} className="text-xs lg:text-sm">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(FUNCTION_GROUPS).map((functionName) => (
          <TabsContent key={functionName} value={functionName}>
            <div className="space-y-4">
              {filteredPrompts.map((prompt) => (
                <Card key={prompt.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                          {prompt.prompt_key}
                          <Badge variant={prompt.is_active ? "default" : "secondary"}>
                            {prompt.is_active ? "Actif" : "Inactif"}
                          </Badge>
                          <Badge variant="outline">{prompt.prompt_type}</Badge>
                        </CardTitle>
                        <CardDescription>
                          Version {prompt.version} • Dernière mise à jour: {new Date(prompt.updated_at).toLocaleDateString('fr-FR')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {editingId === prompt.id ? (
                          <>
                            <Button onClick={savePrompt} size="sm">
                              <Save className="h-4 w-4 mr-2" />
                              Sauvegarder
                            </Button>
                            <Button onClick={cancelEdit} size="sm" variant="outline">
                              <X className="h-4 w-4 mr-2" />
                              Annuler
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => startEdit(prompt)} size="sm" variant="outline">
                            <Edit className="h-4 w-4 mr-2" />
                            Éditer
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editingId === prompt.id ? (
                      <>
                        <div className="space-y-2">
                          <Label>Contenu du Prompt</Label>
                          <Textarea
                            value={editedPrompt.prompt_content || ''}
                            onChange={(e) => setEditedPrompt({ ...editedPrompt, prompt_content: e.target.value })}
                            rows={10}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Modèle</Label>
                            <Select
                              value={editedPrompt.model}
                              onValueChange={(value) => setEditedPrompt({ ...editedPrompt, model: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABLE_MODELS.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Température ({editedPrompt.temperature?.toFixed(1)})</Label>
                            <Input
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={editedPrompt.temperature || 0.7}
                              onChange={(e) => setEditedPrompt({ ...editedPrompt, temperature: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Contenu</Label>
                          <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                            {prompt.prompt_content}
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="font-semibold">Modèle:</span> {prompt.model}
                          </div>
                          <div>
                            <span className="font-semibold">Température:</span> {prompt.temperature}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
