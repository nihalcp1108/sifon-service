import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { getLocalFilePath } from './storageService.js';

/**
 * Sanitizes strings for inclusion in safe file names.
 */
export function sanitizeFilenamePart(str = '') {
  return String(str)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 60);
}

/**
 * Formats a Date object into Asia/Kolkata timezone string.
 */
export function formatKolkataDateTime(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatKolkataDate(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

/**
 * Generates an Individual Complaint PDF.
 * Returns a readable stream / PDFKit instance.
 */
export function generateComplaintPDF(complaint, imageBuffers = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
  });

  const primaryColor = '#0f766e'; // Teal / slate theme for sifon-service
  const secondaryColor = '#0284c7';
  const darkTextColor = '#0f172a';
  const mutedTextColor = '#475569';
  const borderColor = '#e2e8f0';
  const lightBg = '#f8fafc';

  // --- Header ---
  doc.rect(40, 40, 515, 60).fill(lightBg);
  doc.rect(40, 40, 515, 60).stroke(borderColor);

  doc
    .fillColor(primaryColor)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('sifon-service', 55, 52, { continued: true })
    .fontSize(10)
    .font('Helvetica')
    .fillColor(mutedTextColor)
    .text('  |  Complaint Management System');

  doc
    .fontSize(13)
    .font('Helvetica-Bold')
    .fillColor(darkTextColor)
    .text(`Complaint ID: ${complaint.complaintNumber}`, 55, 76);

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(mutedTextColor)
    .text(`Registered: ${formatKolkataDateTime(complaint.complaintDate)}`, 350, 78, { align: 'right', width: 190 });

  doc.moveDown(2);
  let y = 115;

  // Helper for section header
  function renderSectionHeader(title, curY) {
    if (curY > 720) {
      doc.addPage();
      curY = 50;
    }
    doc
      .fillColor(primaryColor)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), 40, curY);

    doc
      .strokeColor(secondaryColor)
      .lineWidth(1.5)
      .moveTo(40, curY + 15)
      .lineTo(555, curY + 15)
      .stroke();

    return curY + 24;
  }

  // Helper to render key-value grid
  function renderKV(label, value, x, curY, width = 240) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(mutedTextColor)
      .text(label, x, curY);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(darkTextColor)
      .text(value || 'N/A', x, curY + 12, { width, ellipsis: true });
  }

  // --- Registration & Attribution ---
  y = renderSectionHeader('Registration & Attribution', y);
  renderKV('Registration Date', formatKolkataDateTime(complaint.complaintDate), 40, y, 150);
  renderKV('Scheduled Date', formatKolkataDateTime(complaint.scheduledServiceDate), 200, y, 150);
  y += 30;
  // Relative order: Shop Name -> REP
  renderKV('Shop Name', complaint.shopName || 'None', 40, y, 150);
  renderKV('Registered by (REP)', complaint.representative?.name || complaint.representativeNameSnapshot || 'Not assigned', 200, y, 320);
  y += 35;

  // --- Customer & Product Information ---
  y = renderSectionHeader('Customer & Product Information', y);
  const brandName = complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned';
  const warrantyText = complaint.warrantyStatus === 'in_warranty'
    ? 'In Warranty'
    : complaint.warrantyStatus === 'out_of_warranty'
    ? 'Out of Warranty'
    : 'Unknown';

  // Relative order: Phone Number -> Place -> Brand
  renderKV('Customer Name', complaint.customerName, 40, y, 150);
  renderKV('Phone Number', complaint.customerPhone, 200, y, 150);
  renderKV('Place', complaint.area || 'N/A', 360, y, 195);
  y += 30;

  renderKV('Brand', brandName, 40, y, 150);
  renderKV('Product Name', complaint.productName, 200, y, 150);
  renderKV('Warranty Status', warrantyText, 360, y, 195);
  y += 30;

  renderKV('Alternate Phone', complaint.alternatePhone || 'None', 40, y, 150);
  renderKV('Email', complaint.customerEmail || 'None', 200, y, 150);
  renderKV('Address', complaint.customerAddress, 360, y, 195);
  y += 35;

  renderKV('Model Number', complaint.modelNumber || 'None', 40, y, 150);
  renderKV('Serial Number', complaint.serialNumber || 'None', 200, y, 150);
  renderKV('Purchase Date', complaint.purchaseDate ? formatKolkataDate(complaint.purchaseDate) : 'None', 360, y, 195);
  y += 35;

  // --- Resolution Information (if any) ---
  if (complaint.resolution && (complaint.resolution.resolutionNotes || complaint.resolution.workPerformed || complaint.resolution.completedDate || ['Resolved', 'Closed'].includes(complaint.status))) {
    y = renderSectionHeader('Service Completion Details', y);
    if (complaint.resolution.workPerformed) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(mutedTextColor).text('Work Performed:', 40, y);
      y += 12;
      doc.fontSize(9).font('Helvetica').fillColor(darkTextColor).text(complaint.resolution.workPerformed, 40, y, { width: 515 });
      y += doc.heightOfString(complaint.resolution.workPerformed, { width: 515 }) + 10;
    } else {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(mutedTextColor).text('Work Performed:', 40, y);
      y += 12;
      doc.fontSize(9).font('Helvetica').fillColor(darkTextColor).text('Not recorded', 40, y, { width: 515 });
      y += 18;
    }

    if (complaint.resolution.resolutionNotes) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(mutedTextColor).text('Resolution Notes:', 40, y);
      y += 12;
      doc.fontSize(9).font('Helvetica').fillColor(darkTextColor).text(complaint.resolution.resolutionNotes, 40, y, { width: 515 });
      y += doc.heightOfString(complaint.resolution.resolutionNotes, { width: 515 }) + 10;
    }

    if (complaint.resolution.additionalNotes) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(mutedTextColor).text('Additional Notes:', 40, y);
      y += 12;
      doc.fontSize(9).font('Helvetica').fillColor(darkTextColor).text(complaint.resolution.additionalNotes, 40, y, { width: 515 });
      y += doc.heightOfString(complaint.resolution.additionalNotes, { width: 515 }) + 10;
    }

    renderKV('Parts Replaced', complaint.resolution.partsReplaced || 'None', 40, y);
    const chargeVal = complaint.resolution.serviceCharge !== undefined && complaint.resolution.serviceCharge !== null
      ? Number(complaint.resolution.serviceCharge)
      : 0;
    const chargeStr = `INR ${chargeVal.toFixed(2)}`;
    renderKV('Service Charge', chargeStr, 200, y);
    renderKV('Completion Date', complaint.resolution.completedDate ? formatKolkataDateTime(complaint.resolution.completedDate) : 'Not recorded', 360, y);
    y += 35;

    renderKV('Recorded By', complaint.resolution.completedByName || 'Admin', 40, y);
    y += 35;
  }

  // --- Attachments List & Thumbnails ---
  if (complaint.attachments && complaint.attachments.length > 0) {
    y = renderSectionHeader(`Attachments (${complaint.attachments.length})`, y);

    for (const att of complaint.attachments) {
      if (y > 730) {
        doc.addPage();
        y = 50;
      }

      const sizeKb = (att.fileSize / 1024).toFixed(1);
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(darkTextColor)
        .text(`• ${att.originalName}`, 45, y, { continued: true })
        .font('Helvetica')
        .fillColor(mutedTextColor)
        .text(`  (${att.mimeType}, ${sizeKb} KB, uploaded ${formatKolkataDateTime(att.uploadedAt)})`);

      y += 15;

      // Safe image thumbnail insertion for both Cloudinary and local JPEG/PNG
      const isSupportedImage = att.mimeType === 'image/jpeg' || att.mimeType === 'image/png';
      if (isSupportedImage) {
        let imgSource = null;
        if (imageBuffers && att._id && imageBuffers[att._id.toString()]) {
          imgSource = imageBuffers[att._id.toString()];
        } else if (att.storageProvider === 'local') {
          const localPath = getLocalFilePath(att.storageKey);
          if (localPath && fs.existsSync(localPath)) {
            imgSource = localPath;
          }
        }

        if (imgSource) {
          try {
            if (y > 660) {
              doc.addPage();
              y = 50;
            }
            doc.image(imgSource, 55, y, { fit: [90, 70] });
            y += 75;
          } catch {
            // If image fails to render, skip gracefully without crashing
          }
        }
      }
    }
  }

  // --- Service Notes ---
  if (complaint.serviceNotes && complaint.serviceNotes.length > 0) {
    y = renderSectionHeader(`Internal Service Notes (${complaint.serviceNotes.length})`, y);
    for (const note of complaint.serviceNotes) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(secondaryColor)
        .text(`[${formatKolkataDateTime(note.createdAt)}] ${note.createdByName || 'Admin'}:`, 40, y);
      y += 11;
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(darkTextColor)
        .text(note.note, 45, y, { width: 510 });
      y += doc.heightOfString(note.note, { width: 510 }) + 8;
    }
  }

  // --- FINAL COMPLAINT-CONTENT BLOCK: Complaint Description ---
  y = renderSectionHeader('Complaint Description', y);
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(mutedTextColor)
    .text('Subject:', 40, y);

  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor(darkTextColor)
    .text(complaint.subject || 'N/A', 90, y, { width: 460 });

  y += 20;

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(mutedTextColor)
    .text('Detailed Description:', 40, y);
  y += 14;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(darkTextColor)
    .text(complaint.description || 'N/A', 40, y, { width: 515, align: 'left' });

  y += doc.heightOfString(complaint.description || 'N/A', { width: 515 }) + 15;

  // --- Add Page Numbering on all buffered pages ---
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(mutedTextColor)
      .text(
        `sifon-service Complaint Management System  |  Page ${i + 1} of ${range.count}  |  Generated ${formatKolkataDateTime(new Date())}`,
        40,
        790,
        { align: 'center', width: 515 }
      );
  }

  return doc;
}

/**
 * Generates Complaint Report PDF (All, Filtered, Brand-specific, Category-specific).
 * Landscape A4 with repeated table headers across pages.
 */
export function generateComplaintReportPDF(complaints, filterSummary = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 20,
    bufferPages: true,
  });

  const primaryColor = '#0f766e';
  const darkTextColor = '#0f172a';
  const mutedTextColor = '#475569';
  const tableHeaderBg = '#f1f5f9';
  const tableBorder = '#cbd5e1';

  const isCompletedReport = Boolean(filterSummary.isCompletedReport);

  // Printable width for landscape A4 = ~800, margin 20
  const defaultColWidths = {
    num: 65,
    date: 50,
    customer: 70,
    phone: 90,
    place: 60,
    brand: 60,
    product: 75,
    shopName: 70,
    rep: 65,
    description: 195,
  };

  const completedColWidths = {
    num: 55,
    regDate: 45,
    customer: 60,
    phone: 80,
    place: 50,
    brand: 55,
    product: 60,
    shopName: 55,
    rep: 55,
    compDate: 50,
    charge: 45,
    work: 80,
    description: 110,
  };

  const colWidths = isCompletedReport ? completedColWidths : defaultColWidths;
  const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0); // 800

  // Draw Header
  const titleText = filterSummary.reportTitle || 'sifon-service COMPLAINT MANAGEMENT SYSTEM';
  doc
    .fillColor(primaryColor)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(titleText, 20, 24);

  const subTitle = filterSummary.reportSubtitle || `Complaint Register Report  -  Total Records: ${complaints.length}`;
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor(darkTextColor)
    .text(subTitle, 20, 42);

  // Filter summary text
  const filterParts = [];
  if (filterSummary.brandName) filterParts.push(`Brand: ${filterSummary.brandName}`);
  if (filterSummary.categoryName) filterParts.push(`Category: ${filterSummary.categoryName}`);
  if (filterSummary.area) filterParts.push(`Place: ${filterSummary.area}`);
  if (filterSummary.shopName) filterParts.push(`Shop: ${filterSummary.shopName}`);
  if (filterSummary.representativeName) filterParts.push(`REP: ${filterSummary.representativeName}`);
  if (filterSummary.search) filterParts.push(`Search: "${filterSummary.search}"`);
  if (filterSummary.startDate || filterSummary.endDate) {
    filterParts.push(`Date: ${filterSummary.startDate || 'start'} to ${filterSummary.endDate || 'now'}`);
  }
  if (filterSummary.completedStartDate || filterSummary.completedEndDate) {
    filterParts.push(`Completed: ${filterSummary.completedStartDate || 'start'} to ${filterSummary.completedEndDate || 'now'}`);
  }

  const filterText = filterParts.length > 0
    ? `Filters Applied: ${filterParts.join(' | ')}`
    : (isCompletedReport ? 'Filters: All Completed Complaints' : 'Filters: All Active Complaints');
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(mutedTextColor)
    .text(filterText, 20, 58, { width: 520 });

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(mutedTextColor)
    .text(`Generated: ${formatKolkataDateTime(new Date())}`, 560, 58, { align: 'right', width: 260 });

  let curY = 74;

  function renderTableHeader(y) {
    doc.rect(20, y, tableWidth, 18).fill(tableHeaderBg);
    doc.rect(20, y, tableWidth, 18).stroke(tableBorder);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor);
    let x = 23;

    // Relative order: Phone Number -> Place -> Brand
    // Relative order: Shop Name -> REP
    // Description is the last column
    const cols = isCompletedReport
      ? [
          { text: 'Complaint ID', width: colWidths.num },
          { text: 'Reg Date', width: colWidths.regDate },
          { text: 'Customer', width: colWidths.customer },
          { text: 'Phone Number', width: colWidths.phone },
          { text: 'Place', width: colWidths.place },
          { text: 'Brand', width: colWidths.brand },
          { text: 'Product', width: colWidths.product },
          { text: 'Shop Name', width: colWidths.shopName },
          { text: 'REP', width: colWidths.rep },
          { text: 'Completion Date', width: colWidths.compDate },
          { text: 'Charge (INR)', width: colWidths.charge },
          { text: 'Work Performed', width: colWidths.work },
          { text: 'Description', width: colWidths.description },
        ]
      : [
          { text: 'Complaint ID', width: colWidths.num },
          { text: 'Date', width: colWidths.date },
          { text: 'Customer', width: colWidths.customer },
          { text: 'Phone Number', width: colWidths.phone },
          { text: 'Place', width: colWidths.place },
          { text: 'Brand', width: colWidths.brand },
          { text: 'Product', width: colWidths.product },
          { text: 'Shop Name', width: colWidths.shopName },
          { text: 'REP', width: colWidths.rep },
          { text: 'Description', width: colWidths.description },
        ];

    for (const c of cols) {
      doc.text(c.text, x, y + 5, { width: c.width - 4, lineBreak: false, ellipsis: true });
      x += c.width;
    }

    return y + 18;
  }

  curY = renderTableHeader(curY);

  if (complaints.length === 0) {
    doc
      .fontSize(9.5)
      .font('Helvetica-Oblique')
      .fillColor(mutedTextColor)
      .text('No complaints match the specified criteria.', 20, curY + 25, { align: 'center', width: tableWidth });
  } else {
    for (let i = 0; i < complaints.length; i++) {
      const c = complaints[i];

      doc.fontSize(7).font('Helvetica');

      const repDisplay = c.representative?.name || c.representativeNameSnapshot || '-';
      const brandDisplay = c.brand?.name || c.brandNameSnapshot || '-';
      const phoneDisplay = c.alternatePhone
        ? `${c.customerPhone} / ${c.alternatePhone}`
        : (c.customerPhone || '-');
      const placeDisplay = c.area || '-';
      const shopDisplay = c.shopName || '-';
      const descDisplay = c.description || '-';

      let rowValues = [];
      let workStr = '-';
      if (isCompletedReport) {
        const compDateStr = c.resolution?.completedDate ? formatKolkataDate(c.resolution.completedDate) : 'Not recorded';
        const chargeNum = c.resolution?.serviceCharge !== undefined && c.resolution?.serviceCharge !== null
          ? Number(c.resolution.serviceCharge)
          : 0;
        workStr = c.resolution?.workPerformed || c.resolution?.resolutionNotes || '-';

        rowValues = [
          { text: c.complaintNumber, width: colWidths.num, bold: true },
          { text: formatKolkataDate(c.complaintDate), width: colWidths.regDate },
          { text: c.customerName, width: colWidths.customer },
          { text: phoneDisplay, width: colWidths.phone },
          { text: placeDisplay, width: colWidths.place },
          { text: brandDisplay, width: colWidths.brand },
          { text: c.productName, width: colWidths.product },
          { text: shopDisplay, width: colWidths.shopName },
          { text: repDisplay, width: colWidths.rep },
          { text: compDateStr, width: colWidths.compDate },
          { text: chargeNum.toFixed(2), width: colWidths.charge },
          { text: workStr, width: colWidths.work, isMultiLine: true },
          { text: descDisplay, width: colWidths.description, isMultiLine: true },
        ];
      } else {
        rowValues = [
          { text: c.complaintNumber, width: colWidths.num, bold: true },
          { text: formatKolkataDate(c.complaintDate), width: colWidths.date },
          { text: c.customerName, width: colWidths.customer },
          { text: phoneDisplay, width: colWidths.phone },
          { text: placeDisplay, width: colWidths.place },
          { text: brandDisplay, width: colWidths.brand },
          { text: c.productName, width: colWidths.product },
          { text: shopDisplay, width: colWidths.shopName },
          { text: repDisplay, width: colWidths.rep },
          { text: descDisplay, width: colWidths.description, isMultiLine: true },
        ];
      }

      // Calculate dynamic row height based on multiline description (and work performed)
      const descHeight = doc.heightOfString(descDisplay, { width: colWidths.description - 6, lineBreak: true });
      let rowHeight = Math.max(17, descHeight + 6);
      if (isCompletedReport && workStr !== '-') {
        const workHeight = doc.heightOfString(workStr, { width: colWidths.work - 6, lineBreak: true });
        rowHeight = Math.max(rowHeight, workHeight + 6);
      }
      rowHeight = Math.min(rowHeight, 480);

      // Check if new page is needed
      if (curY + rowHeight > 545) {
        doc.addPage();
        curY = 25;
        curY = renderTableHeader(curY);
      }

      // Alternating row background
      if (i % 2 === 1) {
        doc.rect(20, curY, tableWidth, rowHeight).fill('#f8fafc');
      }
      doc.rect(20, curY, tableWidth, rowHeight).stroke('#e2e8f0');

      doc.fontSize(7).font('Helvetica').fillColor(darkTextColor);
      let x = 23;

      for (const val of rowValues) {
        if (val.bold) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');

        if (val.isMultiLine) {
          doc.text(val.text || '-', x, curY + 4, {
            width: val.width - 4,
            lineBreak: true,
          });
        } else {
          doc.text(val.text || '-', x, curY + 4, {
            width: val.width - 4,
            lineBreak: false,
            ellipsis: true,
          });
        }
        x += val.width;
      }

      curY += rowHeight;
    }
  }

  // Number all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor(mutedTextColor)
      .text(
        `sifon-service Complaint Management System  |  Page ${i + 1} of ${range.count}`,
        20,
        572,
        { align: 'center', width: tableWidth }
      );
  }

  return doc;
}
