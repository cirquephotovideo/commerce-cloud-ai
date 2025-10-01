import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Send, Eye } from "lucide-react";
import { NewsletterTemplates } from "./NewsletterTemplates";

interface NewsletterEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const NewsletterEditor = ({ open, onOpenChange, onSuccess }: NewsletterEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    content: "",
  });
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer la campagne
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .insert({
          user_id: user.id,
          title: formData.title,
          subject: formData.subject,
          content: formData.content,
          status: "draft"
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      toast({
        title: "Newsletter créée",
        description: "La newsletter a été enregistrée comme brouillon",
      });

      setFormData({ title: "", subject: "", content: "" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating newsletter:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la newsletter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendNewsletter = async () => {
    if (!formData.title || !formData.subject || !formData.content) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer et envoyer la campagne
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .insert({
          user_id: user.id,
          title: formData.title,
          subject: formData.subject,
          content: formData.content,
          status: "scheduled"
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Appeler l'edge function pour envoyer
      const { error: sendError } = await supabase.functions.invoke("send-email-campaign", {
        body: { campaignId: campaign.id }
      });

      if (sendError) throw sendError;

      toast({
        title: "Newsletter envoyée",
        description: "La newsletter est en cours d'envoi aux abonnés",
      });

      setFormData({ title: "", subject: "", content: "" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending newsletter:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la newsletter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template: { subject: string; content: string }) => {
    setFormData({
      ...formData,
      subject: template.subject,
      content: template.content
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Créer une newsletter
          </DialogTitle>
          <DialogDescription>
            Créez et envoyez une newsletter à tous vos abonnés actifs
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Éditeur</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre interne *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Newsletter de janvier 2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Objet de l'email *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Découvrez nos nouveautés"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Contenu *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Bonjour,&#10;&#10;Nous sommes ravis de vous présenter..."
                  rows={12}
                  required
                />
              </div>

              {previewMode && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Prévisualisation</h3>
                    <div className="border rounded-lg p-4 bg-background">
                      <p className="font-semibold mb-2">Objet: {formData.subject}</p>
                      <div className="whitespace-pre-wrap text-sm">{formData.content}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Masquer" : "Prévisualiser"}
                </Button>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={loading}
                  >
                    Enregistrer brouillon
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendNewsletter}
                    disabled={loading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {loading ? "Envoi..." : "Envoyer maintenant"}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="templates">
            <NewsletterTemplates onUseTemplate={handleUseTemplate} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};