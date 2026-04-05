import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Search, ShoppingCart, ShoppingBag, User, Menu, X, LayoutDashboard, ArrowLeft, Heart } from "lucide-react";
import { Button } from "../components/Button";
import { useState, useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { categoryService, productService } from "../../services/productService";
import { UserButton, SignInButton, useUser } from "@clerk/react";
import { MapPin, ShoppingBag as OrdersIcon } from "lucide-react";
import AddressesPage from "../pages/profile/AddressesPage";
import OrdersPage from "../pages/profile/OrdersPage";

interface Category { _id: string; name: string; slug: string; }

export default function UserLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin } = useAuth();
  const { isSignedIn } = useUser();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Wishlist count — reads from localStorage, updates on storage events
  const [wishlistCount, setWishlistCount] = useState(0);
  useEffect(() => {
    const read = () => setWishlistCount(JSON.parse(localStorage.getItem("wishlist") ?? "[]").length);
    read();
    window.addEventListener("storage", read);
    // Poll for same-tab changes
    const id = setInterval(read, 500);
    return () => { window.removeEventListener("storage", read); clearInterval(id); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      productService.getProducts({ search: searchQuery.trim(), limit: 8 })
        .then((res) => { setSearchResults(res.data.products ?? []); setSearchOpen(true); })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">ShopZen</span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8" ref={searchRef}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      setSearchQuery(""); setSearchOpen(false);
                    }
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {/* Live search dropdown */}
                {searchOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    {searchLoading ? (
                      <div className="grid grid-cols-2 gap-3 p-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg animate-pulse">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 bg-slate-100 rounded w-3/4" />
                              <div className="h-3 bg-slate-100 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-0 divide-y divide-border">
                          {searchResults.map((p, i) => (
                            <Link
                              key={p._id}
                              to={`/products/${p._id}`}
                              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                              className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "border-r border-border" : ""}`}
                            >
                              <img
                                src={p.images?.[0] || "/placeholder.png"}
                                alt={p.name}
                                className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-muted"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-1">{p.name}</p>
                                <p className="text-sm font-bold text-primary">${p.price.toFixed(2)}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-border">
                          <button
                            onClick={() => { navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); setSearchQuery(""); setSearchOpen(false); }}
                            className="w-full py-2.5 text-sm text-primary font-semibold hover:bg-primary/5 transition-colors"
                          >
                            See all results for "{searchQuery}"
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No products found</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Wishlist */}
              <Link to="/wishlist">
                <Button variant="ghost" size="md" className="relative" title="My Wishlist">
                  <Heart className={`w-5 h-5 ${wishlistCount > 0 ? "fill-red-500 text-red-500" : ""}`} />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {wishlistCount > 9 ? "9+" : wishlistCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/cart">
                <Button variant="ghost" size="md" className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
              {isSignedIn ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="ghost" size="md" title="Admin Panel">
                        <LayoutDashboard className="w-5 h-5" />
                      </Button>
                    </Link>
                  )}
                  <UserButton afterSignOutUrl="/" userProfileMode="modal">
                    <UserButton.UserProfilePage
                      label="My Addresses"
                      url="addresses"
                      labelIcon={<MapPin className="w-4 h-4" />}
                    >
                      <AddressesPage />
                    </UserButton.UserProfilePage>
                    <UserButton.UserProfilePage
                      label="My Orders"
                      url="orders"
                      labelIcon={<OrdersIcon className="w-4 h-4" />}
                    >
                      <OrdersPage />
                    </UserButton.UserProfilePage>
                  </UserButton>
                  <span className="hidden md:block text-sm font-medium text-muted-foreground">
                    {user?.name.split(" ")[0]}
                  </span>
                </div>
              ) : (
                <SignInButton mode="modal">
                  <Button variant="ghost" size="md">
                    <User className="w-5 h-5" />
                  </Button>
                </SignInButton>
              )}
              <button
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery(""); setSearchOpen(false);
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Categories Navigation */}
        <nav className="border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
              {categories.map((category) => {
                const isActive =
                  location.pathname === "/products" &&
                  new URLSearchParams(location.search).get("category") === category.slug;
                return (
                  <Link
                    key={category._id}
                    to={`/products?category=${category.slug}`}
                    className={`relative whitespace-nowrap text-sm font-medium px-4 py-2 rounded-md transition-all duration-150
                      ${isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                  >
                    {category.name}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[128px] bg-background z-40 p-4">
          <nav className="space-y-4">
            {categories.map((category) => (
              <Link
                key={category._id}
                to={`/products?category=${category.slug}`}
                className="block text-lg font-medium hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Back button bar — shown on all non-home pages */}
      {location.pathname !== "/" && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="font-medium">Back</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">About Us</a></li>
                <li><a href="#" className="hover:text-primary">Careers</a></li>
                <li><a href="#" className="hover:text-primary">Press</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Help</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Customer Support</a></li>
                <li><a href="#" className="hover:text-primary">Shipping Info</a></li>
                <li><a href="#" className="hover:text-primary">Returns</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Shop</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">All Products</a></li>
                <li><a href="#" className="hover:text-primary">Categories</a></li>
                <li><a href="#" className="hover:text-primary">Deals</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Facebook</a></li>
                <li><a href="#" className="hover:text-primary">Twitter</a></li>
                <li><a href="#" className="hover:text-primary">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>&copy; 2026 ShopHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
