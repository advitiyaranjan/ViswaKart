import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, FolderTree } from "lucide-react";
import { Button } from "../../components/Button";
import { categoryService } from "../../../services/productService";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormValues } from "../../../lib/validationSchemas";

interface Category {
  _id: string;
  name: string;
  description?: string;
  productCount?: number;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
  });

  const loadCategories = async () => {
    const res = await categoryService.getCategories();
    setCategories(res.data.categories);
  };

  useEffect(() => { loadCategories(); }, []);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAdd = () => {
    setEditingCategory(null);
    reset({ name: "", description: "" });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    reset({ name: cat.name, description: cat.description || "" });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await categoryService.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c._id !== id));
  };

  const handleSave = async (data: CategoryFormValues) => {
    setSaving(true);
    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory._id, data);
      } else {
        await categoryService.createCategory(data);
      }
      setShowModal(false);
      loadCategories();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Category Management</h1>
          <p className="text-muted-foreground">Organize your product categories</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((category) => (
          <div
            key={category._id}
            className="bg-white rounded-xl border border-border p-6 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FolderTree className="w-6 h-6 text-primary" />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                  onClick={() => openEdit(category)}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                  onClick={() => handleDelete(category._id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">{category.name}</h3>
            <p className="text-sm text-muted-foreground">
              {category.productCount ?? 0} products
            </p>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-2xl font-bold">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h2>
            </div>

            <form className="p-6 space-y-6" onSubmit={handleSubmit(handleSave)}>
              <div>
                <label className="block mb-2 font-medium">Category Name</label>
                <input
                  type="text"
                  placeholder="Enter category name"
                  {...register("name")}
                  className={`w-full px-4 py-2 bg-input-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${errors.name ? "border-destructive" : "border-input"}`}
                />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block mb-2 font-medium">Description</label>
                <textarea
                  rows={3}
                  placeholder="Enter category description"
                  {...register("description")}
                  className="w-full px-4 py-2 bg-input-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="primary" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : editingCategory ? "Update Category" : "Add Category"}
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


