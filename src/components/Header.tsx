import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, History, Database, Layers, TrendingUp, Menu, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Déconnecté",
      description: "À bientôt !",
    });
    setIsOpen(false);
    navigate("/auth");
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const NavButtons = () => (
    <>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/dashboard")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <Database className="mr-2 h-4 w-4" />
        Dashboard
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/history")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <History className="mr-2 h-4 w-4" />
        Historique
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/batch-analyzer")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <Layers className="mr-2 h-4 w-4" />
        Analyse en Lot
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/market-intelligence")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <TrendingUp className="mr-2 h-4 w-4" />
        Intelligence Marché
      </Button>
      <Button 
        variant="ghost" 
        size={isMobile ? "default" : "sm"} 
        onClick={handleSignOut}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Déconnexion
      </Button>
    </>
  );

  return (
    <header className="border-b glass-card sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-primary to-secondary" />
          <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            E-commerce AI
          </h1>
        </div>
        
        {isMobile ? (
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <nav className="flex flex-col gap-2 mt-8">
                {user ? (
                  <NavButtons />
                ) : (
                  <Button onClick={() => handleNavigate("/auth")} className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Connexion
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        ) : (
          <nav className="flex items-center gap-4">
            {user ? (
              <NavButtons />
            ) : (
              <Button onClick={() => navigate("/auth")}>
                <User className="mr-2 h-4 w-4" />
                Connexion
              </Button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
