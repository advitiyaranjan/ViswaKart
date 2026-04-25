import { createBrowserRouter } from "react-router";
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";
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
import AdminDashboard from "./pages/admin/Dashboard";
import ProductManagement from "./pages/admin/ProductManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import UserManagement from "./pages/admin/UserManagement";
import SupportMessages from "./pages/admin/SupportMessages";
import SellerRequests from "./pages/admin/SellerRequests";
import NotFound from "./pages/NotFound";
import Wishlist from "./pages/Wishlist";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

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
        ],
      },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    errorElement: <ErrorBoundary />,
    children: [
      // All admin routes require authentication + admin role
      {
        Component: () => <ProtectedRoute adminOnly />,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "products", Component: ProductManagement },
          { path: "categories", Component: CategoryManagement },
          { path: "orders", Component: OrderManagement },
              { path: "users", Component: UserManagement },
              { path: "seller-requests", Component: SellerRequests },
          { path: "support", Component: SupportMessages },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
