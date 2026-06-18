import api from "./api";
import type { College, CollegePreference } from "../lib/college";

export const collegeService = {
  list: (params?: { search?: string; limit?: number; includeInactive?: boolean }) =>
    api.get<{ colleges: College[]; total: number }>("/colleges", { params }),
  get: (id: string) => api.get<{ college: College }>(`/colleges/${id}`),
  create: (data: Partial<College> & { emailDomains?: string[] }) => api.post("/colleges", data),
  update: (id: string, data: Partial<College> & { emailDomains?: string[] }) => api.put(`/colleges/${id}`, data),
  // Signed-in College Mode preference
  getPreference: () => api.get<{ preference: CollegePreference }>("/auth/me/college"),
  savePreference: (data: { collegeId?: string; enabled: boolean }) => api.put<{ preference: CollegePreference }>("/auth/me/college", data),
  // Seller affiliation
  setMySellerCollege: (collegeId: string) => api.put("/users/me/seller-college", { collegeId }),
  adminSetSellerCollege: (userId: string, collegeId: string) => api.put(`/users/${userId}/seller-college`, { collegeId }),
};
