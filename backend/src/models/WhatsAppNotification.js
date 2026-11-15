import mongoose from 'mongoose';

const whatsappNotificationSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true,
    index: true,
  },
  complaintNumber: {
    type: String,
    required: true,
  },
  destinationPhone: {
    type: String,
    required: true,
    trim: true,
  },
  consent: {
    agreed: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  templateName: {
    type: String,
    default: 'sifon_complaint_confirmation',
  },
  templateLanguage: {
    type: String,
    default: 'en_US',
  },
  renderedMessage: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Queued', 'Processing', 'Accepted by provider', 'Delivered', 'Read', 'Failed', 'Unknown'],
    default: 'Queued',
    index: true,
  },
  attemptCount: {
    type: Number,
    default: 0,
  },
  providerMessageId: {
    type: String,
    index: true,
    default: '',
  },
  errorDetails: {
    type: String,
    default: '',
  },
  lastAttemptAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  }
}, {
  timestamps: true,
});

export const WhatsAppNotification = mongoose.model('WhatsAppNotification', whatsappNotificationSchema);

