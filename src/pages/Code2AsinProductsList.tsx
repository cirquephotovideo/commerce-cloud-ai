import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { ImportedProductsList } from "@/components/code2asin/ImportedProductsList";
import { supabase } from "@/integrations/supabase/client";

export default function Code2AsinProductsList() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl">
            <Package className="h-8 w-8" />
            Produits Code2ASIN
          </CardTitle>
          <CardDescription>
            Tous vos produits enrichis via code2asin.com avec les 52 champs détaillés
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {user ? (
            <ImportedProductsList userId={user.id} />
          ) : (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}