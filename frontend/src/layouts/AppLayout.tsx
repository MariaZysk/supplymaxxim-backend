import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

export default function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-x-hidden">
            <div className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
