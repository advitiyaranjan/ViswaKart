import { createBrowserRouter } from "react-router";
import UserLayout from "./layouts/UserLayout";
import Homepage from "./pages/Homepage";
import ProductListing from "./pages/ProductListing";
import ProductDetail from "./pages/ProductDetail";
import SearchResults from "./pages/SearchResults";
import Cart from "./pages/Cart";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import GoogleCallback from "./pages/GoogleCallback";
import Checkout from "./pages/Checkout";
import BuyNow from "./pages/BuyNow";
import NotFound from "./pages/NotFound";
import Wishlist from "./pages/Wishlist";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Account from "./pages/Account";

// The admin area (and its charting library) is loaded only when an admin opens it,
// keeping the storefront bundle small for shoppers on phones.
const lazyPage = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

export const router = createBrowserRouter([
  {
    path: "/",
    Component: UserLayout,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: Homepage },
      { path: "products", Component: ProductListing },
      { path: "products/:id", Component: ProductDetail },
      { path: "search", Component: SearchResults },
      { path: "cart", Component: Cart },
      { path: "wishlist", Component: Wishlist },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "auth/google/callback", Component: GoogleCallback },
      // Protected user routes
      {
        Component: ProtectedRoute,
        children: [
          { path: "checkout", Component: Checkout },
          { path: "buy-now", Component: BuyNow },
          { path: "account", Component: Account },
        ],
      },
    ],
  },
  {
    // The admin check wraps the layout so non-admins never see the admin shell.
    path: "/admin",
    Component: () => <ProtectedRoute adminOnly />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        lazy: lazyPage(() => import("./layouts/AdminLayout")),
        children: [
          { index: true, lazy: lazyPage(() => import("./pages/admin/Dashboard")) },
          { path: "products", lazy: lazyPage(() => import("./pages/admin/ProductManagement")) },
          { path: "categories", lazy: lazyPage(() => import("./pages/admin/CategoryManagement")) },
          { path: "orders", lazy: lazyPage(() => import("./pages/admin/OrderManagement")) },
          { path: "users", lazy: lazyPage(() => import("./pages/admin/UserManagement")) },
          { path: "seller-requests", lazy: lazyPage(() => import("./pages/admin/SellerRequests")) },
          { path: "support", lazy: lazyPage(() => import("./pages/admin/SupportMessages")) },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
