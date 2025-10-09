import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, History, Database, Layers, TrendingUp, Menu, X, DollarSign, Shield, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";
import { TartriqueLogo } from "./TartriqueLogo";
import { useTranslation } from "react-i18next";
import { useUserRole } from "@/hooks/useUserRole";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Header = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { isSuperAdmin } = useUserRole();

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
        {t("nav.dashboard")}
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/history")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <History className="mr-2 h-4 w-4" />
        {t("nav.history")}
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/batch-analyzer")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <Layers className="mr-2 h-4 w-4" />
        {t("nav.batchAnalyzer")}
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/market-intelligence")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <TrendingUp className="mr-2 h-4 w-4" />
        {t("nav.marketIntelligence")}
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/pricing")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <DollarSign className="mr-2 h-4 w-4" />
        {t("nav.pricing")}
      </Button>
      <Button
        variant="ghost"
        size={isMobile ? "default" : "sm"}
        onClick={() => handleNavigate("/contact")}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <Mail className="mr-2 h-4 w-4" />
        Contact
      </Button>
      {isSuperAdmin && (
        <Button
          variant="ghost"
          size={isMobile ? "default" : "sm"}
          onClick={() => handleNavigate("/admin")}
          className={isMobile ? "w-full justify-start" : ""}
        >
          <Shield className="mr-2 h-4 w-4" />
          Administration
        </Button>
      )}
      <Button 
        variant="ghost" 
        size={isMobile ? "default" : "sm"} 
        onClick={handleSignOut}
        className={isMobile ? "w-full justify-start" : ""}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t("nav.signOut")}
      </Button>
    </>
  );

  return (
    <header className="border-b glass-card sticky top-0 z-50 bg-gradient-to-r from-purple-500/20 via-purple-600/20 to-purple-700/20 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
        <TartriqueLogo />
        
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSelector />
          <LanguageSelector />
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
                      {t("nav.signIn")}
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          ) : (
            <nav className="flex items-center gap-2">
              {user ? (
                <NavButtons />
              ) : (
                <Button onClick={() => navigate("/auth")} size="sm">
                  <User className="mr-2 h-4 w-4" />
                  {t("nav.signIn")}
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
