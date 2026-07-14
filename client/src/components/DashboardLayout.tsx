import { useAuth } from "@/_core/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, CheckSquare, MessageCircle, Zap, WandSparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: WandSparkles, label: "Build My Team", path: "/build-team" },
  { icon: Users, label: "Agents", path: "/agents" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { icon: MessageCircle, label: "Conversations", path: "/conversations" },
  { icon: Zap, label: "Workflows", path: "/workflows" },
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
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => setAuthOpen(true)}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
          <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      className="harvey-app-shell"
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
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
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item =>
    location === item.path || location.startsWith(`${item.path}/`)
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
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
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border bg-white/65 shadow-[12px_0_42px_rgba(31,52,108,0.06)] backdrop-blur-xl"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-[74px] justify-center border-b border-sidebar-border/80 px-3 group-data-[collapsible=icon]:px-1.5">
            <div className="flex items-center gap-3 transition-all w-full">
              <button
                type="button"
                onClick={toggleSidebar}
                className="harvey-brand-mark h-9 w-9 border-0"
                aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                <Zap className="h-4 w-4 fill-current" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold tracking-[-0.025em]">
                    Hey Harvey Workspace
                  </div>
                  <div className="harvey-section-label mt-0.5 text-[0.55rem]">AI workspace</div>
                </div>
              ) : null}
              {!isCollapsed ? (
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center hover:bg-white rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Collapse navigation"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-5">
            {!isCollapsed && <div className="harvey-section-label px-5 pb-2">Workspace</div>}
            <SidebarMenu className="px-3 py-1">
              {menuItems.map(item => {
                const isActive =
                  location === item.path || location.startsWith(`${item.path}/`);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      tooltip={item.label}
                      className="h-11 rounded-xl px-3 font-semibold transition-all data-[active=true]:bg-white data-[active=true]:text-[#1749bf] data-[active=true]:shadow-[0_7px_20px_rgba(31,52,108,0.09)] hover:bg-white/80"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/80 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-white transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-[#dce5fb] shadow-sm shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-[#dce9ff] to-[#eee5ff] text-xs font-bold text-[#1749bf]">
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
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-transparent">
        {isMobile && (
          <div className="flex border-b border-border/80 h-16 items-center justify-between bg-white/85 px-3 shadow-sm backdrop-blur-xl sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-10 w-10 rounded-xl bg-white" />
              <div className="flex items-center gap-3">
                <div className="harvey-brand-mark h-9 w-9">
                  <Zap className="h-4 w-4 fill-current" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.11em] text-[#1749bf]">Hey Harvey</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="harvey-app-main flex-1">
          <div className="harvey-app-page">{children}</div>
        </main>
      </SidebarInset>
    </>
  );
}
