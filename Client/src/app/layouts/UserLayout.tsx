import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router";
import {
  Search,
  ShoppingCart,
  ShoppingBag,
  User,
  LayoutDashboard,
  Heart,
  Truck,
  MapPin,
  HelpCircle,
  ArrowUpRight,
  ArrowRight,
  Home,
  Store,
} from "lucide-react";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { Button } from "../components/Button";
import { ProductImage } from "../components/ProductImage";
import { CatalogCategory, CatalogProduct } from "../components/CatalogUI";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import { categoryService, productService } from "../../services/productService";
import { UserButton, SignInButton, useUser } from "@clerk/react";
import { formatCurrency } from "../../lib/currency";
import AddressesPage from "../pages/profile/AddressesPage";
import OrdersPage from "../pages/profile/OrdersPage";
import HelpSupportPage from "../pages/profile/HelpSupportPage";
import SellProductPage from "../pages/profile/SellProductPage";
import SellerOrdersPage from "../pages/profile/SellerOrdersPage";
import DonateUsPage from "../pages/profile/DonateUsPage";

const SUPPORT_EMAIL = "advitiyaranjan1@gmail.com";
// Pages with their own sticky action bar on phones.
const HIDE_TAB_BAR = [/^\/products\/[^/]+$/, /^\/checkout/, /^\/buy-now/];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="cart-badge">{count > 99 ? "99+" : count}</span>;
}

export default function UserLayout() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const { isAdmin } = useAuth();
  const { isSignedIn } = useUser();
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const showTabBar = !HIDE_TAB_BAR.some((pattern) => pattern.test(location.pathname));

  useEffect(() => {
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  useEffect(() => {
    let current = true;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(false);
    const timer = setTimeout(() => {
      productService
        .getProducts({ search: searchQuery.trim(), limit: 5 })
        .then((res) => {
          if (!current) return;
          setSearchResults(res.data.products ?? []);
          setSearchOpen(true);
        })
        .catch(() => {
          if (!current) return;
          setSearchResults([]);
          setSearchError(true);
          setSearchOpen(true);
        })
        .finally(() => current && setSearchLoading(false));
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    let current = true;
    categoryService
      .getCategories()
      .then((res) => current && setCategories(res.data.categories ?? []))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
    setSearchOpen(false);
  }

  const category = new URLSearchParams(location.search).get("category");
  const onShopAll = location.pathname === "/products" && !category;

  return (
    <div className={`flex min-h-screen flex-col bg-background ${showTabBar ? "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="bg-[#153c37] px-4 py-2 text-center text-xs tracking-wide text-white/90">
        Free standard delivery · Pay when your order arrives
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:px-8 lg:py-4">
          <Link to="/" aria-label="ViswaKart home" className="inline-flex w-fit items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Viswa<span className="text-primary">Kart</span>
              <span className="hidden text-[10px] font-normal uppercase tracking-[0.22em] text-muted-foreground sm:block">
                Discover your everyday
              </span>
            </span>
          </Link>

          <form
            role="search"
            ref={searchRef}
            onSubmit={submitSearch}
            className="relative order-3 col-span-2 lg:order-none lg:col-span-1 lg:mx-5"
            onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setSearchOpen(false);
            }}
          >
            <label htmlFor="store-search" className="sr-only">
              Search products
            </label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              id="store-search"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => searchQuery.trim() && setSearchOpen(true)}
              aria-controls={searchOpen ? "search-suggestions" : undefined}
              aria-expanded={searchOpen}
              className="min-h-12 w-full rounded-xl border border-border bg-muted/60 py-3 pl-11 pr-14 text-base focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-accent"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            {searchOpen && (
              <div
                id="search-suggestions"
                className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
              >
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Products
                </div>
                {searchLoading ? (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    Searching…
                  </p>
                ) : searchError ? (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    Suggestions are unavailable. Press search to try again.
                  </p>
                ) : searchResults.length ? (
                  searchResults.map((product) => (
                    <Link
                      key={product._id}
                      to={`/products/${product._id}`}
                      onClick={() => {
                        setSearchQuery("");
                        setSearchOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                    >
                      <ProductImage src={product.images?.[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{product.name}</span>
                        <span className="text-sm font-semibold text-primary">{formatCurrency(product.price)}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))
                ) : (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    No matching products. Try a different name.
                  </p>
                )}
                <button
                  type="submit"
                  className="min-h-12 w-full border-t border-border px-4 py-3 text-left text-sm font-semibold text-primary hover:bg-accent"
                >
                  View all search results <ArrowRight className="ml-1 inline h-4 w-4" />
                </button>
              </div>
            )}
          </form>

          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <Link to="/wishlist" aria-label={`Wishlist, ${wishlist.length} saved items`} className="header-action hidden md:inline-flex">
              <Heart className="h-5 w-5" />
              <Badge count={wishlist.length} />
            </Link>
            <Link to="/cart" aria-label={`Cart, ${totalItems} items`} className="header-action">
              <ShoppingCart className="h-5 w-5" />
              <Badge count={totalItems} />
            </Link>
            {isAdmin && (
              <Link to="/admin" aria-label="Admin dashboard" title="Admin dashboard" className="header-action">
                <LayoutDashboard className="h-5 w-5" />
              </Link>
            )}
            {isSignedIn ? (
              <div className="flex h-11 min-w-11 items-center justify-center">
                <UserButton userProfileMode="modal">
                  <UserButton.UserProfilePage label="My Orders" url="orders" labelIcon={<ShoppingBag className="h-4 w-4" />}>
                    <OrdersPage />
                  </UserButton.UserProfilePage>
                  <UserButton.UserProfilePage label="My Addresses" url="addresses" labelIcon={<MapPin className="h-4 w-4" />}>
                    <AddressesPage />
                  </UserButton.UserProfilePage>
                  <UserButton.UserProfilePage label="Sell a Product" url="sell" labelIcon={<Store className="h-4 w-4" />}>
                    <SellProductPage />
                  </UserButton.UserProfilePage>
                  <UserButton.UserProfilePage label="Seller Orders" url="seller-orders" labelIcon={<Truck className="h-4 w-4" />}>
                    <SellerOrdersPage />
                  </UserButton.UserProfilePage>
                  <UserButton.UserProfilePage label="Help & Support" url="help" labelIcon={<HelpCircle className="h-4 w-4" />}>
                    <HelpSupportPage />
                  </UserButton.UserProfilePage>
                  <UserButton.UserProfilePage label="Donate Us" url="donate" labelIcon={<Heart className="h-4 w-4" />}>
                    <DonateUsPage />
                  </UserButton.UserProfilePage>
                </UserButton>
              </div>
            ) : (
              <SignInButton mode="modal">
                <Button variant="ghost" className="px-2.5 sm:px-3" aria-label="Sign in">
                  <User className="h-5 w-5" />
                  <span className="hidden lg:inline">Sign in</span>
                </Button>
              </SignInButton>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <nav aria-label="Shop categories" className="border-t border-border/70">
            <div className="scrollbar-hide mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
              <Link to="/products" className={`category-nav ${onShopAll ? "active" : ""}`} aria-current={onShopAll ? "page" : undefined}>
                Shop all
              </Link>
              {categories.map((item) => (
                <Link
                  key={item._id}
                  to={`/products?category=${encodeURIComponent(item.slug)}`}
                  className={`category-nav ${category === item.slug ? "active" : ""}`}
                  aria-current={category === item.slug ? "page" : undefined}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-border bg-white">
        <div className="mx-auto grid max-w-7xl gap-9 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[2fr_1fr_1fr] lg:px-8 lg:py-14">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold">
              <ShoppingBag className="h-6 w-6 text-primary" />
              ViswaKart
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Find something for your everyday. Explore the collection, save your favourites, and pay when your order arrives.
            </p>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Make yourself at home</h2>
            <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
              <Link className="py-2 hover:text-primary" to="/products">
                Shop all products
              </Link>
              <Link className="py-2 hover:text-primary" to="/wishlist">
                Your wishlist
              </Link>
              <Link className="py-2 hover:text-primary" to="/cart">
                Your shopping cart
              </Link>
              <Link className="py-2 hover:text-primary" to="/account#/orders">
                Your orders
              </Link>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">We're here to help</h2>
            <p className="mb-2 text-sm text-muted-foreground">Questions about an order or a product?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
              Email our team
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href="tel:+919430435643" className="block py-2 text-sm text-muted-foreground">
              +91 94304 35643
            </a>
          </div>
        </div>
        <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ViswaKart. All rights reserved.
        </div>
      </footer>

      {showTabBar && (
        <nav
          aria-label="Quick navigation"
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pt-1.5 backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5">
            {[
              { to: "/", label: "Home", icon: Home, end: true, count: 0 },
              { to: "/products", label: "Shop", icon: Store, end: false, count: 0 },
              { to: "/wishlist", label: "Saved", icon: Heart, end: false, count: wishlist.length },
              { to: "/cart", label: "Cart", icon: ShoppingCart, end: false, count: totalItems },
              { to: "/account", label: "Account", icon: User, end: false, count: 0 },
            ].map(({ to, label, icon: Icon, end, count }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`
                }
              >
                <span className="relative flex h-7 w-10 items-center justify-center">
                  <Icon className="h-5 w-5" />
                  {count > 0 && <span className="cart-badge -right-0.5 -top-1">{count > 99 ? "99+" : count}</span>}
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
