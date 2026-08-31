import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import LocalLogin from "@/pages/LocalLogin";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  Palette,
  Calendar,
  BarChart3,
  Search,
  Bell,
  Settings as SettingsIcon,
  UserCog,
  FileText,
  ChevronRight,
  Home,
  AlertTriangle,
  Package,
  Truck,
  KeyRound,
  TrendingUp,
  Menu,
  X,
  ArrowUpDown,
  Stethoscope,
  MessageSquare,
  BriefcaseBusiness,
  WalletCards,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import GlobalSearch from "./GlobalSearch";

const menuItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: BriefcaseBusiness,
    label: "Operação Comercial",
    path: "/commercial",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: Users,
    label: "Clientes",
    path: "/clients",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: ArrowUpDown,
    label: "Importar / Exportar",
    path: "/contacts/import-export",
    roles: ["superadmin", "admin"],
  },
  {
    icon: Calendar,
    label: "Agenda",
    path: "/schedule",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: Palette,
    label: "Artistas",
    path: "/artists",
    roles: ["superadmin", "admin"],
  },
  {
    icon: Calendar,
    label: "Calendário Visual",
    path: "/calendar",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: BarChart3,
    label: "Relatórios",
    path: "/reports",
    roles: ["superadmin", "admin"],
  },
  {
    icon: TrendingUp,
    label: "Colaboradores",
    path: "/collaborator-reports",
    roles: ["superadmin", "admin"],
  },
  {
    icon: Bell,
    label: "Notificações",
    path: "/notifications",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: MessageSquare,
    label: "Central de Mensagens",
    path: "/messaging",
    roles: ["superadmin", "admin"],
  },
  {
    icon: AlertTriangle,
    label: "Alertas de Risco",
    path: "/risk-alerts",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: Stethoscope,
    label: "POD Session",
    path: "/procedures",
    roles: ["superadmin", "admin", "collaborator"],
  },
  {
    icon: Package,
    label: "Estoque",
    path: "/stock",
    roles: ["superadmin", "admin"],
  },
  {
    icon: WalletCards,
    label: "Custos e Recursos",
    path: "/costs-resources",
    roles: ["superadmin", "admin"],
  },
  {
    icon: Truck,
    label: "Fornecedores",
    path: "/suppliers",
    roles: ["superadmin", "admin"],
  },
  {
    icon: UserCog,
    label: "Usuários",
    path: "/users",
    roles: ["superadmin", "admin"],
  },
  {
    icon: FileText,
    label: "Auditoria",
    path: "/audit",
    roles: ["superadmin", "admin"],
  },
  {
    icon: SettingsIcon,
    label: "Configurações",
    path: "/settings",
    roles: ["superadmin", "admin"],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    const authMode = (import.meta.env.VITE_AUTH_MODE as string) || "local";
    if (authMode === "local") {
      return <LocalLogin onSuccess={() => window.location.reload()} />;
    }
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="flex flex-col items-center gap-8 p-6 sm:p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to
              launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={!isMobile}
      style={
        {
          "--sidebar-width": isMobile ? "280px" : `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, openMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  // Fechar sidebar mobile ao navegar
  const handleNavigate = (path: string) => {
    setLocation(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Atalho de teclado Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  // Resize da sidebar apenas em desktop
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, isMobile]);

  return (
    <>
      {/* Overlay para fechar sidebar em mobile */}
      {isMobile && openMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpenMobile(false)}
          aria-hidden="true"
        />
      )}

      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible={isMobile ? "offcanvas" : "icon"}
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-14 sm:h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              {/* Em mobile: botão X para fechar; em desktop: toggle */}
              {isMobile ? (
                <button
                  onClick={() => setOpenMobile(false)}
                  className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              ) : (
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {!isCollapsed || isMobile ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Palette className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold tracking-tight truncate text-base">
                    POD CRM
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems
                .filter((item) => !user || item.roles.includes(user.role))
                .map((item) => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => handleNavigate(item.path)}
                        tooltip={item.label}
                        className={`h-10 sm:h-10 transition-all font-normal touch-manipulation`}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`}
                        />
                        <span className="text-sm">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation">
                  <Avatar className="h-9 w-9 border shrink-0">
                    {user?.profilePhotoUrl && (
                      <AvatarImage
                        src={user.profilePhotoUrl}
                        alt={`Foto de ${user.name || "usuário"}`}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setChangePasswordOpen(true)}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Trocar senha</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Handle de resize apenas em desktop */}
        {!isMobile && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
            onMouseDown={() => {
              if (isCollapsed) return;
              setIsResizing(true);
            }}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <SidebarInset>
        {/* Header responsivo */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Mobile: botão hambúrguer; Desktop: SidebarTrigger */}
            {isMobile ? (
              <button
                onClick={() => setOpenMobile(true)}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 touch-manipulation"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background flex-shrink-0" />
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate("/")}
                className="flex items-center gap-1.5 h-8 px-2 hover:bg-accent shrink-0 touch-manipulation"
              >
                <Home className="h-4 w-4" />
                {!isMobile && <span className="text-sm">Início</span>}
              </Button>
              {activeMenuItem && activeMenuItem.path !== "/" && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {activeMenuItem.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Botão de busca */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="h-9 w-9 flex-shrink-0 touch-manipulation"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Conteúdo principal com padding responsivo */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}
