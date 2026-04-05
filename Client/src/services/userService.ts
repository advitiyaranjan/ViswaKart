import api from "./api";

export const userService = {
  getDashboardStats: () => api.get("/users/dashboard"),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get("/users", { params }),
  getUser: (id: string) => api.get(`/users/${id}`),
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) =>
    api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
};
