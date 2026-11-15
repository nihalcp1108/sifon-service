import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLower: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  description: {
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

categorySchema.pre('validate', function (next) {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  next();
});

export const Category = mongoose.model('Category', categorySchema);

