import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "../../components/Button";
import { productService, categoryService } from "../../../services/productService";
import { Link } from "react-router";
import { formatCurrency } from "../../../lib/currency";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, ProductFormValues } from "../../../lib/validationSchemas";

interface Category { _id: string; name: string; }
interface Product {
  _id: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  ratings: number;
  numReviews: number;
  images: string[];
  description: string;
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onBlur",
  });

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    const params: Record<string, unknown> = { limit: 50 };
    if (searchQuery) params.search = searchQuery;
    if (selectedCategory) params.category = selectedCategory;
    const res = await productService.getProducts(params);
    setProducts(res.data.products);
    setIsLoading(false);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
  }, []);

  const openAdd = () => {
    setEditingProduct(null);
    reset({ name: "", category: "", price: undefined as any, stock: undefined as any, description: "" });
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    reset({
      name: product.name,
      category: product.category?._id || "",
      price: product.price,
      stock: product.stock,
      description: product.description,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await productService.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p._id !== id));
  };

  const handleSubmit2 = async (data: ProductFormValues) => {
    setSaving(true);
    try {
      const payload = { name: data.name, category: data.category, price: data.price, stock: data.stock, description: data.description };
      if (editingProduct) {
        await productService.updateProduct(editingProduct._id, payload);
      } else {
        await productService.createProduct(payload);
      }
      setShowModal(false);
      loadProducts();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Product Management</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium">Product</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Category</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Price</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Stock</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Rating</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : products.map((product) => (
                <tr key={product._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images[0] || "/placeholder.png"}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.numReviews} reviews
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{product.category?.name}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(product.price)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        product.stock > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.stock > 0 ? `In Stock (${product.stock})` : "Out of Stock"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{product.ratings.toFixed(1)}</span>
                      <span className="text-muted-foreground">/5</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/products/${product._id}`} className="p-2 hover:bg-accent rounded-lg transition-colors block">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                        onClick={() => openEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                        onClick={() => handleDelete(product._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-2xl font-bold">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
            </div>

            <form className="p-6 space-y-6" onSubmit={handleSubmit(handleSubmit2)}>
              <div>
                <label className="block mb-2 font-medium">Product Name</label>
                <input
                  type="text"
                  placeholder="Enter product name"
                  {...register("name")}
                  className={`w-full px-4 py-2 bg-input-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${errors.name ? "border-destructive" : "border-input"}`}
                />
                {errors.name ? <p className="text-destructive text-xs mt-1">{errors.name.message}</p> : <p className="text-muted-foreground text-xs mt-1">Min 2 characters</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Category</label>
                  <select
                    {...register("category")}
                    className={`w-full px-4 py-2 bg-input-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${errors.category ? "border-destructive" : "border-input"}`}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-destructive text-xs mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="block mb-2 font-medium">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("price", { valueAsNumber: true })}
                    className={`w-full px-4 py-2 bg-input-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${errors.price ? "border-destructive" : "border-input"}`}
                  />
                  {errors.price ? <p className="text-destructive text-xs mt-1">{errors.price.message}</p> : <p className="text-muted-foreground text-xs mt-1">e.g. 9.99 (greater than 0)</p>}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium">Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  {...register("stock", { valueAsNumber: true })}
                  className={`w-full px-4 py-2 bg-input-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${errors.stock ? "border-destructive" : "border-input"}`}
                />
                {errors.stock ? <p className="text-destructive text-xs mt-1">{errors.stock.message}</p> : <p className="text-muted-foreground text-xs mt-1">Whole number ≥ 0</p>}
              </div>

              <div>
                <label className="block mb-2 font-medium">Description</label>
                <textarea
                  rows={4}
                  placeholder="Enter product description"
                  {...register("description")}
                  className="w-full px-4 py-2 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="primary" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
                </Button>
                <Button variant="outline" className="flex-1" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


