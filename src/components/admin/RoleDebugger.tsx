import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export const RoleDebugger = () => {
  const { role, isLoading, isSuperAdmin, isAdmin, isModerator } = useUserRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email || null);
      }
    };
    getUser();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Diagnostic des Permissions
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostic des Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{email || "Non disponible"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">User ID</p>
            <p className="font-mono text-xs">{userId || "Non disponible"}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Rôle actuel</p>
          <Badge variant={role === "super_admin" ? "default" : "secondary"}>
            {role || "utilisateur"}
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Permissions</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              {isSuperAdmin ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              Super Admin
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isAdmin ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              Admin
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isModerator ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              Modérateur
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
