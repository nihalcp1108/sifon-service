import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateComplaintPDF, generateComplaintReportPDF } from '../src/services/pdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));
    doc.end();
  });
}

async function run() {
  console.log('[Sample PDF] Generating sample individual complaint PDF...');

  const sampleComplaint = {
    complaintNumber: 'SIF-2026/00042',
    complaintDate: new Date('2026-11-10T10:30:00Z'),
    customerName: 'Ananya Deshmukh',
    customerPhone: '+91 98765 43210',
    alternatePhone: '+91 98111 22334',
    customerEmail: 'ananya.deshmukh@example.com',
    customerAddress: 'Flat 402, Sunshine Towers, 14th Main Road, HAL 2nd Stage, Bangalore - 560008',
    area: 'Indiranagar',
    brandNameSnapshot: 'Aquafresh',
    categoryNameSnapshot: 'Water Purifier',
    productName: '10L RO + UV Water Purifier',
    modelNumber: 'SIF-U-2026',
    serialNumber: 'SN-SIF-883921',
    purchaseDate: new Date('2025-06-15'),
    warrantyStatus: 'in_warranty',
    subject: 'Continuous dripping from pure water outlet and intermittent low pressure beep',
    description: `The customer reported that since yesterday evening, the pure water dispensing tap has been dripping continuously even when shut off. Additionally, the filtration unit has started beeping three short pulses every ten minutes, indicating abnormal intake pressure or cartridge resistance.

The customer verified that the main inlet ball valve is open and municipal water supply pressure is normal. They attempted power cycling the unit by switching off the electrical socket for thirty minutes, but the warning beeps recur immediately upon rebooting. Need technician to carry replacement sediment filters, solenoids, and a pressure gauge.`,
    priority: 'high',
    status: 'In Progress',
    scheduledServiceDate: new Date('2026-11-12T14:00:00Z'),
    assignedServicer: {
      name: 'Ramesh Kumar',
      phone: '9876543210',
      email: 'ramesh.service@rocoware.local',
      serviceArea: 'South Bangalore & Indiranagar',
    },
    servicerNameSnapshot: 'Ramesh Kumar',
    resolution: {
      workPerformed: 'Inspected input line pressure (found 1.2 bar). Dismantled primary sediment bowl and discovered excessive silt blockage. Flushed membrane housing and replaced inline solenoid valve #SV-24V.',
      resolutionNotes: 'Unit tested for 45 minutes under standard operating conditions. Output flow restored to 1.8 liters per minute with TDS reading 85 ppm (input 620 ppm). All warning beeps cleared.',
      partsReplaced: 'Solenoid Valve 24V DC (#SV-24V), 5 Micron Spun Sediment Filter Cartridge',
      serviceCharge: 1250,
      completedDate: new Date('2026-11-12T16:30:00Z'),
    },
    attachments: [
      {
        originalName: 'inlet_valve_leak.png',
        mimeType: 'image/png',
        fileSize: 245100,
        uploadedAt: new Date('2026-11-10T11:00:00Z'),
        storageProvider: 'local',
        storageKey: 'non_existent_key.png',
      },
      {
        originalName: 'purchase_invoice_2025.pdf',
        mimeType: 'application/pdf',
        fileSize: 780400,
        uploadedAt: new Date('2026-11-10T11:05:00Z'),
        storageProvider: 'local',
        storageKey: 'non_existent_doc.pdf',
      }
    ],
    serviceNotes: [
      {
        note: 'Customer contacted over phone to verify availability for afternoon appointment. Customer confirmed.',
        createdByName: 'Admin Operator',
        createdAt: new Date('2026-11-11T09:30:00Z'),
      },
      {
        note: 'Field technician Ramesh dispatched with spare solenoid valve kit.',
        createdByName: 'Admin Operator',
        createdAt: new Date('2026-11-12T13:45:00Z'),
      }
    ],
    timeline: [
      {
        action: 'REGISTERED',
        details: 'Complaint RCW-2026-00042 registered by phone intake',
        actor: 'Admin Operator',
        timestamp: new Date('2026-11-10T10:30:00Z'),
      },
      {
        action: 'SERVICER_ASSIGNED',
        details: 'Assigned to field technician Ramesh Kumar',
        actor: 'Admin Operator',
        timestamp: new Date('2026-11-11T09:40:00Z'),
      },
      {
        action: 'STATUS_CHANGED',
        details: 'Status updated from "Assigned" to "In Progress"',
        actor: 'Admin Operator',
        timestamp: new Date('2026-11-12T13:50:00Z'),
      }
    ]
  };

  const doc1 = generateComplaintPDF(sampleComplaint);
  const pdfBuffer1 = await streamToBuffer(doc1);
  const outPath1 = path.join(__dirname, 'sample-complaint.pdf');
  fs.writeFileSync(outPath1, pdfBuffer1);
  console.log(`[Sample PDF] Saved individual complaint PDF to ${outPath1} (${pdfBuffer1.length} bytes)`);

  console.log('[Sample PDF] Generating sample multi-page complaint report PDF...');
  const sampleList = Array.from({ length: 35 }, (_, i) => ({
    complaintNumber: `RCW-2026-${String(100 + i).padStart(5, '0')}`,
    complaintDate: new Date(Date.now() - i * 86400000),
    customerName: `Customer ${i + 1} Sharma`,
    customerPhone: `98765000${String(i).padStart(2, '0')}`,
    productName: i % 2 === 0 ? 'Rocoware Pro Water Purifier' : 'Rocoware Industrial RO',
    area: ['Indiranagar', 'Koramangala', 'Whitefield', 'Jayanagar', 'HSR Layout'][i % 5],
    servicerNameSnapshot: i % 3 === 0 ? 'Unassigned' : (i % 2 === 0 ? 'Ramesh Kumar' : 'Sunil Rao'),
    priority: ['low', 'medium', 'high', 'urgent'][i % 4],
    status: ['Registered', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'][i % 6],
  }));

  const doc2 = generateComplaintReportPDF(sampleList, {
    status: 'All Statuses',
    priority: 'All Priorities',
    area: 'Bangalore Metropolitan Region',
  });
  const pdfBuffer2 = await streamToBuffer(doc2);
  const outPath2 = path.join(__dirname, 'sample-report.pdf');
  fs.writeFileSync(outPath2, pdfBuffer2);
  console.log(`[Sample PDF] Saved report PDF to ${outPath2} (${pdfBuffer2.length} bytes)`);

  console.log('[Sample PDF] Validation completed successfully.');
}

run().catch(err => {
  console.error('[Sample PDF Error]', err);
  process.exit(1);
});

