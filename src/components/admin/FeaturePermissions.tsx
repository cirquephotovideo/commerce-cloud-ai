import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "lucide-react";

interface FeaturePermission {
  id: string;
  feature_name: string;
  feature_description: string;
  enabled_for_users: boolean;
  enabled_for_admins: boolean;
}

export const FeaturePermissions = () => {
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("feature_permissions")
        .select("*")
        .order("feature_name");

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast.error("Erreur lors du chargement des permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = async (id: string, field: 'enabled_for_users' | 'enabled_for_admins', currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("feature_permissions")
        .update({ [field]: !currentValue })
        .eq("id", id);

      if (error) throw error;

      setPermissions(permissions.map(p => 
        p.id === id ? { ...p, [field]: !currentValue } : p
      ));

      toast.success("Permission mise à jour");
    } catch (error) {
      console.error("Error updating permission:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Gestion des Permissions</CardTitle>
        </div>
        <CardDescription>
          Contrôlez l'accès aux fonctionnalités pour les utilisateurs et administrateurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {permissions.map((perm) => (
            <div key={perm.id} className="border-b pb-4 last:border-0">
              <div className="mb-2">
                <h4 className="font-medium">{perm.feature_name}</h4>
                <p className="text-sm text-muted-foreground">{perm.feature_description}</p>
              </div>
              
              <div className="flex gap-6 mt-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`${perm.id}-users`}
                    checked={perm.enabled_for_users}
                    onCheckedChange={() => togglePermission(perm.id, 'enabled_for_users', perm.enabled_for_users)}
                  />
                  <Label htmlFor={`${perm.id}-users`}>Utilisateurs</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`${perm.id}-admins`}
                    checked={perm.enabled_for_admins}
                    onCheckedChange={() => togglePermission(perm.id, 'enabled_for_admins', perm.enabled_for_admins)}
                  />
                  <Label htmlFor={`${perm.id}-admins`}>Administrateurs</Label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};