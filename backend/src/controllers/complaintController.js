import mongoose from 'mongoose';
import path from 'path';
import { Complaint, COMPLETED_STATUSES, ACTIVE_STATUSES } from '../models/Complaint.js';
import { Servicer } from '../models/Servicer.js';
import { Representative } from '../models/Representative.js';
import { Brand } from '../models/Brand.js';
import { Category } from '../models/Category.js';
import {
  saveAttachmentFile,
  getLocalFileStream,
  streamCloudinaryFile,
  deleteStoredFile,
  getAttachmentBuffer,
} from '../services/storageService.js';
import {
  generateComplaintPDF,
  generateComplaintReportPDF,
  sanitizeFilenamePart,
} from '../services/pdfService.js';
import {
  queueWhatsAppNotification,
  normalizePhoneNumber,
  buildWhatsAppClickToChatUrl,
} from '../services/whatsappService.js';
import { getNotificationSettings } from '../models/NotificationSettings.js';
import {
  complaintCreateSchema,
  complaintUpdateSchema,
  complaintStatusUpdateSchema,
  complaintAssignmentUpdateSchema,
  complaintNoteSchema,
  complaintCompleteServiceSchema,
} from '../validators/schemas.js';
import { config } from '../config/env.js';

// Build search & filter MongoDB query
function buildComplaintQuery(params) {
  const {
    search,
    status,
    priority,
    servicer,
    representative,
    brand,
    category,
    area,
    startDate,
    endDate,
    isArchived,
    completedOnly,
    completedStartDate,
    completedEndDate,
  } = params;

  const query = {};

  // Default: exclude archived unless explicitly requested
  if (isArchived === 'true') {
    query.isArchived = true;
  } else {
    query.isArchived = false;
  }

  // Status filter and strict section separation
  if (completedOnly === 'true') {
    // COMPLETED COMPLAINTS SECTION: strictly completed records only
    if (status && status !== 'all') {
      if (COMPLETED_STATUSES.includes(status)) {
        query.status = status;
      } else {
        query.status = { $in: [] }; // Prevent non-completed records from matching in completed section
      }
    } else {
      query.status = { $in: COMPLETED_STATUSES };
    }
  } else {
    // ACTIVE COMPLAINTS SECTION: strictly non-completed records only
    if (status && status !== 'all') {
      if (COMPLETED_STATUSES.includes(status)) {
        query.status = { $in: [] }; // Prevent completed records from matching in active section
      } else {
        query.status = { $eq: status, $nin: COMPLETED_STATUSES };
      }
    } else {
      query.status = { $nin: COMPLETED_STATUSES };
    }
  }

  // Priority filter
  if (priority && priority !== 'all') {
    query.priority = priority;
  }

  // Servicer filter
  if (servicer && servicer !== 'all') {
    if (servicer === 'unassigned') {
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [{ assignedServicer: null }, { assignedServicer: { $exists: false } }]
      });
    } else if (mongoose.Types.ObjectId.isValid(servicer)) {
      query.assignedServicer = new mongoose.Types.ObjectId(servicer);
    }
  }

  // Representative filter
  if (representative && representative !== 'all') {
    if (representative === 'unassigned') {
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [{ representative: null }, { representative: { $exists: false } }]
      });
    } else if (mongoose.Types.ObjectId.isValid(representative)) {
      query.representative = new mongoose.Types.ObjectId(representative);
    }
  }

  // Brand filter
  if (brand && brand !== 'all') {
    if (mongoose.Types.ObjectId.isValid(brand)) {
      query.brand = new mongoose.Types.ObjectId(brand);
    }
  }

  // Category filter
  if (category && category !== 'all') {
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }
  }

  // Area filter
  if (area && area !== 'all') {
    query.area = new RegExp(`^${area.trim()}$`, 'i');
  }

  // Date range filter on complaintDate
  if (startDate || endDate) {
    query.complaintDate = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        query.complaintDate.$gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        query.complaintDate.$lte = end;
      }
    }
  }

  // Completion date range filter on resolution.completedDate
  if (completedStartDate || completedEndDate) {
    query['resolution.completedDate'] = {};
    if (completedStartDate) {
      const cStart = new Date(completedStartDate);
      if (!isNaN(cStart.getTime())) {
        cStart.setHours(0, 0, 0, 0);
        query['resolution.completedDate'].$gte = cStart;
      }
    }
    if (completedEndDate) {
      const cEnd = new Date(completedEndDate);
      if (!isNaN(cEnd.getTime())) {
        cEnd.setHours(23, 59, 59, 999);
        query['resolution.completedDate'].$lte = cEnd;
      }
    }
  }

  // Search string across multiple bounded fields
  if (search && typeof search === 'string') {
    const sanitized = search.trim().slice(0, 80);
    if (sanitized) {
      const escaped = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { complaintNumber: regex },
          { customerName: regex },
          { customerPhone: regex },
          { alternatePhone: regex },
          { productName: regex },
          { area: regex },
          { servicerNameSnapshot: regex },
          { brandNameSnapshot: regex },
          { categoryNameSnapshot: regex },
        ]
      });
    }
  }

  return query;
}

export async function getComplaints(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'complaintDate',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    // Strict allowlist for sorting
    const allowedSortFields = new Set([
      'complaintDate',
      'complaintNumber',
      'customerName',
      'priority',
      'status',
      'createdAt',
      'updatedAt',
      'resolution.completedDate'
    ]);

    const sortField = allowedSortFields.has(sortBy) ? sortBy : 'complaintDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    const query = buildComplaintQuery(req.query);

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('assignedServicer', 'name phone email isActive')
        .populate('representative', 'name phone email isActive')
        .populate('brand', 'name isActive')
        .populate('category', 'name isActive')
        .lean(),
      Complaint.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createComplaint(req, res, next) {
  const savedFiles = [];
  try {
    let bodyData = { ...req.body };
    if (typeof bodyData.data === 'string') {
      try {
        bodyData = { ...JSON.parse(bodyData.data), ...bodyData };
      } catch {}
    }

    const parseResult = complaintCreateSchema.safeParse(bodyData);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid complaint registration data',
          details: parseResult.error.errors,
        }
      });
    }

    const data = parseResult.data;

    // Check case-insensitive duplicate manual complaint ID
    const trimmedId = data.complaintNumber.trim();
    const existing = await Complaint.findOne({ complaintNumberLower: trimmedId.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_COMPLAINT_ID',
          message: 'This Complaint ID already exists.',
        }
      });
    }

    // Validate Brand if provided
    let brandDoc = null;
    if (data.brand) {
      brandDoc = await Brand.findById(data.brand);
      if (!brandDoc) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BRAND', message: 'Selected brand not found' }
        });
      }
      if (!brandDoc.isActive) {
        return res.status(400).json({
          success: false,
          error: { code: 'INACTIVE_BRAND', message: 'Cannot select an inactive brand for new complaints' }
        });
      }
    }

    // Validate Category if provided
    let categoryDoc = null;
    if (data.category) {
      categoryDoc = await Category.findById(data.category);
      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CATEGORY', message: 'Selected category not found' }
        });
      }
      if (!categoryDoc.isActive) {
        return res.status(400).json({
          success: false,
          error: { code: 'INACTIVE_CATEGORY', message: 'Cannot select an inactive category for new complaints' }
        });
      }
    }

    // Validate Representative (Registered by) - Required for new complaints
    let repDoc = null;
    if (data.representative) {
      repDoc = await Representative.findById(data.representative);
      if (!repDoc) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REPRESENTATIVE', message: 'Selected representative not found' }
        });
      }
      if (!repDoc.isActive) {
        return res.status(400).json({
          success: false,
          error: { code: 'INACTIVE_REPRESENTATIVE', message: 'Cannot select an inactive representative for new complaints' }
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'REPRESENTATIVE_REQUIRED', message: 'Registered by (REP) is required for new complaints.' }
      });
    }

    // Validate servicer if specified
    let servicerDoc = null;
    if (data.assignedServicer) {
      servicerDoc = await Servicer.findById(data.assignedServicer);
      if (!servicerDoc) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SERVICER', message: 'Assigned servicer not found' }
        });
      }
      if (!servicerDoc.isActive) {
        return res.status(400).json({
          success: false,
          error: { code: 'INACTIVE_SERVICER', message: 'Cannot assign an inactive servicer' }
        });
      }
    }

    // Require servicer when creating with Assigned or In Progress status
    if (['Assigned', 'In Progress'].includes(bodyData.status) && !servicerDoc) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SERVICER_REQUIRED',
          message: 'An active servicer must be assigned when setting status to Assigned or In Progress.'
        }
      });
    }

    // Process uploaded files if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > config.storage.maxAttachments) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_ATTACHMENTS',
            message: `Maximum ${config.storage.maxAttachments} attachments allowed per complaint`,
          }
        });
      }

      for (const file of req.files) {
        const saved = await saveAttachmentFile(file.buffer, file.sanitizedName || file.originalname, file.mimetype);
        savedFiles.push({
          key: saved.storageKey,
          provider: saved.storageProvider,
          resourceType: saved.resourceType,
          deliveryType: saved.deliveryType,
        });

        attachments.push({
          originalName: file.sanitizedName || file.originalname,
          storageKey: saved.storageKey,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedAt: new Date(),
          uploadedBy: req.admin._id,
          storageProvider: saved.storageProvider,
          cloudinaryPublicId: saved.cloudinaryPublicId || '',
          resourceType: saved.resourceType || 'image',
          deliveryType: saved.deliveryType || 'authenticated',
        });
      }
    }

    const initialStatus = servicerDoc && !bodyData.status ? 'Assigned' : (bodyData.status || 'Registered');

    const complaint = new Complaint({
      ...data,
      complaintNumber: trimmedId,
      complaintNumberLower: trimmedId.toLowerCase(),
      status: initialStatus,
      brand: brandDoc ? brandDoc._id : undefined,
      brandNameSnapshot: brandDoc ? brandDoc.name : 'Not assigned',
      category: categoryDoc ? categoryDoc._id : undefined,
      categoryNameSnapshot: categoryDoc ? categoryDoc.name : 'Not assigned',
      assignedServicer: servicerDoc ? servicerDoc._id : undefined,
      servicerNameSnapshot: servicerDoc ? servicerDoc.name : '',
      representative: repDoc ? repDoc._id : undefined,
      representativeNameSnapshot: repDoc ? repDoc.name : '',
      attachments,
      timeline: [
        {
          actor: req.admin.name || 'Admin',
          actorId: req.admin._id,
          action: 'REGISTERED',
          details: `Complaint ${trimmedId} registered successfully`,
          timestamp: new Date(),
        }
      ],
      version: 0,
    });

    await complaint.save();

    // Prepare Click-to-Chat WhatsApp URL using saved MongoDB settings
    let whatsappLink = null;
    let whatsappStatus = bodyData.sendWhatsAppConfirmation === false || bodyData.sendWhatsAppConfirmation === 'false' ? 'None' : undefined;

    try {
      const settings = await getNotificationSettings();
      const isClickToChatActive = settings.clickToChatEnabled !== false;
      whatsappLink = buildWhatsAppClickToChatUrl(
        complaint.customerPhone,
        settings.customMessageDraft,
        complaint,
        settings.companyName,
        data.countryCode || '+91',
        isClickToChatActive
      );
    } catch (waErr) {
      console.warn('[WhatsApp Click-to-Chat Notice]', waErr.message);
      whatsappLink = {
        url: '',
        isValid: false,
        reason: 'SETTINGS_ERROR',
        error: 'Could not load WhatsApp settings. Please retry.',
      };
    }

    // Support legacy explicit opt-in if requested
    if (bodyData.sendWhatsAppConfirmation === true || bodyData.sendWhatsAppConfirmation === 'true') {
      try {
        const notif = await queueWhatsAppNotification(complaint, req.admin._id);
        whatsappStatus = notif?.status || 'Queued';
      } catch (err) {
        whatsappStatus = 'Failed';
        console.warn('[WhatsApp Legacy Outbox]', err.message);
      }
    }

    await complaint.populate('brand category assignedServicer representative');

    res.status(201).json({
      success: true,
      message: `Complaint ${trimmedId} registered successfully`,
      data: complaint,
      whatsappStatus,
      whatsappLink,
    });
  } catch (err) {
    // Clean up orphaned uploaded files
    for (const item of savedFiles) {
      await deleteStoredFile(item.key, item.provider, item.resourceType, item.deliveryType).catch(() => {});
    }

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_COMPLAINT_ID',
          message: 'This Complaint ID already exists.',
        }
      });
    }
    next(err);
  }
}

export async function getComplaintById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const complaint = await Complaint.findById(id)
      .populate('assignedServicer', 'name phone email serviceArea specialization isActive')
      .populate('representative', 'name phone email isActive')
      .populate('brand', 'name description isActive')
      .populate('category', 'name description isActive')
      .populate('whatsappNotification.notificationId')
      .lean();

    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    res.json({
      success: true,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateComplaint(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const parseResult = complaintUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid complaint update data',
          details: parseResult.error.errors,
        }
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    // Optimistic concurrency check
    if (req.body.version !== undefined && req.body.version !== complaint.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'The complaint was updated by another session. Please refresh the page to view current data.',
          currentVersion: complaint.version,
        }
      });
    }

    const data = parseResult.data;
    const timelineChanges = [];

    // Track priority change
    if (data.priority && data.priority !== complaint.priority) {
      timelineChanges.push(`Priority changed from ${complaint.priority} to ${data.priority}`);
    }

    // Brand update
    if (data.brand !== undefined) {
      if (data.brand) {
        const b = await Brand.findById(data.brand);
        if (b) {
          complaint.brand = b._id;
          complaint.brandNameSnapshot = b.name;
          timelineChanges.push(`Brand set to ${b.name}`);
        }
      } else {
        complaint.brand = undefined;
        complaint.brandNameSnapshot = 'Not assigned';
      }
    }

    // Category update
    if (data.category !== undefined) {
      if (data.category) {
        const c = await Category.findById(data.category);
        if (c) {
          complaint.category = c._id;
          complaint.categoryNameSnapshot = c.name;
          timelineChanges.push(`Category set to ${c.name}`);
        }
      } else {
        complaint.category = undefined;
        complaint.categoryNameSnapshot = 'Not assigned';
      }
    }

    // Representative update
    if (data.representative !== undefined) {
      if (data.representative) {
        if (!complaint.representative || complaint.representative.toString() !== data.representative) {
          const rep = await Representative.findById(data.representative);
          if (!rep) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_REPRESENTATIVE', message: 'Assigned representative not found' }
            });
          }
          if (!rep.isActive) {
            return res.status(400).json({
              success: false,
              error: { code: 'INACTIVE_REPRESENTATIVE', message: 'Cannot assign an inactive representative' }
            });
          }
          const oldRepName = complaint.representativeNameSnapshot || 'Not assigned';
          complaint.representative = rep._id;
          complaint.representativeNameSnapshot = rep.name;
          timelineChanges.push(`Representative updated from "${oldRepName}" to "${rep.name}"`);
        }
      } else {
        const oldRepName = complaint.representativeNameSnapshot || 'Not assigned';
        complaint.representative = undefined;
        complaint.representativeNameSnapshot = '';
        timelineChanges.push(`Representative "${oldRepName}" unassigned`);
      }
      delete data.representative;
    }

    // Prevent changing complaintNumber after creation
    delete data.complaintNumber;

    Object.assign(complaint, data);
    complaint.version += 1;

    if (timelineChanges.length > 0) {
      complaint.timeline.push({
        actor: req.admin.name || 'Admin',
        actorId: req.admin._id,
        action: 'DETAILS_UPDATED',
        details: timelineChanges.join(', '),
        timestamp: new Date(),
      });
    }

    await complaint.save();
    await complaint.populate('assignedServicer brand category representative');

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateComplaintStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const parseResult = complaintStatusUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status update parameters',
          details: parseResult.error.errors,
        }
      });
    }

    const {
      status,
      assignedServicer: newServicerId,
      resolutionNotes,
      workPerformed,
      partsReplaced,
      serviceCharge,
      completedDate,
      version,
    } = parseResult.data;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    // Concurrency check
    if (version !== undefined && version !== complaint.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'The complaint status was updated by another session. Please reload the record.',
          currentVersion: complaint.version,
        }
      });
    }

    // Require servicer when changing to Assigned or In Progress
    if (['Assigned', 'In Progress'].includes(status)) {
      const servicerIdToCheck = newServicerId || complaint.assignedServicer;
      if (!servicerIdToCheck) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SERVICER_REQUIRED',
            message: 'A servicer must be assigned before changing status to Assigned or In Progress.',
          }
        });
      }

      if (newServicerId) {
        const servicer = await Servicer.findById(newServicerId);
        if (!servicer || !servicer.isActive) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_SERVICER', message: 'Assigned servicer must be valid and active.' }
          });
        }
        complaint.assignedServicer = servicer._id;
        complaint.servicerNameSnapshot = servicer.name;
      }
    }

    // Require resolution notes before marking Resolved or Closed
    if (['Resolved', 'Closed'].includes(status)) {
      const existingNotes = complaint.resolution?.resolutionNotes;
      const combinedNotes = resolutionNotes || existingNotes;
      if (!combinedNotes || combinedNotes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RESOLUTION_REQUIRED',
            message: 'Resolution notes are required before marking a complaint as Resolved or Closed.',
          }
        });
      }
    }

    // Update resolution details if provided
    if (resolutionNotes !== undefined || workPerformed !== undefined || partsReplaced !== undefined || serviceCharge !== undefined) {
      complaint.resolution = {
        workPerformed: workPerformed !== undefined ? workPerformed : (complaint.resolution?.workPerformed || ''),
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : (complaint.resolution?.resolutionNotes || ''),
        partsReplaced: partsReplaced !== undefined ? partsReplaced : (complaint.resolution?.partsReplaced || ''),
        serviceCharge: serviceCharge !== undefined ? Number(serviceCharge) : (complaint.resolution?.serviceCharge || 0),
        completedDate: completedDate ? new Date(completedDate) : (complaint.resolution?.completedDate || (['Resolved', 'Closed'].includes(status) ? new Date() : undefined)),
      };
    }

    const oldStatus = complaint.status;
    complaint.status = status;
    complaint.version += 1;

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'STATUS_CHANGED',
      details: `Status updated from "${oldStatus}" to "${status}"`,
      oldValue: oldStatus,
      newValue: status,
      timestamp: new Date(),
    });

    await complaint.save();
    await complaint.populate('assignedServicer brand category representative');

    res.json({
      success: true,
      message: `Complaint status updated to ${status}`,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateComplaintAssignment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const parseResult = complaintAssignmentUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid assignment parameters',
          details: parseResult.error.errors,
        }
      });
    }

    const { assignedServicer, scheduledServiceDate, version } = parseResult.data;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    if (version !== undefined && version !== complaint.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'The complaint was updated concurrently. Please refresh.',
        }
      });
    }

    const servicer = await Servicer.findById(assignedServicer);
    if (!servicer || !servicer.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SERVICER', message: 'Servicer not found or is inactive.' }
      });
    }

    const oldServicerName = complaint.servicerNameSnapshot || 'None';
    complaint.assignedServicer = servicer._id;
    complaint.servicerNameSnapshot = servicer.name;

    if (scheduledServiceDate) {
      complaint.scheduledServiceDate = new Date(scheduledServiceDate);
    }

    // Auto update status to Assigned if currently Registered
    if (complaint.status === 'Registered') {
      complaint.status = 'Assigned';
    }

    complaint.version += 1;

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'SERVICER_ASSIGNED',
      details: `Assigned to ${servicer.name} (Previously: ${oldServicerName})`,
      oldValue: oldServicerName,
      newValue: servicer.name,
      timestamp: new Date(),
    });

    await complaint.save();
    await complaint.populate('assignedServicer brand category representative');

    res.json({
      success: true,
      message: `Complaint assigned to ${servicer.name}`,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function completeComplaintService(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID' }
      });
    }

    const parseResult = complaintCompleteServiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid service completion data',
          details: parseResult.error.errors,
        }
      });
    }

    const {
      assignedServicer,
      completedDate,
      workPerformed,
      resolutionNotes,
      partsReplaced = '',
      serviceCharge = 0,
      additionalNotes = '',
      version,
    } = parseResult.data;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found' }
      });
    }

    if (complaint.isArchived) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_COMPLETE_ARCHIVED',
          message: 'Archived complaints cannot be marked as completed.'
        }
      });
    }

    if (complaint.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_COMPLETE_CANCELLED',
          message: 'Cancelled complaints cannot be marked as completed.'
        }
      });
    }

    if (['Resolved', 'Closed'].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_COMPLETED',
          message: 'This complaint has already been completed.'
        }
      });
    }

    if (version !== undefined && version !== complaint.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'The complaint was updated by another session. Please reload to view current data.',
          currentVersion: complaint.version,
        }
      });
    }

    const servicer = await Servicer.findById(assignedServicer);
    if (!servicer || !servicer.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SERVICER',
          message: 'Assigned servicer must be valid and active.'
        }
      });
    }

    const parsedCompletedDate = new Date(completedDate);
    const charge = Number(serviceCharge) || 0;
    const adminName = req.admin?.name || 'Admin';
    const adminId = req.admin?._id;

    complaint.assignedServicer = servicer._id;
    complaint.servicerNameSnapshot = servicer.name;
    const oldStatus = complaint.status;
    complaint.status = 'Resolved';

    complaint.resolution = {
      workPerformed,
      resolutionNotes,
      partsReplaced: partsReplaced || '',
      serviceCharge: charge,
      completedDate: parsedCompletedDate,
      additionalNotes: additionalNotes || '',
      completedBy: adminId,
      completedByName: adminName,
    };

    if (additionalNotes && additionalNotes.trim()) {
      complaint.serviceNotes.push({
        author: adminName,
        authorId: adminId,
        note: `Service completion note: ${additionalNotes.trim()}`,
        timestamp: new Date(),
      });
    }

    complaint.timeline.push({
      actor: adminName,
      actorId: adminId,
      action: 'SERVICE_COMPLETED',
      details: `Service completed by ${servicer.name}. Charge: INR ${charge.toFixed(2)}. Work: ${workPerformed.slice(0, 100)}`,
      oldValue: oldStatus,
      newValue: 'Resolved',
      timestamp: new Date(),
    });

    complaint.version += 1;

    await complaint.save();
    await complaint.populate('assignedServicer brand category representative');

    res.json({
      success: true,
      message: 'Complaint service completed successfully',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function addComplaintNote(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const parseResult = complaintNoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid note content',
          details: parseResult.error.errors,
        }
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    complaint.serviceNotes.push({
      note: parseResult.data.note,
      createdBy: req.admin._id,
      createdByName: req.admin.name || 'Admin',
      createdAt: new Date(),
    });

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'NOTE_ADDED',
      details: 'Added internal service note',
      timestamp: new Date(),
    });

    await complaint.save();

    res.json({
      success: true,
      message: 'Note added successfully',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadAttachments(req, res, next) {
  const savedFiles = [];
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No files were uploaded' }
      });
    }

    const remainingSlots = config.storage.maxAttachments - complaint.attachments.length;
    if (req.files.length > remainingSlots) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_ATTACHMENTS_EXCEEDED',
          message: `Cannot upload ${req.files.length} file(s). Maximum ${config.storage.maxAttachments} attachments allowed (current: ${complaint.attachments.length}).`,
        }
      });
    }

    const newAttachments = [];
    for (const file of req.files) {
      const saved = await saveAttachmentFile(file.buffer, file.sanitizedName || file.originalname, file.mimetype);
      savedFiles.push({
        key: saved.storageKey,
        provider: saved.storageProvider,
        resourceType: saved.resourceType,
        deliveryType: saved.deliveryType,
      });

      newAttachments.push({
        originalName: file.sanitizedName || file.originalname,
        storageKey: saved.storageKey,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedAt: new Date(),
        uploadedBy: req.admin._id,
        storageProvider: saved.storageProvider,
        cloudinaryPublicId: saved.cloudinaryPublicId || '',
        resourceType: saved.resourceType || 'image',
        deliveryType: saved.deliveryType || 'authenticated',
      });
    }

    complaint.attachments.push(...newAttachments);

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'ATTACHMENTS_ADDED',
      details: `Added ${newAttachments.length} attachment(s): ${newAttachments.map(a => a.originalName).join(', ')}`,
      timestamp: new Date(),
    });

    await complaint.save();

    res.json({
      success: true,
      message: `${newAttachments.length} file(s) attached successfully`,
      data: complaint,
    });
  } catch (err) {
    for (const item of savedFiles) {
      await deleteStoredFile(item.key, item.provider, item.resourceType, item.deliveryType).catch(() => {});
    }
    next(err);
  }
}

export async function downloadAttachment(req, res, next) {
  try {
    const { id, attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(attachmentId)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid identifiers' } });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    const attachment = complaint.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ success: false, error: { message: 'Attachment not found' } });
    }

    const isInline = req.query.inline === 'true';
    const dispositionType = isInline ? 'inline' : 'attachment';

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(attachment.originalName)}"`
    );

    // If Cloudinary stored file, stream via Cloudinary signed stream proxy
    if (attachment.storageProvider === 'cloudinary') {
      return streamCloudinaryFile(
        attachment.storageKey || attachment.cloudinaryPublicId,
        attachment.resourceType,
        res,
        attachment.deliveryType
      );
    }

    if (attachment.fileSize) {
      res.setHeader('Content-Length', attachment.fileSize);
    }

    // Local filesystem stream
    const stream = getLocalFileStream(attachment.storageKey);
    if (!stream) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Attachment file not found on disk' }
      });
    }

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function deleteAttachment(req, res, next) {
  try {
    const { id, attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(attachmentId)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid identifiers' } });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    const attachment = complaint.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ success: false, error: { message: 'Attachment not found' } });
    }

    const storageKey = attachment.storageKey || attachment.cloudinaryPublicId;
    const provider = attachment.storageProvider || 'local';
    const resourceType = attachment.resourceType || 'image';
    const deliveryType = attachment.deliveryType || 'authenticated';
    const filename = attachment.originalName;

    attachment.deleteOne();

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'ATTACHMENT_REMOVED',
      details: `Removed attachment "${filename}"`,
      timestamp: new Date(),
    });

    await complaint.save();

    await deleteStoredFile(storageKey, provider, resourceType, deliveryType);

    res.json({
      success: true,
      message: `Attachment "${filename}" removed successfully`,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function getIndividualComplaintPDF(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const complaint = await Complaint.findById(id)
      .populate('assignedServicer')
      .populate('representative', 'name phone email')
      .populate('brand', 'name')
      .populate('category', 'name');

    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    // Pre-fetch image buffers for PDF thumbnails (supports both local and Cloudinary safely)
    const imageBuffers = {};
    if (complaint.attachments && complaint.attachments.length > 0) {
      await Promise.all(
        complaint.attachments.map(async (att) => {
          if (att.mimeType === 'image/jpeg' || att.mimeType === 'image/png') {
            const buf = await getAttachmentBuffer(att);
            if (buf) {
              imageBuffers[att._id.toString()] = buf;
            }
          }
        })
      );
    }

    const safeId = sanitizeFilenamePart(complaint.complaintNumber);
    const filename = `sifon-service-complaint-${safeId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const pdfDoc = generateComplaintPDF(complaint, imageBuffers);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    next(err);
  }
}

export async function exportComplaintsPDF(req, res, next) {
  try {
    const isExportAll = req.query.exportAll === 'true';
    const isCompletedOnly = req.query.completedOnly === 'true';
    let query = {};

    if (!isExportAll) {
      query = buildComplaintQuery(req.query);
    } else {
      query = { isArchived: false };
      if (isCompletedOnly) {
        query.status = { $in: COMPLETED_STATUSES };
      } else {
        query.status = { $nin: COMPLETED_STATUSES };
      }
    }

    const sortOption = isCompletedOnly
      ? { 'resolution.completedDate': -1, complaintDate: -1 }
      : { complaintDate: -1 };

    const complaints = await Complaint.find(query)
      .sort(sortOption)
      .limit(2000)
      .populate('assignedServicer', 'name')
      .populate('representative', 'name')
      .populate('brand', 'name')
      .populate('category', 'name')
      .lean();

    let representativeName = '';
    if (req.query.representative && req.query.representative !== 'all' && req.query.representative !== 'unassigned') {
      const rep = await Representative.findById(req.query.representative).select('name').lean();
      if (rep) representativeName = rep.name;
    }

    let servicerName = '';
    if (req.query.servicer && req.query.servicer !== 'all' && req.query.servicer !== 'unassigned') {
      const s = await Servicer.findById(req.query.servicer).select('name').lean();
      if (s) servicerName = s.name;
    }

    let brandName = '';
    if (req.query.brand && req.query.brand !== 'all') {
      const b = await Brand.findById(req.query.brand).select('name').lean();
      if (b) brandName = b.name;
    }

    let categoryName = '';
    if (req.query.category && req.query.category !== 'all') {
      const c = await Category.findById(req.query.category).select('name').lean();
      if (c) categoryName = c.name;
    }

    const filterSummary = {
      status: req.query.status && req.query.status !== 'all' ? req.query.status : null,
      priority: req.query.priority && req.query.priority !== 'all' ? req.query.priority : null,
      area: req.query.area && req.query.area !== 'all' ? req.query.area : null,
      brandName: brandName || null,
      categoryName: categoryName || null,
      servicerName: servicerName || (req.query.servicer === 'unassigned' ? 'Unassigned' : null),
      representativeName: representativeName || (req.query.representative === 'unassigned' ? 'Not assigned' : null),
      search: req.query.search || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      completedStartDate: req.query.completedStartDate || null,
      completedEndDate: req.query.completedEndDate || null,
      isCompletedReport: isCompletedOnly,
      reportTitle: isCompletedOnly ? 'sifon-service COMPLETED COMPLAINTS' : 'sifon-service ACTIVE COMPLAINTS',
      reportSubtitle: isCompletedOnly
        ? `Completed Complaint Register Report  -  Total Records: ${complaints.length}`
        : `Active Complaint Register Report  -  Total Records: ${complaints.length}`,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    let filename;
    if (isCompletedOnly) {
      filename = isExportAll
        ? `sifon-service-all-completed-complaints-${dateStr}.pdf`
        : `sifon-service-filtered-completed-complaints-${dateStr}.pdf`;
    } else {
      filename = isExportAll
        ? `sifon-service-all-active-complaints-${dateStr}.pdf`
        : `sifon-service-filtered-active-complaints-${dateStr}.pdf`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const pdfDoc = generateComplaintReportPDF(complaints, filterSummary);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    next(err);
  }
}

export async function archiveComplaint(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    complaint.isArchived = true;
    complaint.archivedAt = new Date();
    complaint.version += 1;

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'ARCHIVED',
      details: 'Complaint archived',
      timestamp: new Date(),
    });

    await complaint.save();

    res.json({
      success: true,
      message: `Complaint ${complaint.complaintNumber} archived successfully`,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

export async function restoreComplaint(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid complaint ID' } });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: { message: 'Complaint not found' } });
    }

    complaint.isArchived = false;
    complaint.archivedAt = null;
    complaint.version += 1;

    complaint.timeline.push({
      actor: req.admin.name || 'Admin',
      actorId: req.admin._id,
      action: 'RESTORED',
      details: 'Complaint restored from archive',
      timestamp: new Date(),
    });

    await complaint.save();

    res.json({
      success: true,
      message: `Complaint ${complaint.complaintNumber} restored successfully`,
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns prefilled Click-to-Chat WhatsApp URL for a complaint based on saved settings template.
 */
export async function getComplaintWhatsAppLink(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID' }
      });
    }

    const complaint = await Complaint.findById(id)
      .populate('brand category assignedServicer')
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found' }
      });
    }

    let settings;
    try {
      settings = await getNotificationSettings();
    } catch {
      return res.json({
        success: true,
        data: {
          url: '',
          isValid: false,
          reason: 'SETTINGS_ERROR',
          error: 'Could not load WhatsApp settings. Please retry.',
        },
      });
    }

    const isClickToChatActive = settings.clickToChatEnabled !== false;
    const linkData = buildWhatsAppClickToChatUrl(
      complaint.customerPhone,
      settings.customMessageDraft,
      complaint,
      settings.companyName,
      complaint.countryCode || '+91',
      isClickToChatActive
    );

    res.json({
      success: true,
      data: linkData,
    });
  } catch (err) {
    next(err);
  }
}
