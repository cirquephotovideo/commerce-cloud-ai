import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreatePlanDialog = ({ open, onOpenChange, onSuccess }: CreatePlanDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_monthly: 0,
    price_yearly: 0,
    currency: "EUR",
    product_analyses: 0,
    price_alerts: 0,
    google_shopping: 0,
    image_optimizations: 0,
    display_order: 0
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .insert({
          name: formData.name,
          description: formData.description,
          price_monthly: formData.price_monthly,
          price_yearly: formData.price_yearly || null,
          currency: formData.currency,
          limits: {
            product_analyses: formData.product_analyses,
            price_alerts: formData.price_alerts,
            google_shopping: formData.google_shopping,
            image_optimizations: formData.image_optimizations
          },
          features: [],
          display_order: formData.display_order,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Plan créé avec succès",
      });

      setFormData({
        name: "",
        description: "",
        price_monthly: 0,
        price_yearly: 0,
        currency: "EUR",
        product_analyses: 0,
        price_alerts: 0,
        google_shopping: 0,
        image_optimizations: 0,
        display_order: 0
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating plan:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau plan</DialogTitle>
          <DialogDescription>
            Créer un nouveau plan d'abonnement avec ses prix et limites
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du plan *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Pro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Pour les professionnels"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_monthly">Prix mensuel (€) *</Label>
              <Input
                id="price_monthly"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_monthly}
                onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_yearly">Prix annuel (€)</Label>
              <Input
                id="price_yearly"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_yearly}
                onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Ordre d'affichage</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Limites d'utilisation</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_analyses" className="text-sm">Analyses produit</Label>
                <Input
                  id="product_analyses"
                  type="number"
                  min="0"
                  value={formData.product_analyses}
                  onChange={(e) => setFormData({ ...formData, product_analyses: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_alerts" className="text-sm">Alertes prix</Label>
                <Input
                  id="price_alerts"
                  type="number"
                  min="0"
                  value={formData.price_alerts}
                  onChange={(e) => setFormData({ ...formData, price_alerts: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google_shopping" className="text-sm">Google Shopping</Label>
                <Input
                  id="google_shopping"
                  type="number"
                  min="0"
                  value={formData.google_shopping}
                  onChange={(e) => setFormData({ ...formData, google_shopping: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_optimizations" className="text-sm">Optimisations d'images</Label>
                <Input
                  id="image_optimizations"
                  type="number"
                  min="0"
                  value={formData.image_optimizations}
                  onChange={(e) => setFormData({ ...formData, image_optimizations: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer le plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};