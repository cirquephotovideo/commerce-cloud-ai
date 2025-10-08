import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Search, UserPlus, Shield } from "lucide-react";
import { CreateUserDialog } from "./CreateUserDialog";
import { EditRoleDialog } from "./EditRoleDialog";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role?: string;
  subscription?: Array<{
    user_id: string;
    status: string;
    subscription_plans: {
      name: string;
    };
  }>;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const { toast } = useToast();
  const { isSuperAdmin } = useUserRole();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Récupérer les profils
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Récupérer les rôles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Récupérer les abonnements séparément (peut échouer sans bloquer)
      const { data: subscriptionsData } = await supabase
        .from("user_subscriptions")
        .select(`
          user_id,
          status,
          subscription_plans (name)
        `);

      // Mapper les données
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      const subscriptionsMap = new Map(
        subscriptionsData?.map(s => [s.user_id, s]) || []
      );
      
      const usersWithData = (profilesData || []).map(user => {
        const subscription = subscriptionsMap.get(user.id);
        return {
          ...user,
          role: rolesMap.get(user.id) || "user",
          subscription: subscription ? [subscription] : []
        };
      });

      setUsers(usersWithData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="secondary">Free</Badge>;
    
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Trial</Badge>;
      case "canceled":
        return <Badge variant="destructive">Canceled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Gestion des Utilisateurs</CardTitle>
            <div className="flex items-center gap-2">
              {!isSuperAdmin && (
                <Badge variant="secondary" className="text-xs">
                  👀 Lecture seule
                </Badge>
              )}
              {isSuperAdmin && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Créer un compte
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher par email ou nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                      {user.role === "super_admin" ? "Super Admin" : 
                       user.role === "admin" ? "Admin" : 
                       user.role === "moderator" ? "Modérateur" : "Utilisateur"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(user.subscription as any)?.[0]?.subscription_plans?.name || "Free"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge((user.subscription as any)?.[0]?.status)}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {isSuperAdmin && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedUser({ id: user.id, email: user.email, role: user.role || "user" });
                            setEditRoleDialogOpen(true);
                          }}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Rôle
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun utilisateur trouvé
          </div>
        )}
      </CardContent>
    </Card>

    <CreateUserDialog 
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
      onSuccess={fetchUsers}
    />

    <EditRoleDialog
      open={editRoleDialogOpen}
      onOpenChange={setEditRoleDialogOpen}
      userId={selectedUser?.id || null}
      userEmail={selectedUser?.email || ""}
      currentRole={selectedUser?.role || "user"}
      onSuccess={fetchUsers}
    />
    </>
  );
};
