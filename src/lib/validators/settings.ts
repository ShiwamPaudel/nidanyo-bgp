import { z } from "zod";

export const labProfileSchema = z.object({
  name: z.string().trim().min(2, "Lab name is required").max(160),
  address: z.string().trim().max(250).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).nullable(),
  website: z.string().trim().max(120).optional().nullable(),
  panVat: z.string().trim().max(40).optional().nullable(),
  calendarSystem: z.enum(["AD", "BS"]).default("AD"),
  currency: z.string().trim().min(1).max(8).default("NPR"),
  taxEnabled: z.boolean().default(false),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  shortLinkBaseUrl: z.string().trim().max(160).optional().nullable(),
  reportMarginTopMm: z.coerce.number().min(0).max(80).default(14),
  reportMarginBottomMm: z.coerce.number().min(0).max(80).default(14),
  reportMarginXMm: z.coerce.number().min(0).max(40).default(12),
  requirePhoneVerification: z.boolean().default(false),
});
export type LabProfileInput = z.infer<typeof labProfileSchema>;

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().nullable(),
  roleId: z.string().min(1, "Select a role"),
  designation: z.string().trim().max(120).optional().nullable(),
  registrationNo: z.string().trim().max(60).optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});
export type UserInput = z.infer<typeof userSchema>;

export const paymentModeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  category: z.enum(["cash", "digital", "card", "bank", "other"]).default("other"),
});
