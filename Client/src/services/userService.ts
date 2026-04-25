import api from "./api";

export const userService = {
  getDashboardStats: () => api.get("/users/dashboard"),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get("/users", { params }),
  getUser: (id: string) => api.get(`/users/${id}`),
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) =>
    api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  // Seller flows
  requestSellerAccess: (data: { name?: string; hostelNumber?: string; courseYear?: string; mobileNumber?: string; message?: string }) =>
    api.post(`/users/seller-request`, data),
  getSellerRequests: (params?: { page?: number; limit?: number }) => api.get(`/users/seller-requests`, { params }),
  approveSeller: (id: string) => api.put(`/users/${id}/seller-approve`),
  rejectSeller: (id: string, data?: { reason?: string }) => api.put(`/users/${id}/seller-reject`, data || {}),
};
