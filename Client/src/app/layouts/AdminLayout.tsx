import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Store,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { UserButton, useClerk, useUser } from "@clerk/react";

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/categories", label: "Categories", icon: FolderTree },
  { path: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/support", label: "Support", icon: MessageCircle },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-white border-r border-border transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-0 md:w-20"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <span className="text-lg font-bold tracking-tight text-foreground">ViswaKart</span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            {sidebarOpen && (
              <div className="px-4 py-2 text-sm text-muted-foreground truncate">{user?.name}</div>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 w-full px-4 py-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Back</span>
            </button>
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="View Store"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">View Store</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Logout</span>
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
