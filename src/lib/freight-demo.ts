export type InvoiceStatus = 'Needs review' | 'Verified' | 'Evidence needed' | 'Approved' | 'Disputed' | 'File selected';
export type Invoice = { id: string; carrier: string; initials: string; lane: string; date: string; amount: number; exception: number; status: InvoiceStatus; issue: string };
export const sampleInvoices: Invoice[] = [
  { id: 'INV-2026-0842', carrier: 'VRL Logistics', initials: 'VR', lane: 'Mumbai → Pune', date: '12 Oct 2026', amount: 61850, exception: 8730, status: 'Needs review', issue: 'Rate mismatch · unsupported detention' },
  { id: 'INV-2026-0841', carrier: 'TCI Freight', initials: 'TC', lane: 'Chennai → Bengaluru', date: '12 Oct 2026', amount: 48200, exception: 0, status: 'Verified', issue: 'All checks passed' },
  { id: 'INV-2026-0840', carrier: 'Gati Express', initials: 'GE', lane: 'Delhi → Jaipur', date: '11 Oct 2026', amount: 36750, exception: 3250, status: 'Evidence needed', issue: 'Proof of delivery missing' },
  { id: 'INV-2026-0839', carrier: 'Blue Dart', initials: 'BD', lane: 'Hyderabad → Chennai', date: '11 Oct 2026', amount: 29400, exception: 0, status: 'Verified', issue: 'All checks passed' },
  { id: 'INV-2026-0838', carrier: 'Delhivery', initials: 'DL', lane: 'Ahmedabad → Mumbai', date: '10 Oct 2026', amount: 52400, exception: 5400, status: 'Needs review', issue: 'Duplicate toll charge' },
  { id: 'INV-2026-0837', carrier: 'Safexpress', initials: 'SE', lane: 'Pune → Bengaluru', date: '10 Oct 2026', amount: 71600, exception: 0, status: 'Approved', issue: 'Payment approved in demo' },
];
export function filterInvoices(invoices: Invoice[], query: string, status: string, carrier = 'All transporters') {
  const term = query.toLowerCase().trim();
  return invoices.filter(i => (status === 'All statuses' || i.status === status) && (carrier === 'All transporters' || i.carrier === carrier) && `${i.id} ${i.carrier} ${i.lane}`.toLowerCase().includes(term));
}
export function invoiceCsv(invoices: Invoice[]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [['Invoice ID', 'Transporter', 'Lane', 'Date', 'Amount (INR)', 'Exception (INR)', 'Status'], ...invoices.map(i => [i.id, i.carrier, i.lane, i.date, i.amount, i.exception, i.status])].map(row => row.map(escape).join(',')).join('\r\n');
}
export const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
export function canApproveInvoice(invoice: Invoice) {
  return invoice.exception === 0 && invoice.status !== 'Evidence needed' && invoice.status !== 'File selected';
}