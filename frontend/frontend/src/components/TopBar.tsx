import { Bell, Search, Sparkles, ChevronDown } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { DataModeSwitcher } from "./DataModeSwitcher";

export function TopBar() {
  const navigate = useNavigate();
  return (
    <header className="h-16 shrink-0 border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-30">
      <div className="h-full flex items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1 rounded-md border border-border/60 bg-card/50">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</span>
          <span className="text-xs font-medium">Spheremaxxing Intelligence Console</span>
        </div>

        <div className="flex-1 max-w-xl mx-auto relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search BOMs, materials, suppliers, SKUs…"
            className="pl-9 h-10 bg-secondary/40 border-border/60 focus-visible:ring-primary/40"
          />
          <kbd className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <DataModeSwitcher className="hidden sm:inline-flex" />

          <Badge
            variant="outline"
            className="hidden lg:flex gap-1.5 border-success/40 bg-success/10 text-success-foreground px-2.5 py-1"
          >
            <Sparkles className="h-3 w-3" style={{ color: "hsl(var(--success))" }} />
            <span className="text-[11px] font-medium" style={{ color: "hsl(var(--success))" }}>AI Engine Active</span>
          </Badge>

          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-secondary/60 transition-colors">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
                    AM
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-xs font-medium">Avery Mensah</div>
                  <div className="text-[10px] text-muted-foreground">Procurement Lead</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Workspace Settings</DropdownMenuItem>
              <DropdownMenuItem>API Tokens</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/")}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
