# Workflow API test cases

Oracle theo tài liệu/API và giao thức provider; kết quả là bằng chứng của các lần chạy trong FINAL-REPORT.md. BLOCKED không tính PASS. Trace từng HTTP và mã/hash test được giữ trong report của case.

| ID | Nhóm | Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| SEC-001 | SEC | GET /api/v1/service-requests / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-002 | SEC | GET /api/v1/service-requests / invalid | 401; no side effect or secret leakage | PASS |
| SEC-003 | SEC | POST /api/v1/service-requests / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-004 | SEC | POST /api/v1/service-requests / invalid | 401; no side effect or secret leakage | PASS |
| SEC-005 | SEC | GET /api/v1/service-requests/:id / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-006 | SEC | GET /api/v1/service-requests/:id / invalid | 401; no side effect or secret leakage | PASS |
| SEC-007 | SEC | PATCH /api/v1/service-requests/:id / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-008 | SEC | PATCH /api/v1/service-requests/:id / invalid | 401; no side effect or secret leakage | PASS |
| SEC-009 | SEC | POST /api/v1/service-requests/:id/cancel / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-010 | SEC | POST /api/v1/service-requests/:id/cancel / invalid | 401; no side effect or secret leakage | PASS |
| SEC-011 | SEC | POST /api/v1/service-requests/:id/dispatch / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-012 | SEC | POST /api/v1/service-requests/:id/dispatch / invalid | 401; no side effect or secret leakage | PASS |
| SEC-013 | SEC | GET /api/v1/dispatch/offers / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-014 | SEC | GET /api/v1/dispatch/offers / invalid | 401; no side effect or secret leakage | PASS |
| SEC-015 | SEC | POST /api/v1/dispatch/offers/:id/accept / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-016 | SEC | POST /api/v1/dispatch/offers/:id/accept / invalid | 401; no side effect or secret leakage | PASS |
| SEC-017 | SEC | POST /api/v1/dispatch/offers/:id/decline / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-018 | SEC | POST /api/v1/dispatch/offers/:id/decline / invalid | 401; no side effect or secret leakage | PASS |
| SEC-019 | SEC | GET /api/v1/assignments / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-020 | SEC | GET /api/v1/assignments / invalid | 401; no side effect or secret leakage | PASS |
| SEC-021 | SEC | POST /api/v1/assignments/:id/status / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-022 | SEC | POST /api/v1/assignments/:id/status / invalid | 401; no side effect or secret leakage | PASS |
| SEC-023 | SEC | GET /api/v1/assignments/:id/completion-checklist / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-024 | SEC | GET /api/v1/assignments/:id/completion-checklist / invalid | 401; no side effect or secret leakage | PASS |
| SEC-025 | SEC | POST /api/v1/assignments/:id/completion-checklist / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-026 | SEC | POST /api/v1/assignments/:id/completion-checklist / invalid | 401; no side effect or secret leakage | PASS |
| SEC-027 | SEC | GET /api/v1/service-requests/:id/quotes / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-028 | SEC | GET /api/v1/service-requests/:id/quotes / invalid | 401; no side effect or secret leakage | PASS |
| SEC-029 | SEC | POST /api/v1/service-requests/:id/quotes / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-030 | SEC | POST /api/v1/service-requests/:id/quotes / invalid | 401; no side effect or secret leakage | PASS |
| SEC-031 | SEC | POST /api/v1/quotes/:id/approve / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-032 | SEC | POST /api/v1/quotes/:id/approve / invalid | 401; no side effect or secret leakage | PASS |
| SEC-033 | SEC | POST /api/v1/quotes/:id/reject / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-034 | SEC | POST /api/v1/quotes/:id/reject / invalid | 401; no side effect or secret leakage | PASS |
| SEC-035 | SEC | GET /api/v1/service-requests/:id/payment-summary / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-036 | SEC | GET /api/v1/service-requests/:id/payment-summary / invalid | 401; no side effect or secret leakage | PASS |
| SEC-037 | SEC | POST /api/v1/payments/orders / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-038 | SEC | POST /api/v1/payments/orders / invalid | 401; no side effect or secret leakage | PASS |
| SEC-039 | SEC | GET /api/v1/payments/orders/:id / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-040 | SEC | GET /api/v1/payments/orders/:id / invalid | 401; no side effect or secret leakage | PASS |
| SEC-041 | SEC | POST /api/v1/payments/orders/:id/cancel / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-042 | SEC | POST /api/v1/payments/orders/:id/cancel / invalid | 401; no side effect or secret leakage | PASS |
| SEC-043 | SEC | GET /api/v1/reminders / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-044 | SEC | GET /api/v1/reminders / invalid | 401; no side effect or secret leakage | PASS |
| SEC-045 | SEC | POST /api/v1/reminders / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-046 | SEC | POST /api/v1/reminders / invalid | 401; no side effect or secret leakage | PASS |
| SEC-047 | SEC | PATCH /api/v1/reminders/:id / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-048 | SEC | PATCH /api/v1/reminders/:id / invalid | 401; no side effect or secret leakage | PASS |
| SEC-049 | SEC | POST /api/v1/reminders/:id/snooze / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-050 | SEC | POST /api/v1/reminders/:id/snooze / invalid | 401; no side effect or secret leakage | PASS |
| SEC-051 | SEC | GET /api/v1/notifications / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-052 | SEC | GET /api/v1/notifications / invalid | 401; no side effect or secret leakage | PASS |
| SEC-053 | SEC | GET /api/v1/notifications/unread-count / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-054 | SEC | GET /api/v1/notifications/unread-count / invalid | 401; no side effect or secret leakage | PASS |
| SEC-055 | SEC | POST /api/v1/notifications/:id/read / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-056 | SEC | POST /api/v1/notifications/:id/read / invalid | 401; no side effect or secret leakage | PASS |
| SEC-057 | SEC | POST /api/v1/notifications/read-all / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-058 | SEC | POST /api/v1/notifications/read-all / invalid | 401; no side effect or secret leakage | PASS |
| SEC-059 | SEC | POST /api/v1/auth/devices / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-060 | SEC | POST /api/v1/auth/devices / invalid | 401; no side effect or secret leakage | PASS |
| SEC-061 | SEC | PUT /api/v1/auth/devices/:id/push-token / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-062 | SEC | PUT /api/v1/auth/devices/:id/push-token / invalid | 401; no side effect or secret leakage | PASS |
| SEC-063 | SEC | DELETE /api/v1/auth/devices/:id/push-token / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-064 | SEC | DELETE /api/v1/auth/devices/:id/push-token / invalid | 401; no side effect or secret leakage | PASS |
| SEC-065 | SEC | GET /api/v1/admin/operations/payments-needs-review / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-066 | SEC | GET /api/v1/admin/operations/payments-needs-review / invalid | 401; no side effect or secret leakage | PASS |
| SEC-067 | SEC | POST /api/v1/admin/payments/orders/:id/resolve / anonymous | 401; no side effect or secret leakage | PASS |
| SEC-068 | SEC | POST /api/v1/admin/payments/orders/:id/resolve / invalid | 401; no side effect or secret leakage | PASS |
| SEC-069 | SEC | Worker outbox/run rejects anonymous | User JWT cannot replace worker authority | PASS |
| SEC-070 | SEC | Worker outbox/run rejects rider | User JWT cannot replace worker authority | PASS |
| SEC-071 | SEC | Worker outbox/run rejects mechanic | User JWT cannot replace worker authority | PASS |
| SEC-072 | SEC | Worker outbox/run rejects admin | User JWT cannot replace worker authority | PASS |
| SEC-073 | SEC | Worker outbox/run wrong secret | Reject wrong worker secret | PASS |
| SEC-074 | SEC | Worker reminders/run rejects anonymous | User JWT cannot replace worker authority | PASS |
| SEC-075 | SEC | Worker reminders/run rejects rider | User JWT cannot replace worker authority | PASS |
| SEC-076 | SEC | Worker reminders/run rejects mechanic | User JWT cannot replace worker authority | PASS |
| SEC-077 | SEC | Worker reminders/run rejects admin | User JWT cannot replace worker authority | PASS |
| SEC-078 | SEC | Worker reminders/run wrong secret | Reject wrong worker secret | PASS |
| SEC-079 | SEC | Worker dispatch/run rejects anonymous | User JWT cannot replace worker authority | PASS |
| SEC-080 | SEC | Worker dispatch/run rejects rider | User JWT cannot replace worker authority | PASS |
| SEC-081 | SEC | Worker dispatch/run rejects mechanic | User JWT cannot replace worker authority | PASS |
| SEC-082 | SEC | Worker dispatch/run rejects admin | User JWT cannot replace worker authority | PASS |
| SEC-083 | SEC | Worker dispatch/run wrong secret | Reject wrong worker secret | PASS |
| SEC-084 | SEC | Worker payments/reconcile rejects anonymous | User JWT cannot replace worker authority | PASS |
| SEC-085 | SEC | Worker payments/reconcile rejects rider | User JWT cannot replace worker authority | PASS |
| SEC-086 | SEC | Worker payments/reconcile rejects mechanic | User JWT cannot replace worker authority | PASS |
| SEC-087 | SEC | Worker payments/reconcile rejects admin | User JWT cannot replace worker authority | PASS |
| SEC-088 | SEC | Worker payments/reconcile wrong secret | Reject wrong worker secret | PASS |
| MNT-001 | MNT | Booking rejects invalid motorcycle_id: "bad" | 400/422; no invalid request persisted | PASS |
| MNT-002 | MNT | Booking rejects invalid service_type: "unknown" | 400/422; no invalid request persisted | PASS |
| MNT-003 | MNT | Booking rejects invalid problem_description: "" | 400/422; no invalid request persisted | PASS |
| MNT-004 | MNT | Booking rejects invalid problem_description: "  " | 400/422; no invalid request persisted | PASS |
| MNT-005 | MNT | Booking rejects invalid problem_description: 2 | 400/422; no invalid request persisted | PASS |
| MNT-006 | MNT | Booking rejects invalid problem_description: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 400/422; no invalid request persisted | PASS |
| MNT-007 | MNT | Booking rejects invalid scheduled_start_at: "bad" | 400/422; no invalid request persisted | PASS |
| MNT-008 | MNT | Booking rejects invalid scheduled_start_at: "2020-01-01T00:00:00Z" | 400/422; no invalid request persisted | PASS |
| MNT-009 | MNT | Booking rejects invalid scheduled_start_at: null | 400/422; no invalid request persisted | PASS |
| MNT-010 | MNT | Booking rejects invalid location: null | 400/422; no invalid request persisted | PASS |
| MNT-011 | MNT | Booking rejects invalid location: {} | 400/422; no invalid request persisted | PASS |
| MNT-012 | MNT | Booking rejects invalid location: {"latitude":91,"longitude":107} | 400/422; no invalid request persisted | PASS |
| MNT-013 | MNT | Booking rejects invalid location: {"latitude":11,"longitude":-181} | 400/422; no invalid request persisted | PASS |
| MNT-014 | MNT | Booking rejects invalid location: {"latitude":"11","longitude":107} | 400/422; no invalid request persisted | PASS |
| MNT-015 | MNT | Booking rejects invalid location: {"latitude":11} | 400/422; no invalid request persisted | PASS |
| MNT-016 | MNT | Booking rejects invalid address_text: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 400/422; no invalid request persisted | PASS |
| MNT-017 | MNT | Booking rejects invalid rider_id: "73c52a46-2357-4a7f-9554-19fa670a4feb" | 400/422; no invalid request persisted | PASS |
| MNT-018 | MNT | Booking rejects invalid status: "completed" | 400/422; no invalid request persisted | PASS |
| MNT-019 | MNT | Booking rejects invalid paid_amount: 1 | 400/422; no invalid request persisted | PASS |
| MNT-020 | MNT | Booking rejects invalid reminder_id: "a3868b08-5e6a-4db0-95ec-d3977fb4e644" | 400/422; no invalid request persisted | PASS |
| MNT-021 | MNT | Booking rejects invalid reminder_context_id: "34d5e3b0-0470-4571-8664-b70bea5129f5" | 400/422; no invalid request persisted | PASS |
| MNT-022 | MNT | Coordinates required even with address | Missing coordinates rejected | PASS |
| MNT-023 | MNT | Schedule required without reminder references | Missing appointment rejected | PASS |
| MNT-024 | MNT | Foreign motorcycle booking | 403; ownership enforced | PASS |
| MNT-025 | MNT | Missing booking idempotency key | 400/422 | PASS |
| MNT-026 | MNT | Booking key length boundary | Invalid key rejected | PASS |
| MNT-027 | MNT | Booking key length boundary | Invalid key rejected | PASS |
| MNT-028 | MNT | Booking retry and conflicting payload | Same ID on replay; changed payload 409; cancel successful | PASS |
| MNT-029 | MNT | Concurrent booking retry | Exactly one request and one logical dispatch event | PASS |
| MNT-030 | MNT | Owner edits coordinates before dispatch | Idempotent PATCH, changed replay conflicts, foreign owner rejected | PASS |
| MNT-031 | MNT | Cancel before matching then replay worker | Canceled request never generates a live offer | PASS |
| MNT-032 | MNT | Automatic matching immediately after booking | Outbox generates offers without client dispatch; not confirmed yet | PASS |
| MNT-033 | MNT | Explicit documented dispatch prepares independent main workflow | Offered request and live mechanic offer; independent of automatic-worker failure | PASS |
| MNT-034 | MNT | Scheduled accept duration undefined invalid | 400/422; offer remains available | PASS |
| MNT-035 | MNT | Scheduled accept duration 14 invalid | 400/422; offer remains available | PASS |
| MNT-036 | MNT | Scheduled accept duration 481 invalid | 400/422; offer remains available | PASS |
| MNT-037 | MNT | Scheduled accept duration 15.5 invalid | 400/422; offer remains available | PASS |
| MNT-038 | MNT | Scheduled accept duration 90 invalid | 400/422; offer remains available | PASS |
| MNT-039 | MNT | Scheduled accept duration null invalid | 400/422; offer remains available | PASS |
| MNT-040 | MNT | Foreign mechanic cannot accept offer | 403/404 | PASS |
| MNT-041 | MNT | Accept confirms buffered reservation | Confirmed; start -30 minutes; end duration +30 minutes; retry same assignment | PASS |
| MNT-042 | MNT | Skip labor approval to en_route | 409; no state advance | PASS |
| MNT-043 | MNT | Skip labor approval to in_progress | 409; no state advance | PASS |
| MNT-044 | MNT | Skip labor approval to awaiting_payment | 409; no state advance | PASS |
| MNT-045 | MNT | Skip labor approval to completed | 409; no state advance | PASS |
| MNT-046 | MNT | Unassigned rider2 progresses assignment | 403/404 | PASS |
| MNT-047 | MNT | Unassigned mechanic2 progresses assignment | 403/404 | PASS |
| MNT-048 | MNT | Labor quote rejects no labor | 400/422/409; no invalid immutable quote | PASS |
| MNT-049 | MNT | Labor quote rejects zero labor | 400/422/409; no invalid immutable quote | PASS |
| MNT-050 | MNT | Labor quote rejects part mixed | 400/422/409; no invalid immutable quote | PASS |
| MNT-051 | MNT | Labor quote rejects negative | 400/422/409; no invalid immutable quote | PASS |
| MNT-052 | MNT | Labor quote rejects fraction money | 400/422/409; no invalid immutable quote | PASS |
| MNT-053 | MNT | Labor quote rejects zero quantity | 400/422/409; no invalid immutable quote | PASS |
| MNT-054 | MNT | Labor quote rejects empty description | 400/422/409; no invalid immutable quote | PASS |
| MNT-055 | MNT | Labor quote rejects overflow | 400/422/409; no invalid immutable quote | PASS |
| MNT-056 | MNT | Labor quote rejects discount_amount | 400/422/409; server owns pricing | PASS |
| MNT-057 | MNT | Labor quote rejects diagnosis_id | 400/422/409; server owns pricing | PASS |
| MNT-058 | MNT | Labor quote rejects labor_pricing | 400/422/409; server owns pricing | PASS |
| MNT-059 | MNT | Labor quote rejects total_amount | 400/422/409; server owns pricing | PASS |
| MNT-060 | MNT | Work quote before approved labor | 409 | PASS |
| MNT-061 | MNT | New maintenance rejects legacy standard purpose | Invalid purpose rejected; no quote or payment | PASS |
| MNT-062 | MNT | Labor rejection retains mechanic; replacement immutable | Rejected cannot travel; replacement supersedes prior pending; latest only | PASS |
| MNT-063 | MNT | Labor quote decision by rider2 | 403/404 | PASS |
| MNT-064 | MNT | Labor quote decision by mechanic | 403/404 | PASS |
| PAY-001 | PAY | Pending labor cannot be paid | 409; payment is after service | PASS |
| MNT-065 | MNT | Maintenance rejects rescue payment timing | 400/422/409 | PASS |
| MNT-066 | MNT | Approve fixed labor | Accepted/assigned; total 12000; no payment or automatic travel | PASS |
| PAY-002 | PAY | Approved labor still cannot create a payment | 409; no upfront payment for new maintenance | PASS |
| MNT-067 | MNT | No second labor after fixed approval | 409 | PASS |
| MNT-068 | MNT | Travel and arrival synchronize request; cannot skip diagnosis | Active reservation; en_route / on_site / diagnosis | PASS |
| MNT-069 | MNT | Initial work cannot add duplicate labor | 409/400/422 | PASS |
| MNT-070 | MNT | Materials rejected then revised | Rejected work blocks start; revised work has fixed labor plus approved parts | PASS |
| PAY-003 | PAY | Unapproved material quote cannot be paid | 409 | PASS |
| MNT-071 | MNT | Approve scope then start work | Approval returns diagnosis; manual in_progress; no implicit payment | PASS |
| PAY-004 | PAY | Cannot charge during work | 409 | PASS |
| MNT-072 | MNT | Cannot collect without checklist | 409 | PASS |
| MNT-073 | MNT | Cannot complete without verified payment | 409 | PASS |
| MNT-074 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes | PASS |
| MNT-075 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes | PASS |
| MNT-076 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes | PASS |
| MNT-077 | MNT | Pending addition blocks collection; rejection preserves scope | No payment for rejected amount; still assigned to same mechanic | PASS |
| PAY-005 | PAY | Rejected addition cannot be charged | 409 | PASS |
| MNT-078 | MNT | Approved addition cumulative, prior labor fixed | 21000 total; original labor preserved; no automatic completion | PASS |
| MNT-079 | MNT | Old approved basis cannot create another addition | 409 | PASS |
| MNT-080 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval | PASS |
| MNT-081 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval | PASS |
| MNT-082 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval | PASS |
| MNT-083 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval | PASS |
| MNT-084 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval | PASS |
| MNT-085 | MNT | Checklist version, ownership and idempotency | Quote binding server-owned; replay same; changed payload conflict; read does not complete | PASS |
| MNT-086 | MNT | Approval after checklist makes checklist stale | Old checklist cannot unlock payment; new revision binds latest quote | PASS |
| PAY-006 | PAY | Payment summary computed from approved work | 24000; unpaid 0; remaining full; timing after_service | PASS |
| PAY-007 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-008 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-009 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-010 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-011 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-012 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-013 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request | PASS |
| PAY-014 | PAY | Foreign payment creation by rider2 | 403/404 | PASS |
| PAY-015 | PAY | Foreign payment creation by mechanic | 403/404 | PASS |
| PAY-016 | PAY | Payment missing idempotency | 400/422 | PASS |
| PAY-017 | PAY | Client cannot reduce charge amount | Extra amount rejected or ignored; approved server charge unchanged | PASS |
| PAY-018 | PAY | Payment create and replay | 201 same ID; amount equals remaining; provider called once for logical link | PASS |
| PAY-019 | PAY | Concurrent different keys never create two active links | At most one active provider link and one active payment order | PASS |
| PAY-020 | PAY | Read order as rider | Visible to owner/assigned mechanic/admin | PASS |
| PAY-021 | PAY | Read order as mechanic | Visible to owner/assigned mechanic/admin | PASS |
| PAY-022 | PAY | Read order as admin | Visible to owner/assigned mechanic/admin | PASS |
| PAY-023 | PAY | Foreign rider2 cannot read order | 403/404 | PASS |
| PAY-024 | PAY | Foreign mechanic2 cannot read order | 403/404 | PASS |
| PAY-025 | PAY | Return URL query cannot mark paid | Only verified webhook/provider reconciliation is evidence | PASS |
| PAY-026 | PAY | Webhook missing rejected | 400/401/422; no credit and no state advance | PASS |
| PAY-027 | PAY | Webhook badSignature rejected | 400/401/422; no credit and no state advance | PASS |
| PAY-028 | PAY | Webhook tamper rejected | 400/401/422; no credit and no state advance | PASS |
| PAY-029 | PAY | Signed unknown order is safely ignored | 200 controlled acknowledgment; no fixture credit | PASS |
| PAY-030 | PAY | Pending order cannot complete work | 409 | PASS |
| PAY-031 | PAY | Verified webhook credits exact money once | Succeeded, remaining zero, still awaiting_payment | PASS |
| PAY-032 | PAY | Concurrent/replayed webhook cannot double-credit | Paid amount unchanged; one logical success notification | PASS |
| PAY-033 | PAY | Already paid cannot create another charge | 409; no zero or double payment | PASS |
| PAY-034 | PAY | Succeeded order cannot be canceled | 409; paid evidence preserved | PASS |
| MNT-087 | MNT | Paid maintenance manually completes | Both request/assignment completed; no backward transition | PASS |
| MNT-088 | MNT | Completed assignment allows one immutable owner review | 201; duplicate blocked; foreign forbidden | PASS |
| NTF-001 | NTF | Maintenance lifecycle notices and navigation | Owner receives assignment, quote, verified payment, completion; unrelated user never receives IDs | PASS |
| MNT-089 | MNT | E2E no parts | Booking → labor → materials approval → checklist → verified payment → completed | PASS |
| MNT-090 | MNT | E2E parts quantity 2 | Booking → labor → materials approval → checklist → verified payment → completed | PASS |
| MNT-091 | MNT | E2E fractional part quantity | Booking → labor → materials approval → checklist → verified payment → completed | PASS |
| MNT-092 | MNT | Expired labor cannot be approved; revised quote succeeds | Expired quote cannot travel/charge; replacement allows whole workflow | PASS |
| PAY-035 | PAY | Cancel pending, replay cancel, new payment then complete | Old link canceled; replacement unique; only replacement credit | PASS |
| PAY-036 | PAY | Signed webhook underpaid needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider | PASS |
| PAY-037 | PAY | Signed webhook overpaid needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider | PASS |
| PAY-038 | PAY | Signed webhook currency needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider | PASS |
| PAY-039 | PAY | Signed webhook wrong link needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider | PASS |
| PAY-040 | PAY | Late success after canceled link requires review | No automatic credit; admin proof and ownership/idempotency required | PASS |
| PAY-041 | PAY | Reconcile recovers missed webhook | Stale provider PAID credits once, remains awaiting_payment until mechanic closes | PASS |
| PAY-042 | PAY | Provider create outage cannot mark paid; recovery retry | Controlled 502/503; same key recovers link; no duplicate credit | PASS |
| MNT-093 | MNT | Future reservation blocks overlap but allows unrelated immediate job | Future confirmed does not occupy current job; early travel blocked; active job blocks later activation | PASS |
| MNT-094 | MNT | No available mechanic never confirms appointment | Bounded rounds -> manual_escalation + rider notice; no assignment; direct cancel remains409 by existing policy | PASS |
| NTF-002 | NTF | Reminder invalid title | 400/422; no invalid reminder persisted | PASS |
| NTF-003 | NTF | Reminder invalid title | 400/422; no invalid reminder persisted | PASS |
| NTF-004 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted | PASS |
| NTF-005 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted | PASS |
| NTF-006 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted | PASS |
| NTF-007 | NTF | Reminder invalid enabled | 400/422; no invalid reminder persisted | PASS |
| NTF-008 | NTF | Reminder invalid next_due_at | 400/422; no invalid reminder persisted | PASS |
| NTF-009 | NTF | Reminder invalid odometer_km | 400/422; no invalid reminder persisted | PASS |
| NTF-010 | NTF | Reminder invalid rider_id | 400/422; no invalid reminder persisted | PASS |
| NTF-011 | NTF | Reminder motorcycle ownership | 403 | PASS |
| NTF-012 | NTF | Due reminder atomic inbox and repeated workers | One occurrence/inbox; queued truthfully; worker sent counter zero | PASS |
| NTF-013 | NTF | Reminder snooze and schedule edit clears snooze | Effective due moves; not early; PATCH removes old snooze | PASS |
| NTF-014 | NTF | Foreign reminder mutation PATCH | 403 | PASS |
| NTF-015 | NTF | Foreign reminder mutation /snooze | 403 | PASS |
| NTF-016 | NTF | Disabled reminder does not notify | No occurrence inbox after due | PASS |
| NTF-017 | NTF | Archived motorcycle disables reminders | Worker never sends due reminder for archived vehicle | PASS |
| NTF-018 | NTF | Recurring date reminder advances once without drift duplication | Next due + interval; no duplicate on worker repeat; next cycle gets new context | PASS |
| NTF-019 | NTF | Reminder creates immediate maintenance once; completion leaves recurrence intact | References owned/due/vehicle-bound; occurrence consumed only after successful request | PASS |
| NTF-020 | NTF | Inbox invalid filter limit=0 | 400/422 | PASS |
| NTF-021 | NTF | Inbox invalid filter limit=101 | 400/422 | PASS |
| NTF-022 | NTF | Inbox invalid filter limit=abc | 400/422 | PASS |
| NTF-023 | NTF | Inbox invalid filter cursor=invalid | 400/422 | PASS |
| NTF-024 | NTF | Inbox invalid filter unread_only=wrong | 400/422 | PASS |
| NTF-025 | NTF | Inbox opaque cursor pagination | No duplicates/missing across pages; limit respected; owner data only | PASS |
| NTF-026 | NTF | Unread → read idempotent independent of delivery | Unread decrements once; first read timestamp preserved; foreign owner 404 | PASS |
| NTF-027 | NTF | Read-all idempotent and owner-scoped | Owner unread zero; unrelated user count unchanged | PASS |
| NTF-028 | NTF | Device token fields paired/provider controlled | 400/422 | PASS |
| NTF-029 | NTF | Device token fields paired/provider controlled | 400/422 | PASS |
| NTF-030 | NTF | Device token fields paired/provider controlled | 400/422 | PASS |
| NTF-031 | NTF | Push token ownership, rotation and revoke | Token never returned; foreign cannot rotate; revoke replay safe | PASS |
| NTF-032 | NTF | No active device retains inbox; no provider call | No raw-device destination; inbox usable even when no push | PASS |
| NTF-033 | NTF | FCM success wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-034 | NTF | FCM invalid wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-035 | NTF | FCM mismatch wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-036 | NTF | FCM permanent wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-037 | NTF | FCM temporary wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-038 | NTF | FCM quota wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored | PASS |
| NTF-039 | NTF | Mixed devices retry only unresolved device | One success, one invalid, one temporary; terminal destinations sent once | PASS |
| NTF-040 | NTF | Concurrent outbox workers deduplicate slow provider sends | One successful send per notification/device version; no duplicate inbox | PASS |
| NTF-041 | NTF | Permanent temporary-failure exhaustion dead letters | Bounded retries; not falsely sent; inbox remains; operational queue visible | PASS |
| NTF-042 | NTF | Rescue E2E notifications labor_upfront | Offer → assignment → labor → travel → parts → payment → completion notices owner-only | PASS |
| NTF-043 | NTF | Rescue E2E notifications after_repair | Offer → assignment → labor → travel → parts → payment → completion notices owner-only | PASS |
| PAY-043 | PAY | Real bank transfer + signed external payOS webhook | Explicit evidence required; never inferred from simulated provider success | BLOCKED |
| PAY-044 | PAY | Legacy standard maintenance prepayment compatibility | Explicit evidence required; never inferred from simulated provider success | PASS |
| PAY-045 | PAY | Provider timeout after link creation and process crash before response | Explicit evidence required; never inferred from simulated provider success | PASS |
| MNT-095 | MNT | Repair legacy request missing location | Explicit evidence required; never inferred from simulated provider success | PASS |
| NTF-044 | NTF | Android physical receipt foreground/background/app terminated | Explicit evidence required; never inferred from simulated provider success | BLOCKED |
| NTF-045 | NTF | iOS physical receipt foreground/background/app terminated | Explicit evidence required; never inferred from simulated provider success | BLOCKED |
| NTF-046 | NTF | Permission denied/offline/device reconnect/notification tap | Explicit evidence required; never inferred from simulated provider success | BLOCKED |
| NTF-047 | NTF | Logout/account switch does not send previous user notices | Explicit evidence required; never inferred from simulated provider success | BLOCKED |
| NTF-048 | NTF | Crash after provider success before receipt commit | Explicit evidence required; never inferred from simulated provider success | PASS |
| NTF-049 | NTF | Rotate token during invalidation and expired lease owner fencing | Explicit evidence required; never inferred from simulated provider success | PASS |
| NTF-050 | NTF | Missing FCM config must report failure not sent | Explicit evidence required; never inferred from simulated provider success | PASS |
| EXT-001 | EXT | Malformed/incorrect JSON booking: { | 400/422, no request creation | PASS |
| EXT-002 | EXT | Malformed/incorrect JSON booking: [] | 400/422, no request creation | PASS |
| EXT-003 | EXT | Malformed/incorrect JSON booking: null | 400/422, no request creation | PASS |
| EXT-004 | EXT | Malformed/incorrect JSON booking: true | 400/422, no request creation | PASS |
| EXT-005 | EXT | Legal coordinate boundary 90,180 | Request accepted with legal coordinates then canceled; no out-of-range coercion | PASS |
| EXT-006 | EXT | Legal coordinate boundary -90,-180 | Request accepted with legal coordinates then canceled; no out-of-range coercion | PASS |
| EXT-007 | EXT | Legal coordinate boundary 0,0 | Request accepted with legal coordinates then canceled; no out-of-range coercion | PASS |
| EXT-008 | EXT | Booking accepts ISO time with +07:00 offset | Stored appointment denotes the same instant, not a shifted timezone | PASS |
| EXT-009 | EXT | Archived motorcycle cannot book maintenance | 404; archived owner vehicle unusable | PASS |
| EXT-010 | EXT | Dispatch excludes mechanic: missing skill | Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected | PASS |
| EXT-011 | EXT | Dispatch excludes mechanic: outside radius | Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected | PASS |
| EXT-012 | EXT | Dispatch excludes mechanic: stale location | Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected | PASS |
| EXT-013 | EXT | Dispatch excludes mechanic: unavailable | Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected | PASS |
| EXT-014 | EXT | Dispatch excludes mechanic: suspended | Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected | PASS |
| EXT-015 | EXT | Expired offer cannot assign a mechanic | 409; no assignment committed | PASS |
| EXT-016 | EXT | Two mechanics concurrently accept one request | Exactly one assignment, losing mechanic rejected; cleanup through recovery API | PASS |
| EXT-017 | EXT | Same mechanic concurrently retries same offer | Same logical assignment; no duplicate reservation | PASS |
| EXT-018 | EXT | One mechanic concurrently accepts overlapping requests | One succeeds; no two active overlapping reservations | PASS |
| EXT-019 | EXT | Cancel versus accept race preserves state consistency | Canceled request never has an active assignment; accepted winner recoverable | PASS |
| EXT-020 | EXT | 480 minute maximum and adjacent buffered boundary | 480 accepted; exactly adjacent reservation allowed; one minute overlap excluded | PASS |
| EXT-021 | EXT | Appointment preparation notification once for both parties | Dispatch worker emits owner and assigned mechanic preparation notices once at -30 minute boundary | PASS |
| EXT-022 | EXT | Failed provider event cannot credit an approved maintenance order | Signed outer/inner failure acknowledgments never imply payment; valid later payment completes | PASS |
| EXT-023 | EXT | Forged order amount/status/provider fields cannot alter server charge | Extra fields rejected or ignored; never 1 dong/cash/succeeded from rider input | PASS |
| EXT-024 | EXT | Reconciliation mismatch requires review, no automatic closing | Provider PAID but amountPaid under expected -> needs_review; full independently verified proof required | PASS |
| EXT-025 | EXT | Admin close_unpaid requires provider termination and zero received | Cannot confirm unreceived money; canceled/zero order can be closed unpaid and replaced | PASS |
| EXT-026 | EXT | Official payOS full webhook shape and local timestamp | Canonical provider fields/Vietnamese desc/counterparty fields are signed and accepted; exact money credited once | PASS |
| EXT-027 | EXT | Valid diagnosis and cumulative additions of every line type | Approved labor + parts + added part/labor/other =27000; stale approved quote cannot be charged | PASS |
| LIVE-001 | LIVE | Real payOS create/read/cancel after maintenance work | Real provider link pending then canceled; no funds credited or job completed; no bank transfer | PASS |
