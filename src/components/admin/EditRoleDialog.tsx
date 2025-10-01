import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string;
  currentRole: string;
  onSuccess: () => void;
}

export const EditRoleDialog = ({ open, onOpenChange, userId, userEmail, currentRole, onSuccess }: EditRoleDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setLoading(true);

    try {
      // Si le rôle est "user", supprimer l'entrée dans user_roles
      if (selectedRole === "user") {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Vérifier si l'utilisateur a déjà un rôle
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existingRole) {
          // Mettre à jour le rôle existant
          const { error } = await supabase
            .from("user_roles")
            .update({ role: selectedRole as any })
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          // Créer un nouveau rôle
          const { error } = await supabase
            .from("user_roles")
            .insert({
              user_id: userId,
              role: selectedRole as any
            });

          if (error) throw error;
        }
      }

      toast({
        title: "Succès",
        description: `Rôle modifié pour ${userEmail}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le rôle",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Modifier le rôle</DialogTitle>
          <DialogDescription>
            Modifier les permissions pour {userEmail}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select
              value={selectedRole}
              onValueChange={setSelectedRole}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="moderator">Modérateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
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
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
