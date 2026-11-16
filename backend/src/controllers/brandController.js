import mongoose from 'mongoose';
import { Brand } from '../models/Brand.js';
import { Complaint } from '../models/Complaint.js';
import { generateComplaintReportPDF, sanitizeFilenamePart } from '../services/pdfService.js';

export async function getBrands(req, res, next) {
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

    const brands = await Brand.find(query).sort({ name: 1 }).lean();

    // Aggregate active complaint counts per brand
    const counts = await Complaint.aggregate([
      {
        $match: {
          isArchived: false,
          brand: { $ne: null },
        }
      },
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 },
        }
      }
    ]);

    const countMap = new Map();
    counts.forEach(c => countMap.set(String(c._id), c.count));

    const result = brands.map(b => ({
      ...b,
      complaintsCount: countMap.get(String(b._id)) || 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createBrand(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Brand name is required.' }
      });
    }

    const nameLower = name.toLowerCase();
    const existing = await Brand.findOne({ nameLower });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_BRAND', message: 'A brand with this name already exists.' }
      });
    }

    const brand = await Brand.create({
      name,
      description,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: brand,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_BRAND', message: 'A brand with this name already exists.' }
      });
    }
    next(err);
  }
}

export async function updateBrand(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid brand ID' } });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ success: false, error: { message: 'Brand not found' } });
    }

    const name = req.body.name !== undefined ? String(req.body.name).trim() : brand.name;
    const description = req.body.description !== undefined ? String(req.body.description).trim() : brand.description;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Brand name cannot be blank.' }
      });
    }

    // Check duplicate if name changed
    if (name.toLowerCase() !== brand.nameLower) {
      const existing = await Brand.findOne({ nameLower: name.toLowerCase(), _id: { $ne: brand._id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_BRAND', message: 'A brand with this name already exists.' }
        });
      }
    }

    brand.name = name;
    brand.description = description;
    if (req.body.isActive !== undefined) {
      brand.isActive = Boolean(req.body.isActive);
    }
    await brand.save();

    // Update snapshots on active complaints asynchronously
    Complaint.updateMany({ brand: brand._id }, { brandNameSnapshot: brand.name }).exec().catch(() => {});

    res.json({
      success: true,
      message: 'Brand updated successfully',
      data: brand,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_BRAND', message: 'A brand with this name already exists.' }
      });
    }
    next(err);
  }
}

export async function toggleBrandStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid brand ID' } });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ success: false, error: { message: 'Brand not found' } });
    }

    brand.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !brand.isActive;
    await brand.save();

    res.json({
      success: true,
      message: `Brand ${brand.isActive ? 'activated' : 'deactivated'} successfully`,
      data: brand,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBrandComplaintsPDF(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid brand ID' } });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res.status(404).json({ success: false, error: { message: 'Brand not found' } });
    }

    const complaints = await Complaint.find({ brand: brand._id, isArchived: false })
      .sort({ complaintDate: -1 })
      .populate('assignedServicer', 'name')
      .populate('representative', 'name')
      .populate('brand', 'name')
      .populate('category', 'name')
      .lean();

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeBrand = sanitizeFilenamePart(brand.name);
    const filename = `sifon-service-brand-${safeBrand}-${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const filterSummary = {
      reportTitle: 'sifon-service BRAND COMPLAINT REPORT',
      reportSubtitle: `Brand: ${brand.name}  -  Total Records: ${complaints.length}`,
      brandName: brand.name,
    };

    const doc = generateComplaintReportPDF(complaints, filterSummary);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    next(err);
  }
}

