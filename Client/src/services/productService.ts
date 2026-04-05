import api from "./api";

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  featured?: boolean;
}

export const productService = {
  getProducts: (params: ProductQueryParams = {}) =>
    api.get("/products", { params }),

  getProduct: (id: string) => api.get(`/products/${id}`),

  createProduct: (data: FormData | object) => api.post("/products", data),

  updateProduct: (id: string, data: object) => api.put(`/products/${id}`, data),

  deleteProduct: (id: string) => api.delete(`/products/${id}`),

  addReview: (id: string, data: { rating: number; comment: string }) =>
    api.post(`/products/${id}/reviews`, data),
};

export const categoryService = {
  getCategories: () => api.get("/categories"),
  getCategory: (id: string) => api.get(`/categories/${id}`),
  createCategory: (data: object) => api.post("/categories", data),
  updateCategory: (id: string, data: object) => api.put(`/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/categories/${id}`),
};
