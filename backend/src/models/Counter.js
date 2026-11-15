import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  }
});

export const Counter = mongoose.model('Counter', counterSchema);

export async function getNextComplaintNumber() {
  const currentYear = new Date().getFullYear();
  const counterId = `complaintNumber_${currentYear}`;
  
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(5, '0');
  return `RCW-${currentYear}-${paddedSeq}`;
}

