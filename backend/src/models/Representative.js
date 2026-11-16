import mongoose from 'mongoose';

const representativeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
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

representativeSchema.index({ name: 1, isActive: 1 });

export const Representative = mongoose.model('Representative', representativeSchema);

