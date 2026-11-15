import mongoose from 'mongoose';

const servicerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  serviceArea: {
    type: String,
    trim: true,
    default: '',
  },
  specialization: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  }
}, {
  timestamps: true,
});

export const Servicer = mongoose.model('Servicer', servicerSchema);

