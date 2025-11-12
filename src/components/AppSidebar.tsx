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
  ArrowLeftRight,
  Sparkles,
  PackageSearch,
  FileSpreadsheet,
  FileUp,
  Layers,
  Bot,
  Plug,
  MessageSquare,
  Brain,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnlinkedProductsCount } from "@/hooks/useUnlinkedProductsCount";
import { Badge } from "@/components/ui/badge";

const mainNavigation = [
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard,
    description: "Vue d'ensemble de votre activité et statistiques principales"
  },
  { 
    title: "Historique", 
    url: "/history", 
    icon: History,
    description: "Consultez l'historique de toutes vos analyses de produits"
  },
  { 
    title: "Analyse par lots", 
    url: "/batch-analyzer", 
    icon: Package,
    description: "Analysez plusieurs produits simultanément en batch"
  },
];

const supplierNavigation = [
  { 
    title: "Produits", 
    url: "/products", 
    icon: PackageSearch,
    description: "Gérez tous vos produits : filtrage, enrichissement et export"
  },
  { 
    title: "Fournisseurs", 
    url: "/suppliers", 
    icon: Truck,
    description: "Gérez vos fournisseurs et leurs catalogues"
  },
  { 
    title: "Produits Importés", 
    url: "/imported-products", 
    icon: Package,
    description: "Visualisez tous les produits importés depuis vos fournisseurs"
  },
  { 
    title: "Import/Export", 
    url: "/import-export-dashboard", 
    icon: ArrowLeftRight,
    description: "Importez et exportez vos données vers différentes plateformes"
  },
];

const enrichmentNavigation = [
  { 
    title: "Suivi Code2ASIN", 
    url: "/code2asin-tracker", 
    icon: Package,
    description: "Suivez vos exports et imports d'enrichissements Amazon"
  },
  { 
    title: "Export Code2ASIN", 
    url: "/code2asin-export", 
    icon: FileSpreadsheet,
    description: "Exportez vos EAN pour enrichissement externe via code2asin.com"
  },
  { 
    title: "Import Code2ASIN", 
    url: "/code2asin-import", 
    icon: FileUp,
    description: "Importez les données enrichies depuis code2asin.com"
  },
  { 
    title: "Produits Code2ASIN", 
    url: "/code2asin-products", 
    icon: Package,
    description: "Tous les produits enrichis Code2ASIN (52 champs)"
  },
];

const marketNavigation = [
  { 
    title: "Intelligence Marché", 
    url: "/market-intelligence", 
    icon: TrendingUp,
    description: "Analysez la concurrence et surveillez les prix du marché"
  },
  { 
    title: "Analytics", 
    url: "/analytics", 
    icon: BarChart3,
    description: "Tableaux de bord et métriques détaillées de performance"
  },
];

const aiNavigation = [
  { 
    title: "Chat RAG Gemini", 
    url: "/gemini-rag", 
    icon: Bot,
    description: "Posez des questions en langage naturel sur votre catalogue complet avec RAG natif",
    badge: "NEW"
  },
  { 
    title: "MCP Integrations", 
    url: "/mcp-dashboard", 
    icon: Plug,
    description: "Gérez vos connexions aux plateformes externes (Odoo, PrestaShop, Amazon, etc.)"
  },
  { 
    title: "MCP Chat", 
    url: "/mcp-chat", 
    icon: MessageSquare,
    description: "Interrogez vos plateformes connectées en langage naturel avec l'IA"
  },
];

const configNavigation = [
  { 
    title: "Tarifs", 
    url: "/pricing", 
    icon: CreditCard,
    description: "Consultez les plans tarifaires et gérez votre abonnement"
  },
  { 
    title: "Contact", 
    url: "/contact", 
    icon: Mail,
    description: "Contactez notre équipe support pour toute question"
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  const { data: unlinkedCount } = useUnlinkedProductsCount();
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Déconnecté avec succès" });
    navigate("/auth");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive("/unified-products")}>
                        <NavLink to="/unified-products">
                          <Layers />
                          <span className="flex items-center gap-2">
                            Gestion Unifiée
                            {unlinkedCount && unlinkedCount > 0 && (
                              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                {unlinkedCount}
                              </Badge>
                            )}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">Gestion Unifiée</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vue unifiée de toutes vos bases produits avec fusion automatique par EAN
                      </p>
                      {unlinkedCount && unlinkedCount > 0 && (
                        <p className="text-xs font-semibold text-destructive mt-2">
                          ⚠️ {unlinkedCount} produit(s) non lié(s)
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive("/wizard")}>
                        <NavLink to="/wizard">
                          <Sparkles />
                          <span>Wizard Universel</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">Wizard Universel</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Assistant intelligent pour importer, enrichir et exporter vos produits
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Intelligence IA Section */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Brain className="h-4 w-4 mr-2 inline" />
            Intelligence IA
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span className="flex items-center gap-2">
                            {item.title}
                            {item.badge && (
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                {item.badge}
                              </Badge>
                            )}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Analyse</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavigation.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={isActive(item.url)}>
                          <NavLink to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      </TooltipContent>
                    </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Enrichissement</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {enrichmentNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
              
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={isActive("/admin")}>
                        <NavLink to="/admin">
                          <Settings />
                          <span>Administration</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-semibold">Administration</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Panneau d'administration : gestion des utilisateurs, plans, et configuration système
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton onClick={handleSignOut}>
                      <LogOut />
                      <span>Déconnexion</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[250px]">
                    <p className="font-semibold">Déconnexion</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Se déconnecter de votre compte et retourner à la page de connexion
                    </p>
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    </TooltipProvider>
  );
}
