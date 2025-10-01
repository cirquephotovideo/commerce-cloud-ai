import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Twitter, Facebook, Instagram, Linkedin, Youtube, Plus } from "lucide-react";
import { toast } from "sonner";
import { PostScheduler } from "./PostScheduler";

export const SocialMediaManager = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [showScheduler, setShowScheduler] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, postsRes] = await Promise.all([
        supabase.from("social_media_accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("social_media_posts").select("*, account:social_media_accounts(*)").order("created_at", { ascending: false })
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (postsRes.error) throw postsRes.error;

      setAccounts(accountsRes.data || []);
      setPosts(postsRes.data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des données");
      console.error(error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, any> = {
      twitter: Twitter,
      facebook: Facebook,
      instagram: Instagram,
      linkedin: Linkedin,
      youtube: Youtube
    };
    return icons[platform] || Twitter;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      scheduled: "default",
      published: "default",
      failed: "destructive"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Réseaux Sociaux</h2>
          <p className="text-muted-foreground">
            Gérez vos comptes et publications sur les réseaux sociaux
          </p>
        </div>
        <Button onClick={() => setShowScheduler(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau post
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {["twitter", "facebook", "instagram", "linkedin", "youtube"].map((platform) => {
          const Icon = getPlatformIcon(platform);
          const count = accounts.filter((a) => a.platform === platform).length;
          return (
            <Card key={platform}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium capitalize">{platform}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">compte(s) connecté(s)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publications récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plateforme</TableHead>
                <TableHead>Contenu</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Programmé pour</TableHead>
                <TableHead>Publié le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const Icon = getPlatformIcon(post.account?.platform || "twitter");
                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{post.account?.platform}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{post.content}</TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      {post.scheduled_at
                        ? new Date(post.scheduled_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PostScheduler
        open={showScheduler}
        onOpenChange={setShowScheduler}
        onSuccess={fetchData}
        accounts={accounts}
      />
    </div>
  );
};