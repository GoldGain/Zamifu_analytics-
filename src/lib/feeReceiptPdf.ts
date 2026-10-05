import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FeeReceiptBalance {
  previousBalance: number;
  newBalance: number;
}

export interface FeeReceiptPdfData {
  schoolName?: string | null;
  learnerName: string;
  admissionNumber?: string | null;
  className?: string | null;
  termName?: string | null;
  academicYear?: string | number | null;
  amountPaid: number;
  paymentDate?: string | null;
  receiptNumber: string;
  paymentMethod?: string | null;
  reference?: string | null;
  previousBalance: number;
  newBalance: number;
}

const amountOf = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const timestampOf = (payment: any): number => {
  const timestamp = new Date(payment?.payment_date || payment?.created_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/**
 * Reconstruct the invoice balance immediately before/after one payment using
 * the invoice amount and the chronologically earlier payments on that invoice.
 */
export function calculateReceiptBalance(
  payment: any,
  invoiceTotal: number,
  relatedPayments: any[],
): FeeReceiptBalance {
  const paymentId = String(payment?.id || '');
  const targetTime = timestampOf(payment);
  const targetAmount = Math.max(0, amountOf(payment?.amount));
  const previousPaid = (relatedPayments || []).reduce((sum, row) => {
    if (!row || String(row.id || '') === paymentId) return sum;
    const rowTime = timestampOf(row);
    const isEarlier = rowTime < targetTime
      || (rowTime === targetTime && String(row.id || '').localeCompare(paymentId) < 0);
    return isEarlier ? sum + amountOf(row.amount) : sum;
  }, 0);
  const previousBalance = Math.max(0, amountOf(invoiceTotal) - previousPaid);
  return {
    previousBalance,
    newBalance: Math.max(0, previousBalance - targetAmount),
  };
}

const formatKsh = (value: number): string =>
  `Ksh ${Math.max(0, amountOf(value)).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

const filenamePart = (value: unknown): string =>
  String(value || 'receipt').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'receipt';

export function downloadFeeReceiptPdf(data: FeeReceiptPdfData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 37, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(data.schoolName || 'School', 105, 15, { align: 'center', maxWidth: 184 });
  doc.setFontSize(11);
  doc.text('OFFICIAL PAYMENT RECEIPT', 105, 27, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const paidDate = data.paymentDate
    ? new Date(data.paymentDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const term = [data.termName, data.academicYear].filter(Boolean).join(' ');
  const rows = [
    ['Receipt number', data.receiptNumber || '—'],
    ['Learner', data.learnerName || '—'],
    ['Admission number', data.admissionNumber || '—'],
    ['Class / stream', data.className || '—'],
    ['Term / year', term || '—'],
    ['Payment date', paidDate],
    ['Payment method', data.paymentMethod || '—'],
    ['Reference', data.reference || '—'],
    ['Previous balance', formatKsh(data.previousBalance)],
    ['Amount paid', formatKsh(data.amountPaid)],
    ['NEW BALANCE', formatKsh(data.newBalance)],
  ];
  autoTable(doc, {
    startY: 47,
    head: [['Receipt detail', 'Value']],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, textColor: [35, 45, 65], overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
    margin: { left: 19, right: 19 },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === rows.length - 1) {
        hook.cell.styles.fillColor = [220, 252, 231];
        hook.cell.styles.textColor = [21, 101, 52];
        hook.cell.styles.fontStyle = 'bold';
      }
    },
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(135, 145, 160);
  doc.text('Zamifu Analytics School Management System', 105, 282, { align: 'center' });
  doc.text('Please retain this receipt for your records.', 105, 287, { align: 'center' });
  doc.save(`receipt_${filenamePart(data.admissionNumber)}_${filenamePart(data.receiptNumber)}.pdf`);
}
