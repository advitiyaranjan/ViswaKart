import { z } from "zod";

export const addressSchema = z.object({
  name: z.string().min(2, "Name is required"),
  label: z.string().optional(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .regex(/^[0-9]{7,15}$/, "Enter a valid phone number (digits only)"),
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .regex(/^[A-Z0-9\s\-]{3,10}$/i, "Enter a valid ZIP / postal code"),
  country: z.string().min(1, "Country is required"),
  isDefault: z.boolean().optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export const guestAddressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .regex(/^[0-9]{7,15}$/, "Enter a valid phone number (digits only)"),
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .regex(/^[A-Z0-9\s\-]{3,10}$/i, "Enter a valid ZIP / postal code"),
  country: z.string().min(1, "Country is required"),
});

export type GuestAddressFormValues = z.infer<typeof guestAddressSchema>;

export const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  price: z
    .number({ invalid_type_error: "Price must be a number" })
    .min(0.01, "Price must be greater than 0")
    .max(1_000_000, "Price is too high"),
  stock: z
    .number({ invalid_type_error: "Stock must be a number" })
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative")
    .max(100_000, "Stock value is too high"),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  discount: z
    .number({ invalid_type_error: "Discount must be a number" })
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100")
    .optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(50, "Category name is too long"),
  description: z.string().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
