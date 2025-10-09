import { 
  LayoutDashboard, 
  History, 
  Package, 
  TrendingUp, 
  Truck, 
  CreditCard,
  Mail,
  Settings,
  LogOut,
  BarChart3,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const mainNavigation = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Historique", url: "/history", icon: History },
  { title: "Analyse par lots", url: "/batch-analyzer", icon: Package },
];

const supplierNavigation = [
  { title: "Fournisseurs", url: "/suppliers", icon: Truck },
  { title: "Produits Importés", url: "/imported-products", icon: Package },
];

const marketNavigation = [
  { title: "Intelligence Marché", url: "/market-intelligence", icon: TrendingUp },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const configNavigation = [
  { title: "Tarifs", url: "/pricing", icon: CreditCard },
  { title: "Contact", url: "/contact", icon: Mail },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Déconnecté avec succès" });
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Analyse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Fournisseurs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supplierNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Marché</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")}>
                    <NavLink to="/admin">
                      <Settings />
                      <span>Administration</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Profil</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut />
                  <span>Déconnexion</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
