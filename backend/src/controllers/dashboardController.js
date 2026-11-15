import { Complaint, COMPLETED_STATUSES } from '../models/Complaint.js';
import { Servicer } from '../models/Servicer.js';

export async function getDashboardStats(req, res, next) {
  try {
    const baseMatch = { isArchived: false };

    // Aggregate counts by status
    const statusAgg = await Complaint.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      Registered: 0,
      Assigned: 0,
      'In Progress': 0,
      'On Hold': 0,
      Resolved: 0,
      Closed: 0,
      Cancelled: 0,
    };

    let totalActive = 0;
    statusAgg.forEach(item => {
      if (item._id && statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      if (item._id && !COMPLETED_STATUSES.includes(item._id)) {
        totalActive += item.count;
      }
    });

    // Recent 8 active (non-completed) complaints
    const recentComplaints = await Complaint.find({
      ...baseMatch,
      status: { $nin: COMPLETED_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('assignedServicer', 'name phone')
      .select('complaintNumber complaintDate customerName customerPhone productName area status priority assignedServicer servicerNameSnapshot')
      .lean();

    // Complaints by servicer (active only)
    const servicerAgg = await Complaint.aggregate([
      { $match: { ...baseMatch, status: { $nin: COMPLETED_STATUSES }, assignedServicer: { $ne: null } } },
      { $group: { _id: '$assignedServicer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Populate servicer names for servicerAgg
    const servicerIds = servicerAgg.map(item => item._id);
    const servicers = await Servicer.find({ _id: { $in: servicerIds } }).select('name').lean();
    const servicerMap = new Map(servicers.map(s => [String(s._id), s.name]));

    const complaintsByServicer = servicerAgg.map(item => ({
      servicerId: item._id,
      name: servicerMap.get(String(item._id)) || 'Unknown',
      count: item.count,
    }));

    // Count unassigned active complaints
    const unassignedCount = await Complaint.countDocuments({
      ...baseMatch,
      $or: [{ assignedServicer: null }, { assignedServicer: { $exists: false } }],
      status: { $in: ['Registered', 'On Hold'] }
    });

    const completedCount = COMPLETED_STATUSES.reduce(
      (sum, st) => sum + (statusCounts[st] || 0),
      0
    );

    // Recent completed complaints (up to 6)
    const recentCompletedComplaints = await Complaint.find({
      ...baseMatch,
      status: { $in: COMPLETED_STATUSES },
    })
      .sort({ 'resolution.completedDate': -1, updatedAt: -1 })
      .limit(6)
      .populate('assignedServicer', 'name phone')
      .select('complaintNumber complaintDate customerName customerPhone productName area status priority assignedServicer servicerNameSnapshot resolution')
      .lean();

    res.json({
      success: true,
      data: {
        totalActive,
        statusCounts,
        completedCount,
        recentComplaints,
        recentCompletedComplaints,
        complaintsByServicer,
        unassignedCount,
      }
    });
  } catch (err) {
    next(err);
  }
}

