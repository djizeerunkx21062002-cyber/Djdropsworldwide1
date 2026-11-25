# Security Specification & Payload-First Verification

## 1. Data Invariants
1. **Identity Isolation**: A `users/{userId}` document can only be created when `uid == request.auth.uid`, and non-admin users cannot self-assign `role: 'admin'` or `'producer'` or `'licensing_manager'`.
2. **PII Isolation**: `users/{userId}` and `studioSettings/{settingId}` contain email/settlement metadata and are never publicly readable or listable by unprivileged users.
3. **Order Ownership**: Every `orders/{orderId}` document must have `buyerUid == request.auth.uid`, `subtotalUsd >= 0`, `taxAmountUsd >= 0`, `totalUsd >= 0`, and `items.size() >= 1 && items.size() <= 20`.
4. **License Integrity**: A `licenses/{licenseId}` document must originate from `ownerUid == request.auth.uid`, start with `status == 'active'`, and only admins or licensing managers can revoke or modify rights scope.
5. **Custom Request Workflow & Terminal Lock**: A `customRequests/{requestId}` document starts at `milestone == 'Submitted'` and cannot be modified by clients once moved past `'Submitted'`, nor modified by producers once `'Delivered'`.
6. **Temporal Integrity & Path Hardening**: Every document ID matches `^[a-zA-Z0-9_-]+$` (`<= 128` chars) and `createdAt`/`updatedAt` match `request.time`.
7. **Review Ownership & Verified Buyer Proof**: A `reviews/{reviewId}` document must have `authorUid == request.auth.uid`, valid 1..5 rating, zero PII, and `verifiedBuyer: true` is only allowed when referencing a real `orders/{orderId}` owned by `request.auth.uid`.

## 2. The Dirty Dozen Adversarial Payloads
1. **Self-Role Escalation**: Client writes `users/{uid}` with `role: 'admin'`. -> `PERMISSION_DENIED`.
2. **Shadow Ghost Field Injection**: Client creates an `orders/{id}` with extra field `isRefunded: true`. -> `PERMISSION_DENIED`.
3. **Spoofed Buyer UID**: Client creates `orders/{id}` with `buyerUid: 'victim_uid'`. -> `PERMISSION_DENIED`.
4. **Unverified Email Write**: Token with `email_verified: false` attempts to create a `customRequests/{id}` doc. -> `PERMISSION_DENIED`.
5. **Email Spoofing Admin**: Token with `email: 'djizeerunkx21062002@gmail.com'` and `email_verified: false` tries to list `orders`. -> `PERMISSION_DENIED`.
6. **PII Blanket Read**: Non-admin authenticated user attempts `get` on another user's `users/{otherUid}`. -> `PERMISSION_DENIED`.
7. **Unbounded Query Scrape**: Non-admin user attempts `list` on `orders` without filtering to `buyerUid == request.auth.uid`. -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Client attempts to create `drops/bad..id$123` with invalid characters or >128 chars. -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Producer tries to edit a `customRequests/{id}` document whose `milestone` is already `'Delivered'`. -> `PERMISSION_DENIED`.
10. **Immortal Field Tampering**: Client tries to mutate `createdAt` or `buyerUid` on an existing `orders/{id}` or `customRequests/{id}`. -> `PERMISSION_DENIED`.
11. **Value Poisoning**: Client sends `bpmTarget: "not_a_number"` or `scriptText` > 1500 chars on `customRequests/{id}`. -> `PERMISSION_DENIED`.
12. **Timestamp Spoofing**: Client sends a past `createdAt` timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
13. **Verified Buyer Review Spoofing**: Client submits `reviews/{id}` with `verifiedBuyer: true` and forged/missing `orderId`. -> `PERMISSION_DENIED`.
