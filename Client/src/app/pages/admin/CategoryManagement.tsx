import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, FolderTree, ArrowUpRight } from "lucide-react";
import { Button } from "../../components/Button";
import { categoryService } from "../../../services/productService";
import { Link } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { PageHeading, ErrorNotice, EmptyState, inputClass, panelClass, actionClass, errorMessage } from "./AdminUI";
interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  productCount?: number;
}
export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await categoryService.getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load categories."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = categories.filter((item) =>
    `${item.name} ${item.description || ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const openEditor = (category?: Category) => {
    setEditing(category || null);
    setName(category?.name || "");
    setDescription(category?.description || "");
    setFormError("");
    setShowModal(true);
  };
  const remove = async (category: Category) => {
    if (!window.confirm(`Remove the “${category.name}” category? Categories with active products must be emptied first.`)) return;
    setDeleting(category._id);
    try {
      await categoryService.deleteCategory(category._id);
      await load();
      toast.success("Category removed");
    } catch (err) {
      toast.error(errorMessage(err, "The category could not be removed."));
    } finally {
      setDeleting(null);
    }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setFormError("Enter a category name with at least two characters.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: name.trim(), description: description.trim() };
      if (editing) await categoryService.updateCategory(editing._id, payload);
      else await categoryService.createCategory(payload);
      setShowModal(false);
      await load();
      toast.success(editing ? "Category updated" : "Category added");
    } catch (err) {
      setFormError(errorMessage(err, "The category could not be saved."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeading
        title="Categories"
        description="Make your catalog easy to explore with clear, useful collections."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />
      <div className={`${panelClass} p-4`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="Search categories"
            type="search"
            placeholder="Find a category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>
      {error && <ErrorNotice message={error} retry={load} />}
      {loading ? (
        <div className={panelClass}>
          <EmptyState loading />
        </div>
      ) : error ? null : filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState
            title={search ? "No matching categories" : "Start with a category"}
            description={search ? "Try a different category name." : "Add categories to help customers find what they're looking for."}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((category) => (
            <article key={category._id} className={`${panelClass} flex flex-col p-5 transition hover:border-teal-300`}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <FolderTree className="h-5 w-5" />
                </span>
                <div className="flex gap-1">
                  <button aria-label={`Edit ${category.name}`} onClick={() => openEditor(category)} className={actionClass}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`Remove ${category.name}`}
                    disabled={deleting === category._id || (category.productCount || 0) > 0}
                    title={(category.productCount || 0) > 0 ? "Move or remove this category's products first" : "Remove category"}
                    onClick={() => void remove(category)}
                    className={`${actionClass} hover:!bg-red-50 hover:!text-red-600`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h2 className="break-words text-lg font-semibold">{category.name}</h2>
              <p className="mb-5 mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                {category.description || "No description added yet."}
              </p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-500">
                  {category.productCount ?? 0} active {(category.productCount ?? 0) === 1 ? "product" : "products"}
                </span>
                <Link
                  to={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-teal-700"
                >
                  View in store
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!saving) setShowModal(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white">
          <DialogTitle className="text-xl">{editing ? "Edit category" : "Add a category"}</DialogTitle>
          <DialogDescription>Use a short, familiar name that helps customers find the right products.</DialogDescription>
          <form onSubmit={save} className="space-y-5">
            {formError && <ErrorNotice message={formError} />}
            <div>
              <label htmlFor="category-name" className="mb-2 block text-sm font-medium">
                Category name
              </label>
              <input
                id="category-name"
                required
                minLength={2}
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="category-description" className="mb-2 block text-sm font-medium">
                Description <span className="font-normal text-slate-400">optional</span>
              </label>
              <textarea
                id="category-description"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={saving} onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
