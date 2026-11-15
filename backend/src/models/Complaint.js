import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
  },
  storageKey: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  storageProvider: {
    type: String,
    default: 'local',
    enum: ['local', 'cloudinary'],
  },
  cloudinaryPublicId: {
    type: String,
    default: '',
  },
  resourceType: {
    type: String,
    default: 'image',
  },
  deliveryType: {
    type: String,
    default: 'authenticated',
  }
});

const serviceNoteSchema = new mongoose.Schema({
  note: {
    type: String,
    required: true,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  createdByName: {
    type: String,
    default: 'Admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const timelineSchema = new mongoose.Schema({
  actor: {
    type: String,
    default: 'Admin',
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  action: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    default: '',
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

const resolutionSchema = new mongoose.Schema({
  workPerformed: {
    type: String,
    trim: true,
    default: '',
  },
  resolutionNotes: {
    type: String,
    trim: true,
    default: '',
  },
  partsReplaced: {
    type: String,
    trim: true,
    default: '',
  },
  serviceCharge: {
    type: Number,
    min: 0,
    default: 0,
  },
  completedDate: {
    type: Date,
  },
  additionalNotes: {
    type: String,
    trim: true,
    default: '',
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  completedByName: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  complaintNumber: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  complaintNumberLower: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  complaintDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  countryCode: {
    type: String,
    default: '+91',
    trim: true,
  },
  alternatePhone: {
    type: String,
    trim: true,
    default: '',
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  customerAddress: {
    type: String,
    required: true,
    trim: true,
  },
  area: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    index: true,
  },
  brandNameSnapshot: {
    type: String,
    default: 'Not assigned',
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
  },
  categoryNameSnapshot: {
    type: String,
    default: 'Not assigned',
    trim: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  modelNumber: {
    type: String,
    trim: true,
    default: '',
  },
  serialNumber: {
    type: String,
    trim: true,
    default: '',
  },
  purchaseDate: {
    type: Date,
  },
  warrantyStatus: {
    type: String,
    enum: ['in_warranty', 'out_of_warranty', 'unknown'],
    default: 'unknown',
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  assignedServicer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Servicer',
    index: true,
  },
  servicerNameSnapshot: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Registered', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled'],
    default: 'Registered',
    index: true,
  },
  scheduledServiceDate: {
    type: Date,
  },
  internalNotes: {
    type: String,
    trim: true,
    default: '',
  },
  whatsappNotification: {
    requested: { type: Boolean, default: false },
    destinationPhone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['None', 'Queued', 'Processing', 'Accepted by provider', 'Delivered', 'Read', 'Failed', 'Unknown'],
      default: 'None',
    },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppNotification' },
    error: { type: String, default: '' },
    lastUpdated: { type: Date },
  },
  attachments: [attachmentSchema],
  serviceNotes: [serviceNoteSchema],
  resolution: {
    type: resolutionSchema,
    default: () => ({}),
  },
  timeline: [timelineSchema],
  version: {
    type: Number,
    default: 0,
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  archivedAt: {
    type: Date,
  }
}, {
  timestamps: true,
});

complaintSchema.index({ 'resolution.completedDate': -1 });

complaintSchema.pre('validate', function (next) {
  if (this.complaintNumber) {
    this.complaintNumber = String(this.complaintNumber).trim();
    this.complaintNumberLower = this.complaintNumber.toLowerCase();
  }
  next();
});

export const COMPLETED_STATUSES = Object.freeze(['Resolved', 'Closed']);
export const ACTIVE_STATUSES = Object.freeze(['Registered', 'Assigned', 'In Progress', 'On Hold', 'Cancelled']);

export const Complaint = mongoose.model('Complaint', complaintSchema);
