import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeSelector } from "@/components/ThemeSelector";
import { LanguageSelector } from "@/components/LanguageSelector";
import { TarifiqueLogo } from "@/components/TarifiqueLogo";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full min-w-0">
          {/* Header minimal */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-12 sm:h-14 md:h-16 items-center justify-between px-2 sm:px-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <SidebarTrigger className="shrink-0" />
                <div className="hidden sm:block">
                  <TarifiqueLogo />
                </div>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2">
                <ThemeSelector />
                <LanguageSelector />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
