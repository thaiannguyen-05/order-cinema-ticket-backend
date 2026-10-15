# 0004 — No Refund via System, PAID Is Terminal

Date: 2026-10-14
Status: Accepted

## Context

Sepay money, once `ORDER_PAID + CAPTURED/APPROVED`, is held by Sepay.
Our `Order` maps IPN to `PAID/FAILED/CANCELLED` in
`src/module/core-module/payment/sepay.service.ts:applyIpn`.
Business policy is "vé đã bán miễn đổi trả": rạp-hủy-suất and
admin-duyệt-hoàn do not happen through the backend.

## Decision

- No refund/void API in backend. `PAID` is terminal (`type.ts:ALLOWED_TRANSITIONS`).
- `TRANSACTION_VOID` IPN is still accepted (passive) and maps to `CANCELLED`
  for the rare Sepay-side void, but we never call refund proactively.
- Double-pay (two `transaction_id` for one `invoice_number`): second IPN
  hits `sepayOrderId/sepayTransactionId @unique` (`payment.prisma`)
  and terminal-ipmn `200 idempotent:true`, so Sepay stops retrying.
  Surplus is reconciled manually on the Sepay dashboard, outside the system.
- `PATCH /payment/:id` stays removed; only IPN decides `PAID/FAILED`.

## Consequences

- No `REFUNDING/REFUNDED` status, no `RefundRequest` table.
- If policy changes, revisit with a dedicated refund module
  (admin-only, partial-refund, reconcile cron).
