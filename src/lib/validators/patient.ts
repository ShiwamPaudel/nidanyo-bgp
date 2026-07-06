import { z } from "zod";

export const patientSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's full name").max(120),
  gender: z.enum(["male", "female", "other"], { message: "Select a gender" }),
  ageValue: z.coerce.number().int().min(0).max(150).optional().nullable(),
  ageUnit: z.enum(["years", "months", "days"]).default("years"),
  dob: z.string().optional().nullable(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9+\-\s]{6,20}$/.test(v), "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  referredBy: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type PatientInput = z.infer<typeof patientSchema>;
