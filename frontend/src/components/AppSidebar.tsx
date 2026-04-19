import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Network,
  Repeat,
  BrainCircuit,
  BarChart3,
  Settings,
  FileStack,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Procurement Search", url: "/app/search", icon: Search },
  { title: "BOM Explorer", url: "/app/bom", icon: FileStack },
  { title: "Supplier Intelligence", url: "/app/suppliers", icon: Network },
  { title: "Substitution Engine", url: "/app/substitution", icon: Repeat },
  { title: "Decision Support", url: "/app/decisions", icon: BrainCircuit },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
];

const bottomNav = [{ title: "Settings", url: "/app/settings", icon: Settings }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderItem = (item: (typeof mainNav)[number]) => {
    const isActive =
      item.end ? location.pathname === item.url : location.pathname.startsWith(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          tooltip={item.title}
          className={cn(
            "h-10 rounded-lg transition-all",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/30 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
              : "hover:bg-sidebar-accent/60 text-sidebar-foreground",
          )}
        >
          <NavLink to={item.url} end={item.end}>
            <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-primary")} />
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
            {isActive && !collapsed && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <Logo showWordmark={!collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 px-2">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{mainNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu className="gap-1">{bottomNav.map(renderItem)}</SidebarMenu>
        {!collapsed && (
          <div className="mt-3 mx-1 rounded-lg p-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="status-dot bg-success animate-pulse-glow" />
              <span className="text-[11px] font-medium text-foreground">AI Engine Active</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
              v2.4 · 9,421 inferences this month
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
