import mongoose from 'mongoose';

const DEFAULT_DRAFT = `Hello {{customer_name}}, your complaint {{complaint_id}} has been registered with {{company_name}}.

Brand: {{brand_name}}
Category: {{category_name}}
Product: {{product_name}}
Status: {{status}}

Our service team will contact you with further updates. Thank you.`;

const notificationSettingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'global_whatsapp_settings',
  },
  enabled: {
    type: Boolean,
    default: false,
  },
  clickToChatEnabled: {
    type: Boolean,
    default: true,
  },
  businessPhoneNumber: {
    type: String,
    default: '',
    trim: true,
  },
  templateName: {
    type: String,
    default: 'sifon_complaint_confirmation',
    trim: true,
  },
  templateLanguage: {
    type: String,
    default: 'en_US',
    trim: true,
  },
  companyName: {
    type: String,
    default: 'sifon-service',
    trim: true,
  },
  customMessageDraft: {
    type: String,
    default: DEFAULT_DRAFT,
  },
  templateParameters: {
    type: [String],
    default: [
      'customer_name',
      'complaint_id',
      'brand_name',
      'category_name',
      'product_name',
      'servicer_name',
      'status',
      'registered_date',
      'company_name',
    ],
  },
  testRecipientPhone: {
    type: String,
    default: '',
    trim: true,
  },
  senderStatus: {
    type: String,
    enum: ['Not configured', 'Setup required', 'Ready', 'Connection error'],
    default: 'Not configured',
  },
  senderStatusMessage: {
    type: String,
    default: '',
  },
  verifiedProviderNumber: {
    type: String,
    default: '',
  },
  verifiedProviderName: {
    type: String,
    default: '',
  },
  verifiedAt: {
    type: Date,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  }
}, {
  timestamps: true,
});

export const NotificationSettings = mongoose.model('NotificationSettings', notificationSettingsSchema);

export async function getNotificationSettings() {
  let settings = await NotificationSettings.findById('global_whatsapp_settings');
  if (!settings) {
    settings = await NotificationSettings.findOne({});
  }
  if (!settings) {
    settings = await NotificationSettings.create({
      _id: 'global_whatsapp_settings',
      enabled: false,
      businessPhoneNumber: '',
      templateName: 'sifon_complaint_confirmation',
      templateLanguage: 'en_US',
      companyName: 'sifon-service',
      customMessageDraft: DEFAULT_DRAFT,
      templateParameters: [
        'customer_name',
        'complaint_id',
        'brand_name',
        'category_name',
        'product_name',
        'servicer_name',
        'status',
        'registered_date',
        'company_name',
      ],
      testRecipientPhone: '',
      senderStatus: 'Not configured',
      clickToChatEnabled: true,
    });
  } else {
    if (settings.clickToChatEnabled === undefined) {
      settings.clickToChatEnabled = true;
      await settings.save();
    }
    if (!settings.templateParameters || settings.templateParameters.length === 0) {
      settings.templateParameters = [
        'customer_name',
        'complaint_id',
        'brand_name',
        'category_name',
        'product_name',
        'servicer_name',
        'status',
        'registered_date',
        'company_name',
      ];
    }
  }
  return settings;
}

