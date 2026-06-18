import api from "./api";
import type { SellerApplication, SellerStatus } from "../lib/seller";

export const userService = {
  getDashboardStats: () => api.get("/users/dashboard"),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => api.get("/users", { params }),
  getUser: (id: string) => api.get(`/users/${id}`),
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) => api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  // Seller lifecycle. Status always comes from the server so it is never stale.
  getMySellerStatus: () => api.get("/users/me/seller"),
  requestSellerAccess: (data: SellerApplication) => api.post(`/users/seller-request`, data),
  getSellerRequests: (params?: { page?: number; limit?: number; status?: Exclude<SellerStatus, "none"> }) =>
    api.get(`/users/seller-requests`, { params }),
  approveSeller: (id: string) => api.put(`/users/${id}/seller-approve`),
  rejectSeller: (id: string, data?: { reason?: string }) => api.put(`/users/${id}/seller-reject`, data || {}),
  suspendSeller: (id: string, data?: { reason?: string }) => api.put(`/users/${id}/seller-suspend`, data || {}),
  reinstateSeller: (id: string) => api.put(`/users/${id}/seller-reinstate`),
};
