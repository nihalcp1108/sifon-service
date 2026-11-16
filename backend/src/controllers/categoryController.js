import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Complaint } from '../models/Complaint.js';
import { generateComplaintReportPDF, sanitizeFilenamePart } from '../services/pdfService.js';

export async function getCategories(req, res, next) {
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
        query.$or = [{ name: regex }, { description: regex }];
      }
    }

    const categories = await Category.find(query).sort({ name: 1 }).lean();

    // Aggregate active complaint counts per category
    const counts = await Complaint.aggregate([
      {
        $match: {
          isArchived: false,
          category: { $ne: null },
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        }
      }
    ]);

    const countMap = new Map();
    counts.forEach(c => countMap.set(String(c._id), c.count));

    const result = categories.map(cat => ({
      ...cat,
      complaintsCount: countMap.get(String(cat._id)) || 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category name is required.' }
      });
    }

    const nameLower = name.toLowerCase();
    const existing = await Category.findOne({ nameLower });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists.' }
      });
    }

    const category = await Category.create({
      name,
      description,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists.' }
      });
    }
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid category ID' } });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, error: { message: 'Category not found' } });
    }

    const name = req.body.name !== undefined ? String(req.body.name).trim() : category.name;
    const description = req.body.description !== undefined ? String(req.body.description).trim() : category.description;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category name cannot be blank.' }
      });
    }

    if (name.toLowerCase() !== category.nameLower) {
      const existing = await Category.findOne({ nameLower: name.toLowerCase(), _id: { $ne: category._id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists.' }
        });
      }
    }

    category.name = name;
    category.description = description;
    if (req.body.isActive !== undefined) {
      category.isActive = Boolean(req.body.isActive);
    }
    await category.save();

    // Update snapshots on active complaints asynchronously
    Complaint.updateMany({ category: category._id }, { categoryNameSnapshot: category.name }).exec().catch(() => {});

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_CATEGORY', message: 'A category with this name already exists.' }
      });
    }
    next(err);
  }
}

export async function toggleCategoryStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid category ID' } });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, error: { message: 'Category not found' } });
    }

    category.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryComplaintsPDF(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid category ID' } });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, error: { message: 'Category not found' } });
    }

    const complaints = await Complaint.find({ category: category._id, isArchived: false })
      .sort({ complaintDate: -1 })
      .populate('assignedServicer', 'name')
      .populate('representative', 'name')
      .populate('brand', 'name')
      .populate('category', 'name')
      .lean();

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeCategory = sanitizeFilenamePart(category.name);
    const filename = `sifon-service-category-${safeCategory}-${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const filterSummary = {
      reportTitle: 'sifon-service CATEGORY COMPLAINT REPORT',
      reportSubtitle: `Category: ${category.name}  -  Total Records: ${complaints.length}`,
      categoryName: category.name,
    };

    const doc = generateComplaintReportPDF(complaints, filterSummary);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    next(err);
  }
}

