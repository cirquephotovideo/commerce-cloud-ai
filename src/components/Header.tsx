import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";
import { TarifiqueLogo } from "./TarifiqueLogo";
import { useTranslation } from "react-i18next";
import { useAuthRefresh } from "@/hooks/useAuthRefresh";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { refreshSession, isRefreshing } = useAuthRefresh();

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
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 md:py-4 flex justify-between items-center">
        <TarifiqueLogo />
        
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
          <ThemeSelector />
          <LanguageSelector />
          
          {user ? (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={refreshSession}
                disabled={isRefreshing}
                className="shrink-0"
                title="Rafraîchir la session"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="ghost" 
                size={isMobile ? "icon" : "sm"}
                onClick={handleSignOut}
                className="shrink-0"
              >
                <LogOut className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                {!isMobile && <span className="hidden md:inline">{t("nav.signOut")}</span>}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => navigate("/auth")} 
              size={isMobile ? "icon" : "sm"}
              className="shrink-0"
            >
              <User className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
              {!isMobile && <span className="hidden md:inline">{t("nav.signIn")}</span>}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
