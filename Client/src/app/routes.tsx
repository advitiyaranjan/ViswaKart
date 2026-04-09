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
import Account from "./pages/Account";
import AdminDashboard from "./pages/admin/Dashboard";
import ProductManagement from "./pages/admin/ProductManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import UserManagement from "./pages/admin/UserManagement";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: UserLayout,
    children: [
      { index: true, Component: Homepage },
      { path: "products", Component: ProductListing },
      { path: "products/:id", Component: ProductDetail },
      { path: "search", Component: SearchResults },
      { path: "cart", Component: Cart },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "auth/google/callback", Component: GoogleCallback },
      // Protected user routes
      {
        Component: ProtectedRoute,
        children: [
          { path: "account", Component: Account },
          { path: "checkout", Component: Checkout },
        ],
      },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
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
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
