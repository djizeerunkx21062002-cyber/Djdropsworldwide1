// Verification specification runner for DropVault Audio Firestore Rules.
// Verifies the Dirty Dozen payloads against our rules invariants.
export const dirtyDozenSecurityAudit = [
  { name: 'Self-Role Escalation', collection: 'users', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow Ghost Field Injection', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'Spoofed Buyer UID', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified Email Write', collection: 'customRequests', expected: 'PERMISSION_DENIED' },
  { name: 'Email Spoofing Admin', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'PII Blanket Read', collection: 'users', expected: 'PERMISSION_DENIED' },
  { name: 'Unbounded Query Scrape', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'ID Poisoning', collection: 'drops', expected: 'PERMISSION_DENIED' },
  { name: 'Terminal State Bypass', collection: 'customRequests', expected: 'PERMISSION_DENIED' },
  { name: 'Immortal Field Tampering', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'Value Poisoning', collection: 'customRequests', expected: 'PERMISSION_DENIED' },
  { name: 'Timestamp Spoofing', collection: 'licenses', expected: 'PERMISSION_DENIED' },
  { name: 'Verified Buyer Review Spoofing', collection: 'reviews', expected: 'PERMISSION_DENIED' },
];
