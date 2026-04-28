import api from "./api";

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AddressData {
  name?: string;
  label?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault?: boolean;
}

export const authService = {
  register: (data: RegisterData) => api.post("/auth/register", data),
  login: (data: LoginData) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
  updateProfile: (data: Partial<{ name: string; phone: string; avatar: string; address: object }>) =>
    api.put("/auth/me", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put("/auth/change-password", data),
  sendOtp: (data: { name: string; email: string; password: string }) =>
    api.post("/auth/send-otp", data),
  verifyOtp: (data: { email: string; otp: string }) =>
    api.post("/auth/verify-otp", data),
  // Addresses
  addAddress: (data: AddressData) => api.post("/auth/me/addresses", data),
  updateAddress: (addrId: string, data: AddressData) => api.put(`/auth/me/addresses/${addrId}`, data),
  deleteAddress: (addrId: string) => api.delete(`/auth/me/addresses/${addrId}`),
  // Contact update via OTP
  sendContactOtp: (data: { type: "email" | "phone"; newValue: string }) => api.post("/auth/send-contact-otp", data),
  verifyContactOtp: (data: { type: "email" | "phone"; newValue: string; otp: string }) => api.post("/auth/verify-contact-otp", data),
};
