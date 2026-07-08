import { z } from "zod";

/** Inline patient registration captured on the unified visit page. */
export const inlinePatientSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's name").max(120),
  gender: z.enum(["male", "female", "other"]),
  ageValue: z.coerce.number().int().min(0).max(150).optional().nullable(),
  ageUnit: z.enum(["years", "months", "days"]).default("years"),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  address: z.string().trim().max(250).optional().nullable(),
});

export const newVisitSchema = z
  .object({
    patientId: z.string().optional().nullable(),
    newPatient: inlinePatientSchema.optional().nullable(),
    referredBy: z.string().trim().max(120).optional().nullable(),
    referringDoctorId: z.string().optional().nullable(),
    priority: z.enum(["normal", "urgent"]).optional(),
    items: z
      .array(
        z.object({
          kind: z.enum(["test", "group"]),
          refId: z.string().min(1),
          // Optional per-bill rate override for an individual test. Snapshotted
          // onto the visit/bill only — never written back to the test catalog.
          priceOverride: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
        }),
      )
      .min(1, "Add at least one test or profile"),
    discountAmount: z.coerce.number().min(0).default(0),
    discountReason: z.string().trim().max(160).optional().nullable(),
    paymentAmount: z.coerce.number().min(0).default(0),
    paymentModeId: z.string().optional().nullable(),
    paymentReference: z.string().trim().max(120).optional().nullable(),
    remarks: z.string().trim().max(300).optional().nullable(),
  })
  .refine((d) => !!d.patientId || !!d.newPatient, { message: "Select an existing patient or enter new patient details", path: ["patientId"] });
export type NewVisitInput = z.infer<typeof newVisitSchema>;

export const paymentSchema = z
  .object({
    billId: z.string().min(1),
    amount: z.coerce.number().min(0).default(0),
    discount: z.coerce.number().min(0).default(0),
    modeId: z.string().optional().nullable(),
    reference: z.string().trim().max(120).optional().nullable(),
    remarks: z.string().trim().max(300).optional().nullable(),
  })
  .refine((d) => (d.amount ?? 0) > 0 || (d.discount ?? 0) > 0, {
    message: "Enter a payment amount or a discount",
    path: ["amount"],
  });
export type PaymentInput = z.infer<typeof paymentSchema>;

export const cancelVisitSchema = z.object({
  visitId: z.string().min(1),
  reason: z.string().trim().min(3, "Please provide a reason"),
});
