import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const isValidObjectId = (val) => objectIdRegex.test(val);

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
});

export const updateEmailSchema = z.object({
  newEmail: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  currentPassword: z.string().min(1, 'Current password is required to verify identity'),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters long'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation do not match',
  path: ['confirmPassword'],
}).refine(data => data.newPassword !== data.currentPassword, {
  message: 'New password cannot be the same as current password',
  path: ['newPassword'],
});

export const servicerSchema = z.object({
  name: z.string().min(2, 'Servicer name must be at least 2 characters').max(100).trim(),
  phone: z.string().min(7, 'Phone number must be at least 7 digits').max(20).trim(),
  email: z.string().email('Invalid email').trim().toLowerCase().optional().or(z.literal('')),
  serviceArea: z.string().max(100).trim().optional().or(z.literal('')),
  specialization: z.string().max(100).trim().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const servicerUpdateSchema = servicerSchema.partial();

export const representativeSchema = z.object({
  name: z.string().min(2, 'Representative name must be at least 2 characters').max(100).trim(),
  phone: z.string().max(20).trim().optional().or(z.literal('')),
  email: z.string().email('Invalid email').trim().toLowerCase().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const representativeUpdateSchema = representativeSchema.partial();

export const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100).trim(),
  description: z.string().max(500).trim().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100).trim(),
  description: z.string().max(500).trim().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const complaintCreateSchema = z.object({
  complaintNumber: z
    .string()
    .min(1, 'Complaint ID is required')
    .max(50, 'Complaint ID cannot exceed 50 characters')
    .trim()
    .regex(/^[a-zA-Z0-9\-_/]+$/, 'Complaint ID may contain letters, numbers, hyphens (-), and slashes (/)'),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(100).trim(),
  customerPhone: z.string().min(7, 'Customer phone must be at least 7 digits').max(20).trim(),
  alternatePhone: z.string().max(20).trim().optional().or(z.literal('')),
  customerEmail: z.string().email('Invalid customer email').trim().toLowerCase().optional().or(z.literal('')),
  customerAddress: z.string().min(3, 'Address is required').max(300).trim(),
  area: z.string().min(2, 'Area/Location is required').max(100).trim(),
  brand: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid Brand ID'),
  category: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid Category ID'),
  productName: z.string().min(2, 'Product name is required').max(100).trim(),
  modelNumber: z.string().max(100).trim().optional().or(z.literal('')),
  serialNumber: z.string().max(100).trim().optional().or(z.literal('')),
  purchaseDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid purchase date'),
  warrantyStatus: z.enum(['in_warranty', 'out_of_warranty', 'unknown']).default('unknown'),
  subject: z.string().min(3, 'Complaint subject is required').max(200).trim(),
  description: z.string().min(5, 'Detailed description is required').max(3000).trim(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  representative: z.string().min(1, 'Registered by (REP) is required').refine(val => isValidObjectId(val), 'Invalid Representative ID'),
  assignedServicer: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid servicer ID'),
  scheduledServiceDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid scheduled date'),
  internalNotes: z.string().max(2000).trim().optional().or(z.literal('')),
  sendWhatsAppConfirmation: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
  countryCode: z.string().max(6).optional(),
});

export const complaintUpdateSchema = z.object({
  customerName: z.string().min(2).max(100).trim().optional(),
  customerPhone: z.string().min(7).max(20).trim().optional(),
  countryCode: z.string().max(6).optional(),
  alternatePhone: z.string().max(20).trim().optional().or(z.literal('')),
  customerEmail: z.string().email().trim().toLowerCase().optional().or(z.literal('')),
  customerAddress: z.string().min(3).max(300).trim().optional(),
  area: z.string().min(2).max(100).trim().optional(),
  brand: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid Brand ID'),
  category: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid Category ID'),
  productName: z.string().min(2).max(100).trim().optional(),
  modelNumber: z.string().max(100).trim().optional().or(z.literal('')),
  serialNumber: z.string().max(100).trim().optional().or(z.literal('')),
  purchaseDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid purchase date'),
  warrantyStatus: z.enum(['in_warranty', 'out_of_warranty', 'unknown']).optional(),
  subject: z.string().min(3).max(200).trim().optional(),
  description: z.string().min(5).max(3000).trim().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  representative: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid Representative ID'),
  scheduledServiceDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid scheduled date'),
  internalNotes: z.string().max(2000).trim().optional().or(z.literal('')),
  version: z.number().int().nonnegative().optional(),
});

export const complaintStatusUpdateSchema = z.object({
  status: z.enum(['Registered', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled']),
  assignedServicer: z.string().optional().or(z.literal('')).refine(val => !val || isValidObjectId(val), 'Invalid servicer ID'),
  resolutionNotes: z.string().max(3000).trim().optional().or(z.literal('')),
  workPerformed: z.string().max(3000).trim().optional().or(z.literal('')),
  partsReplaced: z.string().max(1000).trim().optional().or(z.literal('')),
  serviceCharge: z.number().min(0).optional().or(z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)).optional(),
  completedDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid completion date'),
  version: z.number().int().nonnegative().optional(),
});

export const complaintAssignmentUpdateSchema = z.object({
  assignedServicer: z.string().refine(isValidObjectId, 'A valid active servicer must be selected'),
  scheduledServiceDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), 'Invalid scheduled date'),
  version: z.number().int().nonnegative().optional(),
});

export const complaintNoteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty').max(2000).trim(),
});

export const complaintCompleteServiceSchema = z.object({
  assignedServicer: z.string().refine(isValidObjectId, 'A valid active servicer must be selected'),
  completedDate: z.string().min(1, 'Completion date is required').refine(val => !isNaN(Date.parse(val)), 'Invalid completion date'),
  workPerformed: z.string().min(3, 'Servicing details / work performed is required').max(3000).trim(),
  resolutionNotes: z.string().min(3, 'Resolution notes are required').max(3000).trim(),
  partsReplaced: z.string().max(1000).trim().optional().or(z.literal('')),
  serviceCharge: z.union([
    z.number().min(0, 'Service charge cannot be negative'),
    z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)
  ]).optional().default(0),
  additionalNotes: z.string().max(2000).trim().optional().or(z.literal('')),
  version: z.number().int().nonnegative().optional(),
});
