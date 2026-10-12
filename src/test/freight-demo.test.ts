import { describe, expect, it } from 'vitest';
import { canApproveInvoice, filterInvoices, invoiceCsv, sampleInvoices } from '@/lib/freight-demo';

describe('FreightProof demo workflows', () => {
  it('does not approve uncertain or unprocessed invoices', () => {
    const first = sampleInvoices[0];
    if (!first) throw new Error('Sample invoice missing');
    expect(canApproveInvoice(first)).toBe(false);
    expect(canApproveInvoice({ ...first, exception: 0, status: 'Evidence needed' })).toBe(false);
    expect(canApproveInvoice({ ...first, exception: 0, status: 'File selected' })).toBe(false);
    expect(canApproveInvoice({ ...first, exception: 0, status: 'Verified' })).toBe(true);
  });
  it('searches invoice IDs, transporters and lanes', () => {
    expect(filterInvoices(sampleInvoices, 'vrl', 'All statuses').map(i => i.id)).toEqual(['INV-2026-0842']);
    expect(filterInvoices(sampleInvoices, '0840', 'All statuses').map(i => i.carrier)).toEqual(['Gati Express']);
    expect(filterInvoices(sampleInvoices, 'Mumbai', 'All statuses')).toHaveLength(2);
  });
  it('combines status and transporter filters', () => {
    expect(filterInvoices(sampleInvoices, '', 'Verified', 'TCI Freight').map(i => i.id)).toEqual(['INV-2026-0841']);
    expect(filterInvoices(sampleInvoices, '', 'Approved', 'TCI Freight')).toHaveLength(0);
  });
  it('exports only visible rows with properly escaped filenames', () => {
    const csv = invoiceCsv(filterInvoices(sampleInvoices, 'vrl', 'All statuses'));
    expect(csv).toContain('"INV-2026-0842"');
    expect(csv).not.toContain('INV-2026-0841');
    const first = sampleInvoices[0];
    if (!first) throw new Error("Sample invoice missing");
    expect(invoiceCsv([{ ...first, carrier: 'Invoice "sample", Ltd' }])).toContain('"Invoice ""sample"", Ltd"');
  });
});