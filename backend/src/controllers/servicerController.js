import mongoose from 'mongoose';
import { Servicer } from '../models/Servicer.js';
import { Complaint } from '../models/Complaint.js';
import { servicerSchema, servicerUpdateSchema } from '../validators/schemas.js';

export async function getServicers(req, res, next) {
  try {
    const { search, activeOnly } = req.query;

    const query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }

    if (search && typeof search === 'string') {
      const sanitized = search.trim().slice(0, 50);
      if (sanitized) {
        const regex = new RegExp(sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { name: regex },
          { phone: regex },
          { email: regex },
          { serviceArea: regex },
          { specialization: regex },
        ];
      }
    }

    const servicers = await Servicer.find(query).sort({ name: 1 }).lean();

    // Aggregate active assigned complaint counts
    const activeCounts = await Complaint.aggregate([
      {
        $match: {
          isArchived: false,
          assignedServicer: { $ne: null },
          status: { $nin: ['Resolved', 'Closed', 'Cancelled'] }
        }
      },
      {
        $group: {
          _id: '$assignedServicer',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = new Map();
    activeCounts.forEach(item => {
      countMap.set(String(item._id), item.count);
    });

    const result = servicers.map(s => ({
      ...s,
      activeComplaintsCount: countMap.get(String(s._id)) || 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createServicer(req, res, next) {
  try {
    const parseResult = servicerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid servicer data',
          details: parseResult.error.errors,
        }
      });
    }

    const servicer = await Servicer.create(parseResult.data);

    res.status(201).json({
      success: true,
      message: 'Servicer added successfully',
      data: servicer,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateServicer(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid servicer ID' } });
    }

    const parseResult = servicerUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid servicer update data',
          details: parseResult.error.errors,
        }
      });
    }

    const servicer = await Servicer.findByIdAndUpdate(id, parseResult.data, { new: true });
    if (!servicer) {
      return res.status(404).json({ success: false, error: { message: 'Servicer not found' } });
    }

    // If name changed, optionally update snapshot on active complaints
    if (parseResult.data.name) {
      await Complaint.updateMany(
        { assignedServicer: servicer._id },
        { servicerNameSnapshot: servicer.name }
      );
    }

    res.json({
      success: true,
      message: 'Servicer updated successfully',
      data: servicer,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleServicerStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid servicer ID' } });
    }

    const servicer = await Servicer.findById(id);
    if (!servicer) {
      return res.status(404).json({ success: false, error: { message: 'Servicer not found' } });
    }

    servicer.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !servicer.isActive;
    await servicer.save();

    res.json({
      success: true,
      message: `Servicer ${servicer.isActive ? 'activated' : 'deactivated'} successfully`,
      data: servicer,
    });
  } catch (err) {
    next(err);
  }
}

