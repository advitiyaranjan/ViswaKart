import { Outlet, Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Menu,
  LogOut,
  Store,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { UserButton, useClerk } from "@clerk/react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../components/ui/sheet";

const navItems = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/categories", label: "Categories", icon: FolderTree },
  { path: "/admin/users", label: "Customers & team", icon: Users },
  { path: "/admin/seller-requests", label: "Seller requests", icon: UserRoundCheck },
  { path: "/admin/support", label: "Support inbox", icon: MessageCircle },
];

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useClerk();
  const current = navItems.find((item) => item.path === location.pathname);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const navigation = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-3 px-6 py-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-slate-950">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-xl font-bold tracking-tight text-white">
            ViswaKart<span className="text-teal-400">.</span>
          </span>
          <span className="text-xs text-slate-400">Store management</span>
        </span>
      </Link>
      <p className="px-6 pb-3 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
      <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-teal-400/15 text-teal-300" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-4 w-4" />}
            </Link>
          );
        })}
      </nav>
      <div className="safe-bottom m-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-teal-300">
          <ShieldCheck className="h-4 w-4" />
          Administrator workspace
        </div>
        <p className="truncate text-sm font-semibold text-white">{user?.name || "Administrator"}</p>
        <p className="mt-1 truncate text-xs text-slate-400">{user?.email}</p>
        <button
          onClick={() => void signOut({ redirectUrl: "/" })}
          className="mt-3 flex min-h-10 items-center gap-2 text-xs text-slate-300 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-900">
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#122a2c] lg:block">{navigation}</aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[min(85vw,300px)] border-0 bg-[#122a2c] p-0 text-white [&>button]:text-white">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate the store management workspace.</SheetDescription>
          {navigation}
        </SheetContent>
      </Sheet>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:h-[72px] sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open admin navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-slate-400 sm:inline">Workspace</span>
            <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
            <span className="truncate text-sm font-semibold">{current?.label || "Administration"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/"
              className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium transition-colors hover:border-teal-500 hover:text-teal-700"
            >
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">View store</span>
              <span className="sr-only sm:hidden">View store</span>
            </Link>
            <UserButton />
          </div>
        </header>
        <main id="admin-main" className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
