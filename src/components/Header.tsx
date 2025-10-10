import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";
import { TarifiqueLogo } from "./TarifiqueLogo";
import { useTranslation } from "react-i18next";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
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
      title: t("nav.signOut"),
      description: "À bientôt !",
    });
    navigate("/auth");
  };


  return (
    <header className="border-b glass-card sticky top-0 z-50 bg-gradient-to-r from-purple-500/20 via-purple-600/20 to-purple-700/20 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
        <TarifiqueLogo />
        
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSelector />
          <LanguageSelector />
          
          {user ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!isMobile && t("nav.signOut")}
            </Button>
          ) : (
            <Button onClick={() => navigate("/auth")} size="sm">
              <User className="mr-2 h-4 w-4" />
              {!isMobile && t("nav.signIn")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
