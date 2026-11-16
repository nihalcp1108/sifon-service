import mongoose from 'mongoose';
import { Representative } from '../models/Representative.js';
import { Complaint, COMPLETED_STATUSES } from '../models/Complaint.js';
import { representativeSchema, representativeUpdateSchema } from '../validators/schemas.js';

export async function getRepresentatives(req, res, next) {
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
        ];
      }
    }

    const representatives = await Representative.find(query).sort({ name: 1 }).lean();

    // Aggregate active and completed complaint counts in a single query
    const counts = await Complaint.aggregate([
      {
        $match: {
          isArchived: false,
          representative: { $ne: null },
        }
      },
      {
        $facet: {
          active: [
            { $match: { status: { $nin: COMPLETED_STATUSES } } },
            { $group: { _id: '$representative', count: { $sum: 1 } } }
          ],
          completed: [
            { $match: { status: { $in: COMPLETED_STATUSES } } },
            { $group: { _id: '$representative', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const activeMap = new Map();
    counts[0]?.active?.forEach(item => {
      activeMap.set(String(item._id), item.count);
    });

    const completedMap = new Map();
    counts[0]?.completed?.forEach(item => {
      completedMap.set(String(item._id), item.count);
    });

    const result = representatives.map(r => ({
      ...r,
      activeComplaintsCount: activeMap.get(String(r._id)) || 0,
      completedComplaintsCount: completedMap.get(String(r._id)) || 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRepresentativeById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid representative ID' } });
    }

    const rep = await Representative.findById(id).lean();
    if (!rep) {
      return res.status(404).json({ success: false, error: { message: 'Representative not found' } });
    }

    const activeCount = await Complaint.countDocuments({
      representative: rep._id,
      isArchived: false,
      status: { $nin: COMPLETED_STATUSES },
    });

    const completedCount = await Complaint.countDocuments({
      representative: rep._id,
      isArchived: false,
      status: { $in: COMPLETED_STATUSES },
    });

    res.json({
      success: true,
      data: {
        ...rep,
        activeComplaintsCount: activeCount,
        completedComplaintsCount: completedCount,
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createRepresentative(req, res, next) {
  try {
    const parseResult = representativeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid representative data',
          details: parseResult.error.errors,
        }
      });
    }

    const rep = await Representative.create(parseResult.data);

    res.status(201).json({
      success: true,
      message: 'Representative added successfully',
      data: rep,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRepresentative(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid representative ID' } });
    }

    const parseResult = representativeUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid representative update data',
          details: parseResult.error.errors,
        }
      });
    }

    const rep = await Representative.findByIdAndUpdate(id, parseResult.data, { new: true });
    if (!rep) {
      return res.status(404).json({ success: false, error: { message: 'Representative not found' } });
    }

    // If name changed, update snapshot on complaints
    if (parseResult.data.name) {
      await Complaint.updateMany(
        { representative: rep._id },
        { representativeNameSnapshot: rep.name }
      );
    }

    res.json({
      success: true,
      message: 'Representative updated successfully',
      data: rep,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleRepresentativeStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid representative ID' } });
    }

    const rep = await Representative.findById(id);
    if (!rep) {
      return res.status(404).json({ success: false, error: { message: 'Representative not found' } });
    }

    rep.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !rep.isActive;
    await rep.save();

    res.json({
      success: true,
      message: `Representative ${rep.isActive ? 'activated' : 'deactivated'} successfully`,
      data: rep,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteRepresentative(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid representative ID' } });
    }

    const count = await Complaint.countDocuments({ representative: id });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DELETE_REFERENCED',
          message: `Cannot delete representative associated with ${count} complaint(s). Deactivate instead.`,
        }
      });
    }

    const rep = await Representative.findByIdAndDelete(id);
    if (!rep) {
      return res.status(404).json({ success: false, error: { message: 'Representative not found' } });
    }

    res.json({
      success: true,
      message: 'Representative deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

