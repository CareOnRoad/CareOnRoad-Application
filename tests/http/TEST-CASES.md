# Catalogue kiểm thử HTTP

Chi tiết payload/headers trong test-cases.json; assertion nghiệp vụ trong cases.mjs. Mapped route không có nghĩa mọi case đã chạy/pass. Payment ngoài phạm vi.

| ID | Feature | Role | Request | Expected | Case |
|---|---|---|---|---|---|
| HTTP-0001 | Health | anonymous | GET /api/v1/internal/health/live | HTTP 200 | Liveness công khai và chỉ trả status |
| HTTP-0002 | Health | anonymous | GET /api/v1/internal/health/ready | HTTP 200 | Readiness database/configuration đã cấu hình phải ready |
| OAUTH-01 | Google OAuth | workflow | Nhiều request trong cases.mjs | HTTP 200, external.google=true | Supabase bật Google provider |
| OAUTH-02 | Google OAuth | workflow | Nhiều request trong cases.mjs | HTTP 302 tới accounts.google.com với state, response_type=code | Authorize Google redirect tới Google có state và PKCE |
| OAUTH-03 | Google OAuth | workflow | Nhiều request trong cases.mjs | Không access_token/refresh_token/session thành công | Callback với code/state giả không cấp session |
| HTTP-0006 | Auth | anonymous | GET /api/v1/auth/me | HTTP 401 | GET /api/v1/auth/me: anonymous bị từ chối |
| HTTP-0007 | Auth | invalid | GET /api/v1/auth/me | HTTP 401 | GET /api/v1/auth/me: invalid bị từ chối |
| HTTP-0008 | Auth | anonymous | POST /api/v1/auth/profile | HTTP 401 | POST /api/v1/auth/profile: anonymous bị từ chối |
| HTTP-0009 | Auth | invalid | POST /api/v1/auth/profile | HTTP 401 | POST /api/v1/auth/profile: invalid bị từ chối |
| HTTP-0010 | Auth | anonymous | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | PATCH /api/v1/auth/profile: anonymous bị từ chối |
| HTTP-0011 | Auth | invalid | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | PATCH /api/v1/auth/profile: invalid bị từ chối |
| HTTP-0012 | Auth | anonymous | POST /api/v1/auth/devices | HTTP 401 | POST /api/v1/auth/devices: anonymous bị từ chối |
| HTTP-0013 | Auth | invalid | POST /api/v1/auth/devices | HTTP 401 | POST /api/v1/auth/devices: invalid bị từ chối |
| HTTP-0014 | Auth | anonymous | PUT /api/v1/auth/devices/{{absent}}/push-token | HTTP 401 | PUT /api/v1/auth/devices/{{deviceId}}/push-token: anonymous bị từ chối |
| HTTP-0015 | Auth | invalid | PUT /api/v1/auth/devices/{{absent}}/push-token | HTTP 401 | PUT /api/v1/auth/devices/{{deviceId}}/push-token: invalid bị từ chối |
| HTTP-0016 | Auth | anonymous | DELETE /api/v1/auth/devices/{{absent}}/push-token | HTTP 401 | DELETE /api/v1/auth/devices/{{deviceId}}/push-token: anonymous bị từ chối |
| HTTP-0017 | Auth | invalid | DELETE /api/v1/auth/devices/{{absent}}/push-token | HTTP 401 | DELETE /api/v1/auth/devices/{{deviceId}}/push-token: invalid bị từ chối |
| HTTP-0018 | Motorcycles | anonymous | GET /api/v1/motorcycles | HTTP 401 | GET /api/v1/motorcycles: anonymous bị từ chối |
| HTTP-0019 | Motorcycles | invalid | GET /api/v1/motorcycles | HTTP 401 | GET /api/v1/motorcycles: invalid bị từ chối |
| HTTP-0020 | Motorcycles | mechanic1 | GET /api/v1/motorcycles | HTTP 403 | GET /api/v1/motorcycles: mechanic bị từ chối (resource absent) |
| HTTP-0021 | Motorcycles | anonymous | POST /api/v1/motorcycles | HTTP 401 | POST /api/v1/motorcycles: anonymous bị từ chối |
| HTTP-0022 | Motorcycles | invalid | POST /api/v1/motorcycles | HTTP 401 | POST /api/v1/motorcycles: invalid bị từ chối |
| HTTP-0023 | Motorcycles | mechanic1 | POST /api/v1/motorcycles | HTTP 403 | POST /api/v1/motorcycles: mechanic bị từ chối (resource absent) |
| HTTP-0024 | Motorcycles | anonymous | GET /api/v1/motorcycles/{{absent}} | HTTP 401 | GET /api/v1/motorcycles/{{motorcycleId}}: anonymous bị từ chối |
| HTTP-0025 | Motorcycles | invalid | GET /api/v1/motorcycles/{{absent}} | HTTP 401 | GET /api/v1/motorcycles/{{motorcycleId}}: invalid bị từ chối |
| HTTP-0026 | Motorcycles | mechanic1 | GET /api/v1/motorcycles/{{absent}} | HTTP 403 | GET /api/v1/motorcycles/{{motorcycleId}}: mechanic bị từ chối (resource absent) |
| HTTP-0027 | Motorcycles | anonymous | PATCH /api/v1/motorcycles/{{absent}} | HTTP 401 | PATCH /api/v1/motorcycles/{{motorcycleId}}: anonymous bị từ chối |
| HTTP-0028 | Motorcycles | invalid | PATCH /api/v1/motorcycles/{{absent}} | HTTP 401 | PATCH /api/v1/motorcycles/{{motorcycleId}}: invalid bị từ chối |
| HTTP-0029 | Motorcycles | mechanic1 | PATCH /api/v1/motorcycles/{{absent}} | HTTP 403 | PATCH /api/v1/motorcycles/{{motorcycleId}}: mechanic bị từ chối (resource absent) |
| HTTP-0030 | Motorcycles | anonymous | DELETE /api/v1/motorcycles/{{absent}} | HTTP 401 | DELETE /api/v1/motorcycles/{{motorcycleId}}: anonymous bị từ chối |
| HTTP-0031 | Motorcycles | invalid | DELETE /api/v1/motorcycles/{{absent}} | HTTP 401 | DELETE /api/v1/motorcycles/{{motorcycleId}}: invalid bị từ chối |
| HTTP-0032 | Motorcycles | mechanic1 | DELETE /api/v1/motorcycles/{{absent}} | HTTP 403 | DELETE /api/v1/motorcycles/{{motorcycleId}}: mechanic bị từ chối (resource absent) |
| HTTP-0033 | Mechanic profile | anonymous | GET /api/v1/mechanics/me/profile | HTTP 401 | GET /api/v1/mechanics/me/profile: anonymous bị từ chối |
| HTTP-0034 | Mechanic profile | invalid | GET /api/v1/mechanics/me/profile | HTTP 401 | GET /api/v1/mechanics/me/profile: invalid bị từ chối |
| HTTP-0035 | Mechanic profile | rider1 | GET /api/v1/mechanics/me/profile | HTTP 403 | GET /api/v1/mechanics/me/profile: rider không có mechanic role |
| HTTP-0036 | Mechanic profile | anonymous | PATCH /api/v1/mechanics/me/profile | HTTP 401 | PATCH /api/v1/mechanics/me/profile: anonymous bị từ chối |
| HTTP-0037 | Mechanic profile | invalid | PATCH /api/v1/mechanics/me/profile | HTTP 401 | PATCH /api/v1/mechanics/me/profile: invalid bị từ chối |
| HTTP-0038 | Mechanic profile | rider1 | PATCH /api/v1/mechanics/me/profile | HTTP 403 | PATCH /api/v1/mechanics/me/profile: rider không có mechanic role |
| HTTP-0039 | Mechanic profile | anonymous | PUT /api/v1/mechanics/me/availability | HTTP 401 | PUT /api/v1/mechanics/me/availability: anonymous bị từ chối |
| HTTP-0040 | Mechanic profile | invalid | PUT /api/v1/mechanics/me/availability | HTTP 401 | PUT /api/v1/mechanics/me/availability: invalid bị từ chối |
| HTTP-0041 | Mechanic profile | rider1 | PUT /api/v1/mechanics/me/availability | HTTP 403 | PUT /api/v1/mechanics/me/availability: rider không có mechanic role |
| HTTP-0042 | Mechanic profile | anonymous | PUT /api/v1/mechanics/me/location | HTTP 401 | PUT /api/v1/mechanics/me/location: anonymous bị từ chối |
| HTTP-0043 | Mechanic profile | invalid | PUT /api/v1/mechanics/me/location | HTTP 401 | PUT /api/v1/mechanics/me/location: invalid bị từ chối |
| HTTP-0044 | Mechanic profile | rider1 | PUT /api/v1/mechanics/me/location | HTTP 403 | PUT /api/v1/mechanics/me/location: rider không có mechanic role |
| HTTP-0045 | Mechanic operations | anonymous | GET /api/v1/mechanics/me/dashboard | HTTP 401 | GET /api/v1/mechanics/me/dashboard: anonymous bị từ chối |
| HTTP-0046 | Mechanic operations | invalid | GET /api/v1/mechanics/me/dashboard | HTTP 401 | GET /api/v1/mechanics/me/dashboard: invalid bị từ chối |
| HTTP-0047 | Mechanic operations | rider1 | GET /api/v1/mechanics/me/dashboard | HTTP 403 | GET /api/v1/mechanics/me/dashboard: rider không có mechanic role |
| HTTP-0048 | Mechanic operations | anonymous | GET /api/v1/mechanics/me/jobs | HTTP 401 | GET /api/v1/mechanics/me/jobs: anonymous bị từ chối |
| HTTP-0049 | Mechanic operations | invalid | GET /api/v1/mechanics/me/jobs | HTTP 401 | GET /api/v1/mechanics/me/jobs: invalid bị từ chối |
| HTTP-0050 | Mechanic operations | rider1 | GET /api/v1/mechanics/me/jobs | HTTP 403 | GET /api/v1/mechanics/me/jobs: rider không có mechanic role |
| HTTP-0051 | Mechanic operations | anonymous | GET /api/v1/mechanics/me/performance | HTTP 401 | GET /api/v1/mechanics/me/performance: anonymous bị từ chối |
| HTTP-0052 | Mechanic operations | invalid | GET /api/v1/mechanics/me/performance | HTTP 401 | GET /api/v1/mechanics/me/performance: invalid bị từ chối |
| HTTP-0053 | Mechanic operations | rider1 | GET /api/v1/mechanics/me/performance | HTTP 403 | GET /api/v1/mechanics/me/performance: rider không có mechanic role |
| HTTP-0054 | Service requests | anonymous | GET /api/v1/service-requests | HTTP 401 | GET /api/v1/service-requests: anonymous bị từ chối |
| HTTP-0055 | Service requests | invalid | GET /api/v1/service-requests | HTTP 401 | GET /api/v1/service-requests: invalid bị từ chối |
| HTTP-0056 | Service requests | mechanic1 | GET /api/v1/service-requests | HTTP 403 | GET /api/v1/service-requests: mechanic bị từ chối (resource absent) |
| HTTP-0057 | Service requests | anonymous | POST /api/v1/service-requests | HTTP 401 | POST /api/v1/service-requests: anonymous bị từ chối |
| HTTP-0058 | Service requests | invalid | POST /api/v1/service-requests | HTTP 401 | POST /api/v1/service-requests: invalid bị từ chối |
| HTTP-0059 | Service requests | mechanic1 | POST /api/v1/service-requests | HTTP 403 | POST /api/v1/service-requests: mechanic bị từ chối (resource absent) |
| HTTP-0060 | Service requests | anonymous | GET /api/v1/service-requests/{{absent}} | HTTP 401 | GET /api/v1/service-requests/{{requestId}}: anonymous bị từ chối |
| HTTP-0061 | Service requests | invalid | GET /api/v1/service-requests/{{absent}} | HTTP 401 | GET /api/v1/service-requests/{{requestId}}: invalid bị từ chối |
| HTTP-0062 | Service requests | mechanic1 | GET /api/v1/service-requests/{{absent}} | HTTP 403 | GET /api/v1/service-requests/{{requestId}}: mechanic bị từ chối (resource absent) |
| HTTP-0063 | Service requests | anonymous | POST /api/v1/service-requests/{{absent}}/cancel | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/cancel: anonymous bị từ chối |
| HTTP-0064 | Service requests | invalid | POST /api/v1/service-requests/{{absent}}/cancel | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/cancel: invalid bị từ chối |
| HTTP-0065 | Service requests | mechanic1 | POST /api/v1/service-requests/{{absent}}/cancel | HTTP 403 | POST /api/v1/service-requests/{{requestId}}/cancel: mechanic bị từ chối (resource absent) |
| HTTP-0066 | Service requests | anonymous | POST /api/v1/service-requests/{{absent}}/media | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/media: anonymous bị từ chối |
| HTTP-0067 | Service requests | invalid | POST /api/v1/service-requests/{{absent}}/media | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/media: invalid bị từ chối |
| HTTP-0068 | Service requests | mechanic1 | POST /api/v1/service-requests/{{absent}}/media | HTTP 403 | POST /api/v1/service-requests/{{requestId}}/media: mechanic bị từ chối (resource absent) |
| HTTP-0069 | Service requests | anonymous | POST /api/v1/service-requests/{{absent}}/dispatch | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/dispatch: anonymous bị từ chối |
| HTTP-0070 | Service requests | invalid | POST /api/v1/service-requests/{{absent}}/dispatch | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/dispatch: invalid bị từ chối |
| HTTP-0071 | Service requests | mechanic1 | POST /api/v1/service-requests/{{absent}}/dispatch | HTTP 403 | POST /api/v1/service-requests/{{requestId}}/dispatch: mechanic bị từ chối (resource absent) |
| HTTP-0072 | Rescue recall | anonymous | POST /api/v1/service-requests/{{absent}}/rescue-mechanics/{{absent}}/recall | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/rescue-mechanics/{{mechanicId}}/recall: anonymous bị từ chối |
| HTTP-0073 | Rescue recall | invalid | POST /api/v1/service-requests/{{absent}}/rescue-mechanics/{{absent}}/recall | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/rescue-mechanics/{{mechanicId}}/recall: invalid bị từ chối |
| HTTP-0074 | Rescue recall | mechanic1 | POST /api/v1/service-requests/{{absent}}/rescue-mechanics/{{absent}}/recall | HTTP 403 | POST /api/v1/service-requests/{{requestId}}/rescue-mechanics/{{mechanicId}}/recall: mechanic bị từ chối (resource absent) |
| HTTP-0075 | Quotes | anonymous | GET /api/v1/service-requests/{{absent}}/quotes | HTTP 401 | GET /api/v1/service-requests/{{requestId}}/quotes: anonymous bị từ chối |
| HTTP-0076 | Quotes | invalid | GET /api/v1/service-requests/{{absent}}/quotes | HTTP 401 | GET /api/v1/service-requests/{{requestId}}/quotes: invalid bị từ chối |
| HTTP-0077 | Quotes | anonymous | POST /api/v1/service-requests/{{absent}}/quotes | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/quotes: anonymous bị từ chối |
| HTTP-0078 | Quotes | invalid | POST /api/v1/service-requests/{{absent}}/quotes | HTTP 401 | POST /api/v1/service-requests/{{requestId}}/quotes: invalid bị từ chối |
| HTTP-0079 | Quotes | anonymous | POST /api/v1/quotes/{{absent}}/approve | HTTP 401 | POST /api/v1/quotes/{{quoteId}}/approve: anonymous bị từ chối |
| HTTP-0080 | Quotes | invalid | POST /api/v1/quotes/{{absent}}/approve | HTTP 401 | POST /api/v1/quotes/{{quoteId}}/approve: invalid bị từ chối |
| HTTP-0081 | Quotes | mechanic1 | POST /api/v1/quotes/{{absent}}/approve | HTTP 403/404 | POST /api/v1/quotes/{{quoteId}}/approve: mechanic bị từ chối (resource absent) |
| HTTP-0082 | Quotes | anonymous | POST /api/v1/quotes/{{absent}}/reject | HTTP 401 | POST /api/v1/quotes/{{quoteId}}/reject: anonymous bị từ chối |
| HTTP-0083 | Quotes | invalid | POST /api/v1/quotes/{{absent}}/reject | HTTP 401 | POST /api/v1/quotes/{{quoteId}}/reject: invalid bị từ chối |
| HTTP-0084 | Quotes | mechanic1 | POST /api/v1/quotes/{{absent}}/reject | HTTP 403/404 | POST /api/v1/quotes/{{quoteId}}/reject: mechanic bị từ chối (resource absent) |
| HTTP-0085 | Dispatch | anonymous | GET /api/v1/dispatch/offers | HTTP 401 | GET /api/v1/dispatch/offers: anonymous bị từ chối |
| HTTP-0086 | Dispatch | invalid | GET /api/v1/dispatch/offers | HTTP 401 | GET /api/v1/dispatch/offers: invalid bị từ chối |
| HTTP-0087 | Dispatch | rider1 | GET /api/v1/dispatch/offers | HTTP 403 | GET /api/v1/dispatch/offers: rider không có mechanic role |
| HTTP-0088 | Dispatch | anonymous | POST /api/v1/dispatch/offers/{{absent}}/accept | HTTP 401 | POST /api/v1/dispatch/offers/{{offerId}}/accept: anonymous bị từ chối |
| HTTP-0089 | Dispatch | invalid | POST /api/v1/dispatch/offers/{{absent}}/accept | HTTP 401 | POST /api/v1/dispatch/offers/{{offerId}}/accept: invalid bị từ chối |
| HTTP-0090 | Dispatch | rider1 | POST /api/v1/dispatch/offers/{{absent}}/accept | HTTP 403 | POST /api/v1/dispatch/offers/{{offerId}}/accept: rider không có mechanic role |
| HTTP-0091 | Dispatch | anonymous | POST /api/v1/dispatch/offers/{{absent}}/decline | HTTP 401 | POST /api/v1/dispatch/offers/{{offerId}}/decline: anonymous bị từ chối |
| HTTP-0092 | Dispatch | invalid | POST /api/v1/dispatch/offers/{{absent}}/decline | HTTP 401 | POST /api/v1/dispatch/offers/{{offerId}}/decline: invalid bị từ chối |
| HTTP-0093 | Dispatch | rider1 | POST /api/v1/dispatch/offers/{{absent}}/decline | HTTP 403 | POST /api/v1/dispatch/offers/{{offerId}}/decline: rider không có mechanic role |
| HTTP-0094 | Assignments | anonymous | GET /api/v1/assignments | HTTP 401 | GET /api/v1/assignments: anonymous bị từ chối |
| HTTP-0095 | Assignments | invalid | GET /api/v1/assignments | HTTP 401 | GET /api/v1/assignments: invalid bị từ chối |
| HTTP-0096 | Assignments | anonymous | POST /api/v1/assignments/{{absent}}/status | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/status: anonymous bị từ chối |
| HTTP-0097 | Assignments | invalid | POST /api/v1/assignments/{{absent}}/status | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/status: invalid bị từ chối |
| HTTP-0098 | Assignments | anonymous | POST /api/v1/assignments/{{absent}}/diagnoses | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/diagnoses: anonymous bị từ chối |
| HTTP-0099 | Assignments | invalid | POST /api/v1/assignments/{{absent}}/diagnoses | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/diagnoses: invalid bị từ chối |
| HTTP-0100 | Mechanic operations | anonymous | POST /api/v1/assignments/{{absent}}/eta | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/eta: anonymous bị từ chối |
| HTTP-0101 | Mechanic operations | invalid | POST /api/v1/assignments/{{absent}}/eta | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/eta: invalid bị từ chối |
| HTTP-0102 | Mechanic operations | rider1 | POST /api/v1/assignments/{{absent}}/eta | HTTP 403 | POST /api/v1/assignments/{{assignmentId}}/eta: rider không có mechanic role |
| HTTP-0103 | Mechanic operations | anonymous | POST /api/v1/assignments/{{absent}}/media | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/media: anonymous bị từ chối |
| HTTP-0104 | Mechanic operations | invalid | POST /api/v1/assignments/{{absent}}/media | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/media: invalid bị từ chối |
| HTTP-0105 | Mechanic operations | rider1 | POST /api/v1/assignments/{{absent}}/media | HTTP 403 | POST /api/v1/assignments/{{assignmentId}}/media: rider không có mechanic role |
| HTTP-0106 | Mechanic operations | anonymous | POST /api/v1/assignments/{{absent}}/completion-checklist | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/completion-checklist: anonymous bị từ chối |
| HTTP-0107 | Mechanic operations | invalid | POST /api/v1/assignments/{{absent}}/completion-checklist | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/completion-checklist: invalid bị từ chối |
| HTTP-0108 | Mechanic operations | rider1 | POST /api/v1/assignments/{{absent}}/completion-checklist | HTTP 403 | POST /api/v1/assignments/{{assignmentId}}/completion-checklist: rider không có mechanic role |
| HTTP-0109 | Recovery | anonymous | POST /api/v1/assignments/{{absent}}/recover | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/recover: anonymous bị từ chối |
| HTTP-0110 | Recovery | invalid | POST /api/v1/assignments/{{absent}}/recover | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/recover: invalid bị từ chối |
| HTTP-0111 | Reviews | anonymous | POST /api/v1/assignments/{{absent}}/review | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/review: anonymous bị từ chối |
| HTTP-0112 | Reviews | invalid | POST /api/v1/assignments/{{absent}}/review | HTTP 401 | POST /api/v1/assignments/{{assignmentId}}/review: invalid bị từ chối |
| HTTP-0113 | Reviews | mechanic1 | POST /api/v1/assignments/{{absent}}/review | HTTP 403 | POST /api/v1/assignments/{{assignmentId}}/review: mechanic bị từ chối (resource absent) |
| HTTP-0114 | Route ETA | anonymous | GET /api/v1/assignments/{{absent}}/route-eta | HTTP 401 | GET /api/v1/assignments/{{assignmentId}}/route-eta: anonymous bị từ chối |
| HTTP-0115 | Route ETA | invalid | GET /api/v1/assignments/{{absent}}/route-eta | HTTP 401 | GET /api/v1/assignments/{{assignmentId}}/route-eta: invalid bị từ chối |
| HTTP-0116 | Live tracking | anonymous | GET /api/v1/assignments/{{absent}}/live-location | HTTP 401 | GET /api/v1/assignments/{{assignmentId}}/live-location: anonymous bị từ chối |
| HTTP-0117 | Live tracking | invalid | GET /api/v1/assignments/{{absent}}/live-location | HTTP 401 | GET /api/v1/assignments/{{assignmentId}}/live-location: invalid bị từ chối |
| HTTP-0118 | Live tracking | anonymous | PUT /api/v1/assignments/{{absent}}/live-location | HTTP 401 | PUT /api/v1/assignments/{{assignmentId}}/live-location: anonymous bị từ chối |
| HTTP-0119 | Live tracking | invalid | PUT /api/v1/assignments/{{absent}}/live-location | HTTP 401 | PUT /api/v1/assignments/{{assignmentId}}/live-location: invalid bị từ chối |
| HTTP-0120 | Reminders | anonymous | GET /api/v1/reminders | HTTP 401 | GET /api/v1/reminders: anonymous bị từ chối |
| HTTP-0121 | Reminders | invalid | GET /api/v1/reminders | HTTP 401 | GET /api/v1/reminders: invalid bị từ chối |
| HTTP-0122 | Reminders | mechanic1 | GET /api/v1/reminders | HTTP 403 | GET /api/v1/reminders: mechanic bị từ chối (resource absent) |
| HTTP-0123 | Reminders | anonymous | POST /api/v1/reminders | HTTP 401 | POST /api/v1/reminders: anonymous bị từ chối |
| HTTP-0124 | Reminders | invalid | POST /api/v1/reminders | HTTP 401 | POST /api/v1/reminders: invalid bị từ chối |
| HTTP-0125 | Reminders | mechanic1 | POST /api/v1/reminders | HTTP 403 | POST /api/v1/reminders: mechanic bị từ chối (resource absent) |
| HTTP-0126 | Reminders | anonymous | PATCH /api/v1/reminders/{{absent}} | HTTP 401 | PATCH /api/v1/reminders/{{reminderId}}: anonymous bị từ chối |
| HTTP-0127 | Reminders | invalid | PATCH /api/v1/reminders/{{absent}} | HTTP 401 | PATCH /api/v1/reminders/{{reminderId}}: invalid bị từ chối |
| HTTP-0128 | Reminders | mechanic1 | PATCH /api/v1/reminders/{{absent}} | HTTP 403 | PATCH /api/v1/reminders/{{reminderId}}: mechanic bị từ chối (resource absent) |
| HTTP-0129 | Reminders | anonymous | POST /api/v1/reminders/{{absent}}/snooze | HTTP 401 | POST /api/v1/reminders/{{reminderId}}/snooze: anonymous bị từ chối |
| HTTP-0130 | Reminders | invalid | POST /api/v1/reminders/{{absent}}/snooze | HTTP 401 | POST /api/v1/reminders/{{reminderId}}/snooze: invalid bị từ chối |
| HTTP-0131 | Reminders | mechanic1 | POST /api/v1/reminders/{{absent}}/snooze | HTTP 403 | POST /api/v1/reminders/{{reminderId}}/snooze: mechanic bị từ chối (resource absent) |
| HTTP-0132 | Notifications | anonymous | GET /api/v1/notifications | HTTP 401 | GET /api/v1/notifications: anonymous bị từ chối |
| HTTP-0133 | Notifications | invalid | GET /api/v1/notifications | HTTP 401 | GET /api/v1/notifications: invalid bị từ chối |
| HTTP-0134 | Notifications | anonymous | GET /api/v1/notifications/unread-count | HTTP 401 | GET /api/v1/notifications/unread-count: anonymous bị từ chối |
| HTTP-0135 | Notifications | invalid | GET /api/v1/notifications/unread-count | HTTP 401 | GET /api/v1/notifications/unread-count: invalid bị từ chối |
| HTTP-0136 | Notifications | anonymous | POST /api/v1/notifications/{{absent}}/read | HTTP 401 | POST /api/v1/notifications/{{notificationId}}/read: anonymous bị từ chối |
| HTTP-0137 | Notifications | invalid | POST /api/v1/notifications/{{absent}}/read | HTTP 401 | POST /api/v1/notifications/{{notificationId}}/read: invalid bị từ chối |
| HTTP-0138 | Notifications | anonymous | POST /api/v1/notifications/read-all | HTTP 401 | POST /api/v1/notifications/read-all: anonymous bị từ chối |
| HTTP-0139 | Notifications | invalid | POST /api/v1/notifications/read-all | HTTP 401 | POST /api/v1/notifications/read-all: invalid bị từ chối |
| HTTP-0140 | Media uploads | anonymous | POST /api/v1/media/upload-intents | HTTP 401 | POST /api/v1/media/upload-intents: anonymous bị từ chối |
| HTTP-0141 | Media uploads | invalid | POST /api/v1/media/upload-intents | HTTP 401 | POST /api/v1/media/upload-intents: invalid bị từ chối |
| HTTP-0142 | Media uploads | anonymous | POST /api/v1/media/upload-intents/{{absent}}/finalize | HTTP 401 | POST /api/v1/media/upload-intents/{{intentId}}/finalize: anonymous bị từ chối |
| HTTP-0143 | Media uploads | invalid | POST /api/v1/media/upload-intents/{{absent}}/finalize | HTTP 401 | POST /api/v1/media/upload-intents/{{intentId}}/finalize: invalid bị từ chối |
| HTTP-0144 | Admin users | anonymous | GET /api/v1/admin/users | HTTP 401 | GET /api/v1/admin/users: anonymous bị từ chối |
| HTTP-0145 | Admin users | invalid | GET /api/v1/admin/users | HTTP 401 | GET /api/v1/admin/users: invalid bị từ chối |
| HTTP-0146 | Admin users | rider1 | GET /api/v1/admin/users | HTTP 403 | GET /api/v1/admin/users: rider1 không có admin role |
| HTTP-0147 | Admin users | mechanic1 | GET /api/v1/admin/users | HTTP 403 | GET /api/v1/admin/users: mechanic1 không có admin role |
| HTTP-0148 | Admin users | pending | GET /api/v1/admin/users | HTTP 403 | GET /api/v1/admin/users: pending không có admin role |
| HTTP-0149 | Admin users | anonymous | GET /api/v1/admin/users/{{absent}} | HTTP 401 | GET /api/v1/admin/users/{{userId}}: anonymous bị từ chối |
| HTTP-0150 | Admin users | invalid | GET /api/v1/admin/users/{{absent}} | HTTP 401 | GET /api/v1/admin/users/{{userId}}: invalid bị từ chối |
| HTTP-0151 | Admin users | rider1 | GET /api/v1/admin/users/{{absent}} | HTTP 403 | GET /api/v1/admin/users/{{userId}}: rider1 không có admin role |
| HTTP-0152 | Admin users | mechanic1 | GET /api/v1/admin/users/{{absent}} | HTTP 403 | GET /api/v1/admin/users/{{userId}}: mechanic1 không có admin role |
| HTTP-0153 | Admin users | pending | GET /api/v1/admin/users/{{absent}} | HTTP 403 | GET /api/v1/admin/users/{{userId}}: pending không có admin role |
| HTTP-0154 | Admin users | anonymous | GET /api/v1/admin/users/{{absent}}/devices | HTTP 401 | GET /api/v1/admin/users/{{userId}}/devices: anonymous bị từ chối |
| HTTP-0155 | Admin users | invalid | GET /api/v1/admin/users/{{absent}}/devices | HTTP 401 | GET /api/v1/admin/users/{{userId}}/devices: invalid bị từ chối |
| HTTP-0156 | Admin users | rider1 | GET /api/v1/admin/users/{{absent}}/devices | HTTP 403 | GET /api/v1/admin/users/{{userId}}/devices: rider1 không có admin role |
| HTTP-0157 | Admin users | mechanic1 | GET /api/v1/admin/users/{{absent}}/devices | HTTP 403 | GET /api/v1/admin/users/{{userId}}/devices: mechanic1 không có admin role |
| HTTP-0158 | Admin users | pending | GET /api/v1/admin/users/{{absent}}/devices | HTTP 403 | GET /api/v1/admin/users/{{userId}}/devices: pending không có admin role |
| HTTP-0159 | Admin users | anonymous | GET /api/v1/admin/users/{{absent}}/activity | HTTP 401 | GET /api/v1/admin/users/{{userId}}/activity: anonymous bị từ chối |
| HTTP-0160 | Admin users | invalid | GET /api/v1/admin/users/{{absent}}/activity | HTTP 401 | GET /api/v1/admin/users/{{userId}}/activity: invalid bị từ chối |
| HTTP-0161 | Admin users | rider1 | GET /api/v1/admin/users/{{absent}}/activity | HTTP 403 | GET /api/v1/admin/users/{{userId}}/activity: rider1 không có admin role |
| HTTP-0162 | Admin users | mechanic1 | GET /api/v1/admin/users/{{absent}}/activity | HTTP 403 | GET /api/v1/admin/users/{{userId}}/activity: mechanic1 không có admin role |
| HTTP-0163 | Admin users | pending | GET /api/v1/admin/users/{{absent}}/activity | HTTP 403 | GET /api/v1/admin/users/{{userId}}/activity: pending không có admin role |
| HTTP-0164 | Admin users | anonymous | POST /api/v1/admin/users/{{absent}}/suspend | HTTP 401 | POST /api/v1/admin/users/{{userId}}/suspend: anonymous bị từ chối |
| HTTP-0165 | Admin users | invalid | POST /api/v1/admin/users/{{absent}}/suspend | HTTP 401 | POST /api/v1/admin/users/{{userId}}/suspend: invalid bị từ chối |
| HTTP-0166 | Admin users | rider1 | POST /api/v1/admin/users/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/users/{{userId}}/suspend: rider1 không có admin role |
| HTTP-0167 | Admin users | mechanic1 | POST /api/v1/admin/users/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/users/{{userId}}/suspend: mechanic1 không có admin role |
| HTTP-0168 | Admin users | pending | POST /api/v1/admin/users/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/users/{{userId}}/suspend: pending không có admin role |
| HTTP-0169 | Admin users | anonymous | POST /api/v1/admin/users/{{absent}}/reactivate | HTTP 401 | POST /api/v1/admin/users/{{userId}}/reactivate: anonymous bị từ chối |
| HTTP-0170 | Admin users | invalid | POST /api/v1/admin/users/{{absent}}/reactivate | HTTP 401 | POST /api/v1/admin/users/{{userId}}/reactivate: invalid bị từ chối |
| HTTP-0171 | Admin users | rider1 | POST /api/v1/admin/users/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/users/{{userId}}/reactivate: rider1 không có admin role |
| HTTP-0172 | Admin users | mechanic1 | POST /api/v1/admin/users/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/users/{{userId}}/reactivate: mechanic1 không có admin role |
| HTTP-0173 | Admin users | pending | POST /api/v1/admin/users/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/users/{{userId}}/reactivate: pending không có admin role |
| HTTP-0174 | Admin users | anonymous | POST /api/v1/admin/users/{{absent}}/archive | HTTP 401 | POST /api/v1/admin/users/{{userId}}/archive: anonymous bị từ chối |
| HTTP-0175 | Admin users | invalid | POST /api/v1/admin/users/{{absent}}/archive | HTTP 401 | POST /api/v1/admin/users/{{userId}}/archive: invalid bị từ chối |
| HTTP-0176 | Admin users | rider1 | POST /api/v1/admin/users/{{absent}}/archive | HTTP 403 | POST /api/v1/admin/users/{{userId}}/archive: rider1 không có admin role |
| HTTP-0177 | Admin users | mechanic1 | POST /api/v1/admin/users/{{absent}}/archive | HTTP 403 | POST /api/v1/admin/users/{{userId}}/archive: mechanic1 không có admin role |
| HTTP-0178 | Admin users | pending | POST /api/v1/admin/users/{{absent}}/archive | HTTP 403 | POST /api/v1/admin/users/{{userId}}/archive: pending không có admin role |
| HTTP-0179 | Admin users | anonymous | POST /api/v1/admin/users/{{absent}}/roles/grant | HTTP 401 | POST /api/v1/admin/users/{{userId}}/roles/grant: anonymous bị từ chối |
| HTTP-0180 | Admin users | invalid | POST /api/v1/admin/users/{{absent}}/roles/grant | HTTP 401 | POST /api/v1/admin/users/{{userId}}/roles/grant: invalid bị từ chối |
| HTTP-0181 | Admin users | rider1 | POST /api/v1/admin/users/{{absent}}/roles/grant | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/grant: rider1 không có admin role |
| HTTP-0182 | Admin users | mechanic1 | POST /api/v1/admin/users/{{absent}}/roles/grant | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/grant: mechanic1 không có admin role |
| HTTP-0183 | Admin users | pending | POST /api/v1/admin/users/{{absent}}/roles/grant | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/grant: pending không có admin role |
| HTTP-0184 | Admin users | anonymous | POST /api/v1/admin/users/{{absent}}/roles/revoke | HTTP 401 | POST /api/v1/admin/users/{{userId}}/roles/revoke: anonymous bị từ chối |
| HTTP-0185 | Admin users | invalid | POST /api/v1/admin/users/{{absent}}/roles/revoke | HTTP 401 | POST /api/v1/admin/users/{{userId}}/roles/revoke: invalid bị từ chối |
| HTTP-0186 | Admin users | rider1 | POST /api/v1/admin/users/{{absent}}/roles/revoke | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/revoke: rider1 không có admin role |
| HTTP-0187 | Admin users | mechanic1 | POST /api/v1/admin/users/{{absent}}/roles/revoke | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/revoke: mechanic1 không có admin role |
| HTTP-0188 | Admin users | pending | POST /api/v1/admin/users/{{absent}}/roles/revoke | HTTP 403 | POST /api/v1/admin/users/{{userId}}/roles/revoke: pending không có admin role |
| HTTP-0189 | Admin users | anonymous | POST /api/v1/admin/devices/{{absent}}/revoke | HTTP 401 | POST /api/v1/admin/devices/{{deviceId}}/revoke: anonymous bị từ chối |
| HTTP-0190 | Admin users | invalid | POST /api/v1/admin/devices/{{absent}}/revoke | HTTP 401 | POST /api/v1/admin/devices/{{deviceId}}/revoke: invalid bị từ chối |
| HTTP-0191 | Admin users | rider1 | POST /api/v1/admin/devices/{{absent}}/revoke | HTTP 403 | POST /api/v1/admin/devices/{{deviceId}}/revoke: rider1 không có admin role |
| HTTP-0192 | Admin users | mechanic1 | POST /api/v1/admin/devices/{{absent}}/revoke | HTTP 403 | POST /api/v1/admin/devices/{{deviceId}}/revoke: mechanic1 không có admin role |
| HTTP-0193 | Admin users | pending | POST /api/v1/admin/devices/{{absent}}/revoke | HTTP 403 | POST /api/v1/admin/devices/{{deviceId}}/revoke: pending không có admin role |
| HTTP-0194 | Admin mechanics | anonymous | GET /api/v1/admin/mechanics | HTTP 401 | GET /api/v1/admin/mechanics: anonymous bị từ chối |
| HTTP-0195 | Admin mechanics | invalid | GET /api/v1/admin/mechanics | HTTP 401 | GET /api/v1/admin/mechanics: invalid bị từ chối |
| HTTP-0196 | Admin mechanics | rider1 | GET /api/v1/admin/mechanics | HTTP 403 | GET /api/v1/admin/mechanics: rider1 không có admin role |
| HTTP-0197 | Admin mechanics | mechanic1 | GET /api/v1/admin/mechanics | HTTP 403 | GET /api/v1/admin/mechanics: mechanic1 không có admin role |
| HTTP-0198 | Admin mechanics | pending | GET /api/v1/admin/mechanics | HTTP 403 | GET /api/v1/admin/mechanics: pending không có admin role |
| HTTP-0199 | Admin mechanics | anonymous | GET /api/v1/admin/mechanics/{{absent}} | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}: anonymous bị từ chối |
| HTTP-0200 | Admin mechanics | invalid | GET /api/v1/admin/mechanics/{{absent}} | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}: invalid bị từ chối |
| HTTP-0201 | Admin mechanics | rider1 | GET /api/v1/admin/mechanics/{{absent}} | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}: rider1 không có admin role |
| HTTP-0202 | Admin mechanics | mechanic1 | GET /api/v1/admin/mechanics/{{absent}} | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}: mechanic1 không có admin role |
| HTTP-0203 | Admin mechanics | pending | GET /api/v1/admin/mechanics/{{absent}} | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}: pending không có admin role |
| HTTP-0204 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/approve | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/approve: anonymous bị từ chối |
| HTTP-0205 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/approve | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/approve: invalid bị từ chối |
| HTTP-0206 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/approve | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/approve: rider1 không có admin role |
| HTTP-0207 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/approve | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/approve: mechanic1 không có admin role |
| HTTP-0208 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/approve | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/approve: pending không có admin role |
| HTTP-0209 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/reject | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/reject: anonymous bị từ chối |
| HTTP-0210 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/reject | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/reject: invalid bị từ chối |
| HTTP-0211 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/reject | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reject: rider1 không có admin role |
| HTTP-0212 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/reject | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reject: mechanic1 không có admin role |
| HTTP-0213 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/reject | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reject: pending không có admin role |
| HTTP-0214 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/suspend | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/suspend: anonymous bị từ chối |
| HTTP-0215 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/suspend | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/suspend: invalid bị từ chối |
| HTTP-0216 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/suspend: rider1 không có admin role |
| HTTP-0217 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/suspend: mechanic1 không có admin role |
| HTTP-0218 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/suspend | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/suspend: pending không có admin role |
| HTTP-0219 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/ban | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/ban: anonymous bị từ chối |
| HTTP-0220 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/ban | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/ban: invalid bị từ chối |
| HTTP-0221 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/ban | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/ban: rider1 không có admin role |
| HTTP-0222 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/ban | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/ban: mechanic1 không có admin role |
| HTTP-0223 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/ban | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/ban: pending không có admin role |
| HTTP-0224 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/reactivate | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/reactivate: anonymous bị từ chối |
| HTTP-0225 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/reactivate | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/reactivate: invalid bị từ chối |
| HTTP-0226 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reactivate: rider1 không có admin role |
| HTTP-0227 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reactivate: mechanic1 không có admin role |
| HTTP-0228 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/reactivate | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/reactivate: pending không có admin role |
| HTTP-0229 | Admin mechanics | anonymous | PUT /api/v1/admin/mechanics/{{absent}}/skills | HTTP 401 | PUT /api/v1/admin/mechanics/{{mechanicId}}/skills: anonymous bị từ chối |
| HTTP-0230 | Admin mechanics | invalid | PUT /api/v1/admin/mechanics/{{absent}}/skills | HTTP 401 | PUT /api/v1/admin/mechanics/{{mechanicId}}/skills: invalid bị từ chối |
| HTTP-0231 | Admin mechanics | rider1 | PUT /api/v1/admin/mechanics/{{absent}}/skills | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/skills: rider1 không có admin role |
| HTTP-0232 | Admin mechanics | mechanic1 | PUT /api/v1/admin/mechanics/{{absent}}/skills | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/skills: mechanic1 không có admin role |
| HTTP-0233 | Admin mechanics | pending | PUT /api/v1/admin/mechanics/{{absent}}/skills | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/skills: pending không có admin role |
| HTTP-0234 | Admin mechanics | anonymous | PUT /api/v1/admin/mechanics/{{absent}}/service-radius | HTTP 401 | PUT /api/v1/admin/mechanics/{{mechanicId}}/service-radius: anonymous bị từ chối |
| HTTP-0235 | Admin mechanics | invalid | PUT /api/v1/admin/mechanics/{{absent}}/service-radius | HTTP 401 | PUT /api/v1/admin/mechanics/{{mechanicId}}/service-radius: invalid bị từ chối |
| HTTP-0236 | Admin mechanics | rider1 | PUT /api/v1/admin/mechanics/{{absent}}/service-radius | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/service-radius: rider1 không có admin role |
| HTTP-0237 | Admin mechanics | mechanic1 | PUT /api/v1/admin/mechanics/{{absent}}/service-radius | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/service-radius: mechanic1 không có admin role |
| HTTP-0238 | Admin mechanics | pending | PUT /api/v1/admin/mechanics/{{absent}}/service-radius | HTTP 403 | PUT /api/v1/admin/mechanics/{{mechanicId}}/service-radius: pending không có admin role |
| HTTP-0239 | Admin mechanics | anonymous | POST /api/v1/admin/mechanics/{{absent}}/force-unavailable | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/force-unavailable: anonymous bị từ chối |
| HTTP-0240 | Admin mechanics | invalid | POST /api/v1/admin/mechanics/{{absent}}/force-unavailable | HTTP 401 | POST /api/v1/admin/mechanics/{{mechanicId}}/force-unavailable: invalid bị từ chối |
| HTTP-0241 | Admin mechanics | rider1 | POST /api/v1/admin/mechanics/{{absent}}/force-unavailable | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/force-unavailable: rider1 không có admin role |
| HTTP-0242 | Admin mechanics | mechanic1 | POST /api/v1/admin/mechanics/{{absent}}/force-unavailable | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/force-unavailable: mechanic1 không có admin role |
| HTTP-0243 | Admin mechanics | pending | POST /api/v1/admin/mechanics/{{absent}}/force-unavailable | HTTP 403 | POST /api/v1/admin/mechanics/{{mechanicId}}/force-unavailable: pending không có admin role |
| HTTP-0244 | Admin mechanics | anonymous | GET /api/v1/admin/mechanics/{{absent}}/work-history | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history: anonymous bị từ chối |
| HTTP-0245 | Admin mechanics | invalid | GET /api/v1/admin/mechanics/{{absent}}/work-history | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history: invalid bị từ chối |
| HTTP-0246 | Admin mechanics | rider1 | GET /api/v1/admin/mechanics/{{absent}}/work-history | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history: rider1 không có admin role |
| HTTP-0247 | Admin mechanics | mechanic1 | GET /api/v1/admin/mechanics/{{absent}}/work-history | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history: mechanic1 không có admin role |
| HTTP-0248 | Admin mechanics | pending | GET /api/v1/admin/mechanics/{{absent}}/work-history | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history: pending không có admin role |
| HTTP-0249 | Admin mechanics | anonymous | GET /api/v1/admin/mechanics/{{absent}}/performance | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}/performance: anonymous bị từ chối |
| HTTP-0250 | Admin mechanics | invalid | GET /api/v1/admin/mechanics/{{absent}}/performance | HTTP 401 | GET /api/v1/admin/mechanics/{{mechanicId}}/performance: invalid bị từ chối |
| HTTP-0251 | Admin mechanics | rider1 | GET /api/v1/admin/mechanics/{{absent}}/performance | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/performance: rider1 không có admin role |
| HTTP-0252 | Admin mechanics | mechanic1 | GET /api/v1/admin/mechanics/{{absent}}/performance | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/performance: mechanic1 không có admin role |
| HTTP-0253 | Admin mechanics | pending | GET /api/v1/admin/mechanics/{{absent}}/performance | HTTP 403 | GET /api/v1/admin/mechanics/{{mechanicId}}/performance: pending không có admin role |
| HTTP-0254 | Admin requests | anonymous | GET /api/v1/admin/service-requests | HTTP 401 | GET /api/v1/admin/service-requests: anonymous bị từ chối |
| HTTP-0255 | Admin requests | invalid | GET /api/v1/admin/service-requests | HTTP 401 | GET /api/v1/admin/service-requests: invalid bị từ chối |
| HTTP-0256 | Admin requests | rider1 | GET /api/v1/admin/service-requests | HTTP 403 | GET /api/v1/admin/service-requests: rider1 không có admin role |
| HTTP-0257 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests | HTTP 403 | GET /api/v1/admin/service-requests: mechanic1 không có admin role |
| HTTP-0258 | Admin requests | pending | GET /api/v1/admin/service-requests | HTTP 403 | GET /api/v1/admin/service-requests: pending không có admin role |
| HTTP-0259 | Admin requests | anonymous | GET /api/v1/admin/service-requests/{{absent}} | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}: anonymous bị từ chối |
| HTTP-0260 | Admin requests | invalid | GET /api/v1/admin/service-requests/{{absent}} | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}: invalid bị từ chối |
| HTTP-0261 | Admin requests | rider1 | GET /api/v1/admin/service-requests/{{absent}} | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}: rider1 không có admin role |
| HTTP-0262 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests/{{absent}} | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}: mechanic1 không có admin role |
| HTTP-0263 | Admin requests | pending | GET /api/v1/admin/service-requests/{{absent}} | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}: pending không có admin role |
| HTTP-0264 | Admin requests | anonymous | GET /api/v1/admin/service-requests/{{absent}}/timeline | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/timeline: anonymous bị từ chối |
| HTTP-0265 | Admin requests | invalid | GET /api/v1/admin/service-requests/{{absent}}/timeline | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/timeline: invalid bị từ chối |
| HTTP-0266 | Admin requests | rider1 | GET /api/v1/admin/service-requests/{{absent}}/timeline | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/timeline: rider1 không có admin role |
| HTTP-0267 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests/{{absent}}/timeline | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/timeline: mechanic1 không có admin role |
| HTTP-0268 | Admin requests | pending | GET /api/v1/admin/service-requests/{{absent}}/timeline | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/timeline: pending không có admin role |
| HTTP-0269 | Admin requests | anonymous | GET /api/v1/admin/service-requests/{{absent}}/media | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/media: anonymous bị từ chối |
| HTTP-0270 | Admin requests | invalid | GET /api/v1/admin/service-requests/{{absent}}/media | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/media: invalid bị từ chối |
| HTTP-0271 | Admin requests | rider1 | GET /api/v1/admin/service-requests/{{absent}}/media | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/media: rider1 không có admin role |
| HTTP-0272 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests/{{absent}}/media | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/media: mechanic1 không có admin role |
| HTTP-0273 | Admin requests | pending | GET /api/v1/admin/service-requests/{{absent}}/media | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/media: pending không có admin role |
| HTTP-0274 | Admin requests | anonymous | GET /api/v1/admin/service-requests/{{absent}}/assignment | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/assignment: anonymous bị từ chối |
| HTTP-0275 | Admin requests | invalid | GET /api/v1/admin/service-requests/{{absent}}/assignment | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/assignment: invalid bị từ chối |
| HTTP-0276 | Admin requests | rider1 | GET /api/v1/admin/service-requests/{{absent}}/assignment | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/assignment: rider1 không có admin role |
| HTTP-0277 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests/{{absent}}/assignment | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/assignment: mechanic1 không có admin role |
| HTTP-0278 | Admin requests | pending | GET /api/v1/admin/service-requests/{{absent}}/assignment | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/assignment: pending không có admin role |
| HTTP-0279 | Admin requests | anonymous | GET /api/v1/admin/service-requests/{{absent}}/quotes | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/quotes: anonymous bị từ chối |
| HTTP-0280 | Admin requests | invalid | GET /api/v1/admin/service-requests/{{absent}}/quotes | HTTP 401 | GET /api/v1/admin/service-requests/{{requestId}}/quotes: invalid bị từ chối |
| HTTP-0281 | Admin requests | rider1 | GET /api/v1/admin/service-requests/{{absent}}/quotes | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/quotes: rider1 không có admin role |
| HTTP-0282 | Admin requests | mechanic1 | GET /api/v1/admin/service-requests/{{absent}}/quotes | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/quotes: mechanic1 không có admin role |
| HTTP-0283 | Admin requests | pending | GET /api/v1/admin/service-requests/{{absent}}/quotes | HTTP 403 | GET /api/v1/admin/service-requests/{{requestId}}/quotes: pending không có admin role |
| HTTP-0284 | Admin requests | anonymous | POST /api/v1/admin/service-requests/{{absent}}/cancel | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/cancel: anonymous bị từ chối |
| HTTP-0285 | Admin requests | invalid | POST /api/v1/admin/service-requests/{{absent}}/cancel | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/cancel: invalid bị từ chối |
| HTTP-0286 | Admin requests | rider1 | POST /api/v1/admin/service-requests/{{absent}}/cancel | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/cancel: rider1 không có admin role |
| HTTP-0287 | Admin requests | mechanic1 | POST /api/v1/admin/service-requests/{{absent}}/cancel | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/cancel: mechanic1 không có admin role |
| HTTP-0288 | Admin requests | pending | POST /api/v1/admin/service-requests/{{absent}}/cancel | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/cancel: pending không có admin role |
| HTTP-0289 | Admin requests | anonymous | POST /api/v1/admin/service-requests/{{absent}}/manual-escalate | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/manual-escalate: anonymous bị từ chối |
| HTTP-0290 | Admin requests | invalid | POST /api/v1/admin/service-requests/{{absent}}/manual-escalate | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/manual-escalate: invalid bị từ chối |
| HTTP-0291 | Admin requests | rider1 | POST /api/v1/admin/service-requests/{{absent}}/manual-escalate | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/manual-escalate: rider1 không có admin role |
| HTTP-0292 | Admin requests | mechanic1 | POST /api/v1/admin/service-requests/{{absent}}/manual-escalate | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/manual-escalate: mechanic1 không có admin role |
| HTTP-0293 | Admin requests | pending | POST /api/v1/admin/service-requests/{{absent}}/manual-escalate | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/manual-escalate: pending không có admin role |
| HTTP-0294 | Admin requests | anonymous | POST /api/v1/admin/service-requests/{{absent}}/notes | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/notes: anonymous bị từ chối |
| HTTP-0295 | Admin requests | invalid | POST /api/v1/admin/service-requests/{{absent}}/notes | HTTP 401 | POST /api/v1/admin/service-requests/{{requestId}}/notes: invalid bị từ chối |
| HTTP-0296 | Admin requests | rider1 | POST /api/v1/admin/service-requests/{{absent}}/notes | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/notes: rider1 không có admin role |
| HTTP-0297 | Admin requests | mechanic1 | POST /api/v1/admin/service-requests/{{absent}}/notes | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/notes: mechanic1 không có admin role |
| HTTP-0298 | Admin requests | pending | POST /api/v1/admin/service-requests/{{absent}}/notes | HTTP 403 | POST /api/v1/admin/service-requests/{{requestId}}/notes: pending không có admin role |
| HTTP-0299 | Operations | anonymous | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 401 | GET /api/v1/admin/operations/outbox-dead-letters: anonymous bị từ chối |
| HTTP-0300 | Operations | invalid | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 401 | GET /api/v1/admin/operations/outbox-dead-letters: invalid bị từ chối |
| HTTP-0301 | Operations | rider1 | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 403 | GET /api/v1/admin/operations/outbox-dead-letters: rider1 không có admin role |
| HTTP-0302 | Operations | mechanic1 | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 403 | GET /api/v1/admin/operations/outbox-dead-letters: mechanic1 không có admin role |
| HTTP-0303 | Operations | pending | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 403 | GET /api/v1/admin/operations/outbox-dead-letters: pending không có admin role |
| HTTP-0304 | Operations | anonymous | GET /api/v1/admin/operations/dispatch-stuck | HTTP 401 | GET /api/v1/admin/operations/dispatch-stuck: anonymous bị từ chối |
| HTTP-0305 | Operations | invalid | GET /api/v1/admin/operations/dispatch-stuck | HTTP 401 | GET /api/v1/admin/operations/dispatch-stuck: invalid bị từ chối |
| HTTP-0306 | Operations | rider1 | GET /api/v1/admin/operations/dispatch-stuck | HTTP 403 | GET /api/v1/admin/operations/dispatch-stuck: rider1 không có admin role |
| HTTP-0307 | Operations | mechanic1 | GET /api/v1/admin/operations/dispatch-stuck | HTTP 403 | GET /api/v1/admin/operations/dispatch-stuck: mechanic1 không có admin role |
| HTTP-0308 | Operations | pending | GET /api/v1/admin/operations/dispatch-stuck | HTTP 403 | GET /api/v1/admin/operations/dispatch-stuck: pending không có admin role |
| HTTP-0309 | Operations | anonymous | GET /api/v1/admin/operations/worker-runs | HTTP 401 | GET /api/v1/admin/operations/worker-runs: anonymous bị từ chối |
| HTTP-0310 | Operations | invalid | GET /api/v1/admin/operations/worker-runs | HTTP 401 | GET /api/v1/admin/operations/worker-runs: invalid bị từ chối |
| HTTP-0311 | Operations | rider1 | GET /api/v1/admin/operations/worker-runs | HTTP 403 | GET /api/v1/admin/operations/worker-runs: rider1 không có admin role |
| HTTP-0312 | Operations | mechanic1 | GET /api/v1/admin/operations/worker-runs | HTTP 403 | GET /api/v1/admin/operations/worker-runs: mechanic1 không có admin role |
| HTTP-0313 | Operations | pending | GET /api/v1/admin/operations/worker-runs | HTTP 403 | GET /api/v1/admin/operations/worker-runs: pending không có admin role |
| HTTP-0314 | Workers | anonymous | POST /api/v1/internal/workers/reminders/run | HTTP 401 | POST /api/v1/internal/workers/reminders/run: anonymous bị từ chối |
| HTTP-0315 | Workers | invalid | POST /api/v1/internal/workers/reminders/run | HTTP 401 | POST /api/v1/internal/workers/reminders/run: invalid bị từ chối |
| HTTP-0316 | Workers | anonymous | POST /api/v1/internal/workers/reminders/run | HTTP 401 | /api/v1/internal/workers/reminders/run: sai worker secret |
| HTTP-0317 | Workers | rider1 | POST /api/v1/internal/workers/reminders/run | HTTP 401 | /api/v1/internal/workers/reminders/run: JWT rider1 không thay worker secret |
| HTTP-0318 | Workers | mechanic1 | POST /api/v1/internal/workers/reminders/run | HTTP 401 | /api/v1/internal/workers/reminders/run: JWT mechanic1 không thay worker secret |
| HTTP-0319 | Workers | admin | POST /api/v1/internal/workers/reminders/run | HTTP 401 | /api/v1/internal/workers/reminders/run: JWT admin không thay worker secret |
| HTTP-0320 | Workers | anonymous | POST /api/v1/internal/workers/outbox/run | HTTP 401 | POST /api/v1/internal/workers/outbox/run: anonymous bị từ chối |
| HTTP-0321 | Workers | invalid | POST /api/v1/internal/workers/outbox/run | HTTP 401 | POST /api/v1/internal/workers/outbox/run: invalid bị từ chối |
| HTTP-0322 | Workers | anonymous | POST /api/v1/internal/workers/outbox/run | HTTP 401 | /api/v1/internal/workers/outbox/run: sai worker secret |
| HTTP-0323 | Workers | rider1 | POST /api/v1/internal/workers/outbox/run | HTTP 401 | /api/v1/internal/workers/outbox/run: JWT rider1 không thay worker secret |
| HTTP-0324 | Workers | mechanic1 | POST /api/v1/internal/workers/outbox/run | HTTP 401 | /api/v1/internal/workers/outbox/run: JWT mechanic1 không thay worker secret |
| HTTP-0325 | Workers | admin | POST /api/v1/internal/workers/outbox/run | HTTP 401 | /api/v1/internal/workers/outbox/run: JWT admin không thay worker secret |
| HTTP-0326 | Workers | anonymous | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | POST /api/v1/internal/workers/dispatch/run: anonymous bị từ chối |
| HTTP-0327 | Workers | invalid | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | POST /api/v1/internal/workers/dispatch/run: invalid bị từ chối |
| HTTP-0328 | Workers | anonymous | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | /api/v1/internal/workers/dispatch/run: sai worker secret |
| HTTP-0329 | Workers | rider1 | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | /api/v1/internal/workers/dispatch/run: JWT rider1 không thay worker secret |
| HTTP-0330 | Workers | mechanic1 | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | /api/v1/internal/workers/dispatch/run: JWT mechanic1 không thay worker secret |
| HTTP-0331 | Workers | admin | POST /api/v1/internal/workers/dispatch/run | HTTP 401 | /api/v1/internal/workers/dispatch/run: JWT admin không thay worker secret |
| HTTP-0332 | Workers | anonymous | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | POST /api/v1/internal/workers/media-uploads/cleanup: anonymous bị từ chối |
| HTTP-0333 | Workers | invalid | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | POST /api/v1/internal/workers/media-uploads/cleanup: invalid bị từ chối |
| HTTP-0334 | Workers | anonymous | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | /api/v1/internal/workers/media-uploads/cleanup: sai worker secret |
| HTTP-0335 | Workers | rider1 | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | /api/v1/internal/workers/media-uploads/cleanup: JWT rider1 không thay worker secret |
| HTTP-0336 | Workers | mechanic1 | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | /api/v1/internal/workers/media-uploads/cleanup: JWT mechanic1 không thay worker secret |
| HTTP-0337 | Workers | admin | POST /api/v1/internal/workers/media-uploads/cleanup | HTTP 401 | /api/v1/internal/workers/media-uploads/cleanup: JWT admin không thay worker secret |
| HTTP-0338 | Workers | anonymous | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | POST /api/v1/internal/workers/reviews/rebuild-ratings: anonymous bị từ chối |
| HTTP-0339 | Workers | invalid | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | POST /api/v1/internal/workers/reviews/rebuild-ratings: invalid bị từ chối |
| HTTP-0340 | Workers | anonymous | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | /api/v1/internal/workers/reviews/rebuild-ratings: sai worker secret |
| HTTP-0341 | Workers | rider1 | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | /api/v1/internal/workers/reviews/rebuild-ratings: JWT rider1 không thay worker secret |
| HTTP-0342 | Workers | mechanic1 | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | /api/v1/internal/workers/reviews/rebuild-ratings: JWT mechanic1 không thay worker secret |
| HTTP-0343 | Workers | admin | POST /api/v1/internal/workers/reviews/rebuild-ratings | HTTP 401 | /api/v1/internal/workers/reviews/rebuild-ratings: JWT admin không thay worker secret |
| HTTP-0344 | Workers | anonymous | POST /api/v1/internal/workers/retention/run | HTTP 401 | POST /api/v1/internal/workers/retention/run: anonymous bị từ chối |
| HTTP-0345 | Workers | invalid | POST /api/v1/internal/workers/retention/run | HTTP 401 | POST /api/v1/internal/workers/retention/run: invalid bị từ chối |
| HTTP-0346 | Workers | anonymous | POST /api/v1/internal/workers/retention/run | HTTP 401 | /api/v1/internal/workers/retention/run: sai worker secret |
| HTTP-0347 | Workers | rider1 | POST /api/v1/internal/workers/retention/run | HTTP 401 | /api/v1/internal/workers/retention/run: JWT rider1 không thay worker secret |
| HTTP-0348 | Workers | mechanic1 | POST /api/v1/internal/workers/retention/run | HTTP 401 | /api/v1/internal/workers/retention/run: JWT mechanic1 không thay worker secret |
| HTTP-0349 | Workers | admin | POST /api/v1/internal/workers/retention/run | HTTP 401 | /api/v1/internal/workers/retention/run: JWT admin không thay worker secret |
| HTTP-0350 | Workers | anonymous | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | POST /api/v1/internal/workers/live-locations/cleanup: anonymous bị từ chối |
| HTTP-0351 | Workers | invalid | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | POST /api/v1/internal/workers/live-locations/cleanup: invalid bị từ chối |
| HTTP-0352 | Workers | anonymous | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | /api/v1/internal/workers/live-locations/cleanup: sai worker secret |
| HTTP-0353 | Workers | rider1 | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | /api/v1/internal/workers/live-locations/cleanup: JWT rider1 không thay worker secret |
| HTTP-0354 | Workers | mechanic1 | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | /api/v1/internal/workers/live-locations/cleanup: JWT mechanic1 không thay worker secret |
| HTTP-0355 | Workers | admin | POST /api/v1/internal/workers/live-locations/cleanup | HTTP 401 | /api/v1/internal/workers/live-locations/cleanup: JWT admin không thay worker secret |
| HTTP-0356 | Auth | rider1 | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (rider1) |
| HTTP-0357 | Auth | rider2 | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (rider2) |
| HTTP-0358 | Auth | mechanic1 | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (mechanic1) |
| HTTP-0359 | Auth | mechanic2 | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (mechanic2) |
| HTTP-0360 | Auth | pending | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (pending) |
| HTTP-0361 | Auth | admin | GET /api/v1/auth/me | HTTP 200 | JWT thật: actor đúng ID/roles (admin) |
| HTTP-0362 | Auth | rider1 | POST /api/v1/auth/profile | HTTP 200 | Bootstrap replay giữ nguyên rider |
| HTTP-0363 | Auth | fresh | POST /api/v1/auth/profile | HTTP 400/422 | Từ chối self-select admin |
| HTTP-0364 | Auth | fresh | POST /api/v1/auth/profile | HTTP 400/422 | Từ chối role injection |
| HTTP-0365 | Auth | fresh | POST /api/v1/auth/profile | HTTP 200 | Chọn mechanic lần đầu |
| HTTP-0366 | Auth | fresh | POST /api/v1/auth/profile | HTTP 200/409 | Account type bất biến |
| HTTP-0367 | Auth | rider1 | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | Profile input sai bị chặn |
| HTTP-0368 | Auth | rider1 | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | Profile input sai bị chặn |
| HTTP-0369 | Auth | rider1 | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | Profile input sai bị chặn |
| HTTP-0370 | Auth | rider1 | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | Profile input sai bị chặn |
| HTTP-0371 | Auth | rider1 | PATCH /api/v1/auth/profile | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. | Đổi display name |
| HTTP-0372 | Auth | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | JWT none/HS256/expired/tampered không được chấp nhận |
| HTTP-0373 | Google OAuth | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Google JWT thật được backend chấp nhận và provider là google |
| HTTP-0374 | Google OAuth | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Refresh Google session giữ đúng user; refresh token sai bị từ chối |
| HTTP-0375 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 200 | Đăng ký device chỉ trả metadata |
| HTTP-0376 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 200 | Device replay giữ nguyên id |
| HTTP-0377 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0378 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0379 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0380 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0381 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0382 | Devices | rider1 | POST /api/v1/auth/devices | HTTP 400/422 | Device invalid/paired push fields |
| HTTP-0383 | Devices | rider2 | PUT /api/v1/auth/devices/{{deviceId}}/push-token | HTTP 403/404 | Push token device khác: rider2 |
| HTTP-0384 | Devices | mechanic1 | PUT /api/v1/auth/devices/{{deviceId}}/push-token | HTTP 403/404 | Push token device khác: mechanic1 |
| HTTP-0385 | Devices | rider1 | PUT /api/v1/auth/devices/{{deviceId}}/push-token | HTTP 200 | Push đăng ký và response redacted |
| HTTP-0386 | Devices | rider1 | DELETE /api/v1/auth/devices/{{deviceId}}/push-token | HTTP 200 | Thu hồi push token |
| HTTP-0387 | Devices | rider1 | DELETE /api/v1/auth/devices/{{deviceId}}/push-token | HTTP 200 | Thu hồi replay idempotent |
| HTTP-0388 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 201 | Tạo xe rider1 |
| HTTP-0389 | Motorcycles | rider2 | POST /api/v1/motorcycles | HTTP 201 | Tạo xe rider2 |
| HTTP-0390 | Motorcycles | rider1 | GET /api/v1/motorcycles | HTTP 200 | List chỉ chứa xe owner |
| HTTP-0391 | Motorcycles | rider1 | GET /api/v1/motorcycles/{{motorcycleId}} | HTTP 200 | Đọc xe owner |
| HTTP-0392 | Motorcycles | rider2 | GET /api/v1/motorcycles/{{motorcycleId}} | HTTP 403 | GET xe owner khác bị chặn |
| HTTP-0393 | Motorcycles | rider2 | PATCH /api/v1/motorcycles/{{motorcycleId}} | HTTP 403 | PATCH xe owner khác bị chặn |
| HTTP-0394 | Motorcycles | rider2 | DELETE /api/v1/motorcycles/{{motorcycleId}} | HTTP 403 | DELETE xe owner khác bị chặn |
| HTTP-0395 | Motorcycles | rider1 | GET /api/v1/motorcycles/{{absent}} | HTTP 404 | GET UUID không tồn tại |
| HTTP-0396 | Motorcycles | rider1 | PATCH /api/v1/motorcycles/{{absent}} | HTTP 404 | PATCH UUID không tồn tại |
| HTTP-0397 | Motorcycles | rider1 | DELETE /api/v1/motorcycles/{{absent}} | HTTP 404 | DELETE UUID không tồn tại |
| HTTP-0398 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema brand_text=invalid string |
| HTTP-0399 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema brand_text=invalid string |
| HTTP-0400 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema brand_text=invalid string |
| HTTP-0401 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema model_text=invalid string |
| HTTP-0402 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema model_text=2 |
| HTTP-0403 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema year=1949 |
| HTTP-0404 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema year=2101 |
| HTTP-0405 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema year=2020.5 |
| HTTP-0406 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema license_plate=invalid string |
| HTTP-0407 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema notes=invalid string |
| HTTP-0408 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 400/422 | Biên/schema rider_id=invalid string |
| HTTP-0409 | Motorcycles | rider1 | PATCH /api/v1/motorcycles/{{motorcycleId}} | HTTP 200 | Update xe owner |
| HTTP-0410 | Motorcycles | rider1 | POST /api/v1/motorcycles | HTTP 201 | Tạo xe để archive |
| HTTP-0411 | Motorcycles | rider1 | DELETE /api/v1/motorcycles/{{archivedMotorcycleId}} | HTTP 204 | Archive xe |
| HTTP-0412 | Motorcycles | rider1 | GET /api/v1/motorcycles/{{archivedMotorcycleId}} | HTTP 404 | Archive không còn đọc được |
| HTTP-0413 | Mechanic profile | mechanic1 | GET /api/v1/mechanics/me/profile | HTTP 200 | Mechanic mới pending/unavailable (mechanic1) |
| HTTP-0414 | Mechanic profile | mechanic2 | GET /api/v1/mechanics/me/profile | HTTP 200 | Mechanic mới pending/unavailable (mechanic2) |
| HTTP-0415 | Mechanic profile | pending | GET /api/v1/mechanics/me/profile | HTTP 200 | Mechanic mới pending/unavailable (pending) |
| HTTP-0416 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0417 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0418 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0419 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0420 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0421 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0422 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0423 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 400/422 | Không tự nâng status/rating; radius/skills valid |
| HTTP-0424 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic1_id}}/approve | HTTP 400/422 | Approve mechanic1 thiếu idempotency |
| HTTP-0425 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic1_id}}/approve | HTTP 200 | Approve mechanic1 |
| HTTP-0426 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic1_id}}/approve | HTTP 200 | Approve replay mechanic1 |
| HTTP-0427 | Mechanic profile | mechanic1 | PATCH /api/v1/mechanics/me/profile | HTTP 200 | Cấu hình skills/radius mechanic1 |
| HTTP-0428 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/availability | HTTP 200 | Availability mechanic1 |
| HTTP-0429 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/location | HTTP 204 | Fresh location mechanic1 |
| HTTP-0430 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic2_id}}/approve | HTTP 400/422 | Approve mechanic2 thiếu idempotency |
| HTTP-0431 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic2_id}}/approve | HTTP 200 | Approve mechanic2 |
| HTTP-0432 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{mechanic2_id}}/approve | HTTP 200 | Approve replay mechanic2 |
| HTTP-0433 | Mechanic profile | mechanic2 | PATCH /api/v1/mechanics/me/profile | HTTP 200 | Cấu hình skills/radius mechanic2 |
| HTTP-0434 | Mechanic profile | mechanic2 | PUT /api/v1/mechanics/me/availability | HTTP 200 | Availability mechanic2 |
| HTTP-0435 | Mechanic profile | mechanic2 | PUT /api/v1/mechanics/me/location | HTTP 204 | Fresh location mechanic2 |
| HTTP-0436 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/location | HTTP 400/422 | Location biên/type/client timestamp |
| HTTP-0437 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/location | HTTP 400/422 | Location biên/type/client timestamp |
| HTTP-0438 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/location | HTTP 400/422 | Location biên/type/client timestamp |
| HTTP-0439 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/location | HTTP 400/422 | Location biên/type/client timestamp |
| HTTP-0440 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/availability | HTTP 400/422 | Availability schema |
| HTTP-0441 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/availability | HTTP 400/422 | Availability schema |
| HTTP-0442 | Mechanic profile | mechanic1 | PUT /api/v1/mechanics/me/availability | HTTP 400/422 | Availability schema |
| HTTP-0443 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/dashboard | HTTP 200 | Read model /dashboard |
| HTTP-0444 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs | HTTP 200 | Read model /jobs |
| HTTP-0445 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/performance | HTTP 200 | Read model /performance |
| HTTP-0446 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?limit=0 | HTTP 400/422 | Jobs filter limit=0 |
| HTTP-0447 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?limit=101 | HTTP 400/422 | Jobs filter limit=101 |
| HTTP-0448 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?limit=abc | HTTP 400/422 | Jobs filter limit=abc |
| HTTP-0449 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?cursor=invalid | HTTP 400/422 | Jobs filter cursor=invalid |
| HTTP-0450 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?status=invalid | HTTP 400/422 | Jobs filter status=invalid |
| HTTP-0451 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?active_only=wrong | HTTP 400/422 | Jobs filter active_only=wrong |
| HTTP-0452 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?date_from=bad | HTTP 400/422 | Jobs filter date_from=bad |
| HTTP-0453 | Mechanic operations | mechanic1 | GET /api/v1/mechanics/me/jobs?date_from=2030-01-01&date_to=2020-01-01 | HTTP 400/422 | Jobs filter date_from=2030-01-01&date_to=2020-01-01 |
| HTTP-0454 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Tạo yêu cầu emergency_rescue |
| HTTP-0455 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 200/201 | Replay emergency_rescue không duplicate |
| HTTP-0456 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 409 | Key conflict emergency_rescue |
| HTTP-0457 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Tạo yêu cầu mobile_repair |
| HTTP-0458 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 200/201 | Replay mobile_repair không duplicate |
| HTTP-0459 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 409 | Key conflict mobile_repair |
| HTTP-0460 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Tạo yêu cầu at_home_service |
| HTTP-0461 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 200/201 | Replay at_home_service không duplicate |
| HTTP-0462 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 409 | Key conflict at_home_service |
| HTTP-0463 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Tạo yêu cầu periodic_maintenance |
| HTTP-0464 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 200/201 | Replay periodic_maintenance không duplicate |
| HTTP-0465 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 409 | Key conflict periodic_maintenance |
| HTTP-0466 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Tạo yêu cầu other |
| HTTP-0467 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 200/201 | Replay other không duplicate |
| HTTP-0468 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 409 | Key conflict other |
| HTTP-0469 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Other scheduled_visit hợp lệ |
| HTTP-0470 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Create thiếu idempotency |
| HTTP-0471 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Idempotency key biên |
| HTTP-0472 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Idempotency key biên |
| HTTP-0473 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 403 | Motorcycle owner khác |
| HTTP-0474 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 404 | Motorcycle không tồn tại |
| HTTP-0475 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 404 | Motorcycle archived |
| HTTP-0476 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | UUID sai |
| HTTP-0477 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Description dưới biên |
| HTTP-0478 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Description vượt biên |
| HTTP-0479 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Service type sai |
| HTTP-0480 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Emergency thiếu location |
| HTTP-0481 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Emergency không schedule |
| HTTP-0482 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Mobile thiếu location/address |
| HTTP-0483 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Mobile không schedule |
| HTTP-0484 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | At home thiếu schedule/address |
| HTTP-0485 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Maintenance không được quá khứ |
| HTTP-0486 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Other thiếu fulfillment_mode |
| HTTP-0487 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Non-other không có fulfillment_mode |
| HTTP-0488 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Coordinates ngoài biên |
| HTTP-0489 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 400/422 | Owner/status injection |
| HTTP-0490 | Service requests | rider1 | POST /api/v1/service-requests | HTTP 201 | Safety answers additionalProperties theo contract; audit phải sanitized |
| HTTP-0491 | Service requests | rider1 | GET /api/v1/service-requests | HTTP 200 | List chỉ request owner |
| HTTP-0492 | Service requests | rider1 | GET /api/v1/service-requests?limit=0 | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. | Request filter limit=0 |
| HTTP-0493 | Service requests | rider1 | GET /api/v1/service-requests?limit=101 | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. | Request filter limit=101 |
| HTTP-0494 | Service requests | rider1 | GET /api/v1/service-requests?cursor=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. | Request filter cursor=invalid |
| HTTP-0495 | Service requests | rider1 | GET /api/v1/service-requests?status=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. | Request filter status=invalid |
| HTTP-0496 | Service requests | rider1 | GET /api/v1/service-requests?service_type=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. | Request filter service_type=invalid |
| HTTP-0497 | Service requests | rider2 | GET /api/v1/service-requests/{{requestId}} | HTTP 403 | Foreign owner /read |
| HTTP-0498 | Service requests | rider2 | POST /api/v1/service-requests/{{requestId}}/media | HTTP 403 | Foreign owner /media |
| HTTP-0499 | Service requests | rider2 | POST /api/v1/service-requests/{{requestId}}/dispatch | HTTP 403 | Foreign owner /dispatch |
| HTTP-0500 | Service requests | rider2 | POST /api/v1/service-requests/{{requestId}}/cancel | HTTP 403 | Foreign owner /cancel |
| HTTP-0501 | Service requests | rider1 | GET /api/v1/service-requests/{{absent}} | HTTP 404 | Read nonexistent request |
| HTTP-0502 | Service requests | rider1 | POST /api/v1/service-requests/{{requestId}}/media | HTTP 201 | Media metadata tạo được |
| HTTP-0503 | Service requests | rider1 | POST /api/v1/service-requests/{{requestId}}/media | HTTP 400/422 | Media raw data không được nhận |
| HTTP-0504 | Service requests | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Concurrent cùng key chỉ tạo 1 request |
| HTTP-0505 | Service requests | rider1 | POST /api/v1/service-requests/{{at_home_service_request}}/cancel | HTTP 200 | Cancel trước dispatch |
| HTTP-0506 | Service requests | rider1 | POST /api/v1/service-requests/{{at_home_service_request}}/dispatch | HTTP 409 | Canceled không dispatch |
| HTTP-0507 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Làm mới location đúng API trước dispatch |
| HTTP-0508 | Dispatch | rider1 | POST /api/v1/service-requests/{{requestId}}/dispatch | HTTP 202 | Dispatch request có thợ eligible |
| HTTP-0509 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Offers riêng mỗi mechanic; pending không được offer |
| HTTP-0510 | Dispatch | mechanic2 | POST /api/v1/dispatch/offers/{{mechanic1_offer}}/accept | HTTP 403 | Không accept offer thuộc mechanic khác |
| HTTP-0511 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Hai thợ accept đồng thời chỉ một thắng |
| HTTP-0512 | Assignments | assigned | GET /api/v1/assignments | HTTP 200 | Owner sees accepted assignment |
| HTTP-0513 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 409 | Không skip accepted → on_site |
| HTTP-0514 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 409 | Không skip accepted → diagnosis |
| HTTP-0515 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 409 | Không skip accepted → in_progress |
| HTTP-0516 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 409 | Không skip accepted → completed |
| HTTP-0517 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 400/422 | Không skip accepted → invalid |
| HTTP-0518 | Assignments | rider1 | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 403 | Không đổi state khi không assigned (rider1) |
| HTTP-0519 | Assignments | rider2 | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 403 | Không đổi state khi không assigned (rider2) |
| HTTP-0520 | Assignments | unassigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 403 | Không đổi state khi không assigned (unassigned) |
| HTTP-0521 | Mechanic operations | unassigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 403/404 | Mechanic khác không ghi /eta |
| HTTP-0522 | Mechanic operations | unassigned | POST /api/v1/assignments/{{assignmentId}}/media | HTTP 403/404 | Mechanic khác không ghi /media |
| HTTP-0523 | Mechanic operations | unassigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 403/404 | Mechanic khác không ghi /completion-checklist |
| HTTP-0524 | Mechanic operations | unassigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 403/404 | Mechanic khác không ghi /diagnoses |
| HTTP-0525 | Mechanic operations | unassigned | POST /api/v1/assignments/{{assignmentId}}/recover | HTTP 403/404 | Mechanic khác không ghi /recover |
| HTTP-0526 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | /eta thiếu idempotency |
| HTTP-0527 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 201 | /eta tạo metadata |
| HTTP-0528 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 200/201 | /eta replay không duplicate |
| HTTP-0529 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 409 | /eta key khác payload conflict |
| HTTP-0530 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/media | HTTP 400/422 | /media thiếu idempotency |
| HTTP-0531 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/media | HTTP 201 | /media tạo metadata |
| HTTP-0532 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/media | HTTP 200/201 | /media replay không duplicate |
| HTTP-0533 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/media | HTTP 409 | /media key khác payload conflict |
| HTTP-0534 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 400/422 | /completion-checklist thiếu idempotency |
| HTTP-0535 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 201 | /completion-checklist tạo metadata |
| HTTP-0536 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 200/201 | /completion-checklist replay không duplicate |
| HTTP-0537 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 409 | /completion-checklist key khác payload conflict |
| HTTP-0538 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | ETA biên/schema |
| HTTP-0539 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | ETA biên/schema |
| HTTP-0540 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | ETA biên/schema |
| HTTP-0541 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | ETA biên/schema |
| HTTP-0542 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/eta | HTTP 400/422 | ETA biên/schema |
| HTTP-0543 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 400/422 | Checklist không bypass completion |
| HTTP-0544 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 400/422 | Checklist không bypass completion |
| HTTP-0545 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 400/422 | Checklist không bypass completion |
| HTTP-0546 | Mechanic operations | assigned | POST /api/v1/assignments/{{assignmentId}}/completion-checklist | HTTP 400/422 | Checklist không bypass completion |
| HTTP-0547 | Assignments | assigned | GET /api/v1/assignments | HTTP 200 | Metadata/checklist không tự complete |
| HTTP-0548 | Route ETA | rider1 | GET /api/v1/assignments/{{assignmentId}}/route-eta | HTTP 200 | Advisory ETA allowed rider1 |
| HTTP-0549 | Route ETA | assigned | GET /api/v1/assignments/{{assignmentId}}/route-eta | HTTP 200 | Advisory ETA allowed assigned |
| HTTP-0550 | Route ETA | admin | GET /api/v1/assignments/{{assignmentId}}/route-eta | HTTP 200 | Advisory ETA allowed admin |
| HTTP-0551 | Route ETA | rider2 | GET /api/v1/assignments/{{assignmentId}}/route-eta | HTTP 403 | ETA foreign rider2 |
| HTTP-0552 | Route ETA | unassigned | GET /api/v1/assignments/{{assignmentId}}/route-eta | HTTP 403 | ETA foreign unassigned |
| HTTP-0553 | Live tracking | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Disabled reject ingest có kiểm soát |
| HTTP-0554 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 200 | accepted → en_route |
| HTTP-0555 | Assignments | rider1 | GET /api/v1/service-requests/{{requestId}} | HTTP 200 | Request state đồng bộ mechanic_en_route |
| HTTP-0556 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 409 | en_route không quay accepted |
| HTTP-0557 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 200 | en_route → on_site |
| HTTP-0558 | Assignments | assigned | POST /api/v1/assignments/{{assignmentId}}/status | HTTP 200 | on_site → diagnosis |
| HTTP-0559 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 201 | Diagnosis tạo text tiếng Việt |
| HTTP-0560 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 201 | Diagnosis revision trước quote giữ một current diagnosis |
| HTTP-0561 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 400/422 | Diagnosis schema boundary/identity injection |
| HTTP-0562 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 400/422 | Diagnosis schema boundary/identity injection |
| HTTP-0563 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 400/422 | Diagnosis schema boundary/identity injection |
| HTTP-0564 | Diagnosis | assigned | POST /api/v1/assignments/{{assignmentId}}/diagnoses | HTTP 400/422 | Diagnosis schema boundary/identity injection |
| HTTP-0565 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0566 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0567 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0568 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0569 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0570 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 400/422 | Quote lines/money validation không nhận total client |
| HTTP-0571 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 201 | Tạo quote v1; tổng do backend tính |
| HTTP-0572 | Quotes | assigned | POST /api/v1/service-requests/{{requestId}}/quotes | HTTP 201 | Tạo quote v2 bất biến |
| HTTP-0573 | Quotes | rider1 | POST /api/v1/quotes/{{quoteV1}}/approve | HTTP 409 | Approve quote cũ bị chặn |
| HTTP-0574 | Quotes | rider2 | POST /api/v1/quotes/{{quoteId}}/approve | HTTP 403 | Không approve quote khi không owner rider2 |
| HTTP-0575 | Quotes | unassigned | POST /api/v1/quotes/{{quoteId}}/approve | HTTP 403 | Không approve quote khi không owner unassigned |
| HTTP-0576 | Quotes | rider1 | GET /api/v1/service-requests/{{requestId}}/quotes | HTTP 200 | Xem quote history rider1 |
| HTTP-0577 | Quotes | assigned | GET /api/v1/service-requests/{{requestId}}/quotes | HTTP 200 | Xem quote history assigned |
| HTTP-0578 | Quotes | admin | GET /api/v1/service-requests/{{requestId}}/quotes | HTTP 200 | Xem quote history admin |
| HTTP-0579 | Quotes | rider1 | POST /api/v1/quotes/{{quoteId}}/approve | HTTP 200 | Approve latest dừng awaiting_payment (không gọi payment API) |
| HTTP-0580 | Quotes | rider1 | GET /api/v1/service-requests/{{requestId}} | HTTP 200 | Request sau approve awaiting_payment |
| HTTP-0581 | Reviews | rider1 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 400/422 | Review rating invalid 0 |
| HTTP-0582 | Reviews | rider1 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 400/422 | Review rating invalid 6 |
| HTTP-0583 | Reviews | rider1 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 400/422 | Review rating invalid 1.5 |
| HTTP-0584 | Reviews | rider1 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 400/422 | Review rating invalid 5 |
| HTTP-0585 | Reviews | rider1 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 409 | Assignment chưa complete không được review |
| HTTP-0586 | Reviews | rider2 | POST /api/v1/assignments/{{assignmentId}}/review | HTTP 403/404 | Rider khác không review |
| HTTP-0587 | Reviews | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Completed review happy path cần fixture hợp lệ |
| HTTP-0588 | Recovery | assigned | POST /api/v1/assignments/{{assignmentId}}/recover | HTTP 409 | Không recovery sau quote approval |
| HTTP-0589 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Làm mới idle mechanic trước rescue dispatch |
| HTTP-0590 | Dispatch | rider1 | POST /api/v1/service-requests/{{rescueRequestId}}/dispatch | HTTP 202 | Dispatch rescue cho mechanic còn idle |
| HTTP-0591 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Busy mechanic bị loại, idle mechanic accept rescue |
| HTTP-0592 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 409 | Rescue chưa duyệt labor không được đi |
| HTTP-0593 | Rescue | unassigned | POST /api/v1/service-requests/{{rescueRequestId}}/quotes | HTTP 201 | Báo labor trước khi đi |
| HTTP-0594 | Rescue | rider1 | POST /api/v1/quotes/{{laborQuoteId}}/approve | HTTP 200 | Approve labor after_repair (chỉ workflow) |
| HTTP-0595 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 200 | Rescue travel → en_route |
| HTTP-0596 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 200 | Rescue travel → on_site |
| HTTP-0597 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 200 | Rescue travel → diagnosis |
| HTTP-0598 | Rescue | unassigned | POST /api/v1/service-requests/{{rescueRequestId}}/quotes | HTTP 409 | Labor đã duyệt không sửa lại |
| HTTP-0599 | Rescue | unassigned | POST /api/v1/service-requests/{{rescueRequestId}}/quotes | HTTP 400/422 | Final quote chỉ được parts |
| HTTP-0600 | Rescue | unassigned | POST /api/v1/service-requests/{{rescueRequestId}}/quotes | HTTP 201 | Final quote cộng labor cố định |
| HTTP-0601 | Rescue | rider1 | POST /api/v1/quotes/{{finalQuoteId}}/reject | HTTP 200 | Reject parts không được bắt đầu sửa |
| HTTP-0602 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 409 | Rejected final không in_progress |
| HTTP-0603 | Rescue | unassigned | POST /api/v1/service-requests/{{rescueRequestId}}/quotes | HTTP 201 | Báo parts revision |
| HTTP-0604 | Rescue | rider1 | POST /api/v1/quotes/{{finalQuoteId}}/approve | HTTP 200 | Approve parts quay diagnosis |
| HTTP-0605 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 200 | Bắt đầu sửa sau duyệt parts |
| HTTP-0606 | Rescue | unassigned | POST /api/v1/assignments/{{rescueAssignmentId}}/status | HTTP 200 | Sửa xong tới awaiting_payment, dừng trước payment |
| HTTP-0607 | Recovery | admin | POST /api/v1/admin/mechanics/{{workflow_id}}/approve | HTTP 200 | Approve mechanic dùng riêng cho recovery/cancel/recall |
| HTTP-0608 | Recovery | workflow | PATCH /api/v1/mechanics/me/profile | HTTP 200 | Cấu hình mechanic workflow |
| HTTP-0609 | Recovery | workflow | PUT /api/v1/mechanics/me/availability | HTTP 200 | Mechanic workflow available |
| HTTP-0610 | Dispatch | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Decline offer, không còn accept được và không assignment |
| HTTP-0611 | Cancellation | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | rider1 cancel offered đóng mọi offer |
| HTTP-0612 | Cancellation | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | admin cancel offered đóng mọi offer |
| HTTP-0613 | Recovery | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Pre-quote recovery/replay/conflict và release mechanic |
| HTTP-0614 | Cancellation | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Cancel vs accept race không có canceled request chứa active assignment |
| HTTP-0615 | Rescue recall | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Reject labor giải phóng assignment, rider recall đúng mechanic |
| HTTP-0616 | Reminders | rider1 | POST /api/v1/reminders | HTTP 201 | Tạo reminder date/time |
| HTTP-0617 | Reminders | rider1 | GET /api/v1/reminders | HTTP 200 | List chỉ reminder owner |
| HTTP-0618 | Reminders | rider1 | POST /api/v1/reminders | HTTP 403 | Reminder ownership/boundary/no kilometre |
| HTTP-0619 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0620 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0621 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0622 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0623 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0624 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0625 | Reminders | rider1 | POST /api/v1/reminders | HTTP 400/422 | Reminder ownership/boundary/no kilometre |
| HTTP-0626 | Reminders | rider2 | PATCH /api/v1/reminders/{{reminderId}} | HTTP 403 | Rider khác không sửa/snooze reminder |
| HTTP-0627 | Reminders | rider2 | POST /api/v1/reminders/{{reminderId}}/snooze | HTTP 403 | Rider khác không sửa/snooze reminder |
| HTTP-0628 | Reminders | rider1 | POST /api/v1/reminders/{{reminderId}}/snooze | HTTP 200 | Snooze future |
| HTTP-0629 | Reminders | rider1 | POST /api/v1/reminders/{{reminderId}}/snooze | HTTP 400/422 | Snooze past bị chặn |
| HTTP-0630 | Reminders | rider1 | PATCH /api/v1/reminders/{{reminderId}} | HTTP 200 | Disable reminder |
| HTTP-0631 | Notifications | rider1 | GET /api/v1/notifications?limit=2 | HTTP 200 | Inbox rider1 |
| HTTP-0632 | Notifications | rider1 | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count rider1 |
| HTTP-0633 | Notifications | rider2 | GET /api/v1/notifications?limit=2 | HTTP 200 | Inbox rider2 |
| HTTP-0634 | Notifications | rider2 | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count rider2 |
| HTTP-0635 | Notifications | mechanic1 | GET /api/v1/notifications?limit=2 | HTTP 200 | Inbox mechanic1 |
| HTTP-0636 | Notifications | mechanic1 | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count mechanic1 |
| HTTP-0637 | Notifications | mechanic2 | GET /api/v1/notifications?limit=2 | HTTP 200 | Inbox mechanic2 |
| HTTP-0638 | Notifications | mechanic2 | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count mechanic2 |
| HTTP-0639 | Notifications | admin | GET /api/v1/notifications?limit=2 | HTTP 200 | Inbox admin |
| HTTP-0640 | Notifications | admin | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count admin |
| HTTP-0641 | Notifications | rider1 | GET /api/v1/notifications?limit=0 | HTTP 400/422 | Inbox invalid filter limit=0 |
| HTTP-0642 | Notifications | rider1 | GET /api/v1/notifications?limit=101 | HTTP 400/422 | Inbox invalid filter limit=101 |
| HTTP-0643 | Notifications | rider1 | GET /api/v1/notifications?limit=abc | HTTP 400/422 | Inbox invalid filter limit=abc |
| HTTP-0644 | Notifications | rider1 | GET /api/v1/notifications?cursor=invalid | HTTP 400/422 | Inbox invalid filter cursor=invalid |
| HTTP-0645 | Notifications | rider1 | GET /api/v1/notifications?unread_only=wrong | HTTP 400/422 | Inbox invalid filter unread_only=wrong |
| HTTP-0646 | Notifications | rider2 | POST /api/v1/notifications/{{notificationId}}/read | HTTP 404 | Mark foreign notification không tiết lộ |
| HTTP-0647 | Notifications | rider1 | POST /api/v1/notifications/{{absent}}/read | HTTP 404 | Mark nonexistent notification |
| HTTP-0648 | Notifications | rider1 | POST /api/v1/notifications/{{notificationId}}/read | HTTP 200 | Mark read owner |
| HTTP-0649 | Notifications | rider1 | POST /api/v1/notifications/{{notificationId}}/read | HTTP 200 | Mark read replay giữ timestamp |
| HTTP-0650 | Notifications | rider1 | POST /api/v1/notifications/read-all | HTTP 200 | Mark read all owner |
| HTTP-0651 | Notifications | rider1 | GET /api/v1/notifications/unread-count | HTTP 200 | Unread count sau mark all = 0 |
| HTTP-0652 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0653 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0654 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0655 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0656 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0657 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 400/422 | Signed intent schema/type/path injection |
| HTTP-0658 | Media uploads | rider2 | POST /api/v1/media/upload-intents | HTTP 404 | Intent resource foreign bị 404 |
| HTTP-0659 | Media uploads | rider1 | POST /api/v1/media/upload-intents | HTTP 404 | Intent nonexistent resource bị 404 |
| HTTP-0660 | Media uploads | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Signed upload → finalize → replay |
| HTTP-0661 | Admin users | admin | GET /api/v1/admin/users | HTTP 200 | Admin read /api/v1/admin/users |
| HTTP-0662 | Admin users | admin | GET /api/v1/admin/users/{{userId}} | HTTP 200 | Admin read /api/v1/admin/users/{{userId}} |
| HTTP-0663 | Admin users | admin | GET /api/v1/admin/users/{{userId}}/devices | HTTP 200 | Admin read /api/v1/admin/users/{{userId}}/devices |
| HTTP-0664 | Admin users | admin | GET /api/v1/admin/users/{{userId}}/activity | HTTP 200 | Admin read /api/v1/admin/users/{{userId}}/activity |
| HTTP-0665 | Admin mechanics | admin | GET /api/v1/admin/mechanics | HTTP 200 | Admin read /api/v1/admin/mechanics |
| HTTP-0666 | Admin mechanics | admin | GET /api/v1/admin/mechanics/{{mechanicId}} | HTTP 200 | Admin read /api/v1/admin/mechanics/{{mechanicId}} |
| HTTP-0667 | Admin mechanics | admin | GET /api/v1/admin/mechanics/{{mechanicId}}/work-history | HTTP 200 | Admin read /api/v1/admin/mechanics/{{mechanicId}}/work-history |
| HTTP-0668 | Admin mechanics | admin | GET /api/v1/admin/mechanics/{{mechanicId}}/performance | HTTP 200 | Admin read /api/v1/admin/mechanics/{{mechanicId}}/performance |
| HTTP-0669 | Admin requests | admin | GET /api/v1/admin/service-requests | HTTP 200 | Admin read /api/v1/admin/service-requests |
| HTTP-0670 | Admin requests | admin | GET /api/v1/admin/service-requests/{{requestId}} | HTTP 200 | Admin read /api/v1/admin/service-requests/{{requestId}} |
| HTTP-0671 | Admin requests | admin | GET /api/v1/admin/service-requests/{{requestId}}/timeline | HTTP 200 | Admin read /api/v1/admin/service-requests/{{requestId}}/timeline |
| HTTP-0672 | Admin requests | admin | GET /api/v1/admin/service-requests/{{requestId}}/media | HTTP 200 | Admin read /api/v1/admin/service-requests/{{requestId}}/media |
| HTTP-0673 | Admin requests | admin | GET /api/v1/admin/service-requests/{{requestId}}/assignment | HTTP 200 | Admin read /api/v1/admin/service-requests/{{requestId}}/assignment |
| HTTP-0674 | Admin requests | admin | GET /api/v1/admin/service-requests/{{requestId}}/quotes | HTTP 200 | Admin read /api/v1/admin/service-requests/{{requestId}}/quotes |
| HTTP-0675 | Operations | admin | GET /api/v1/admin/operations/outbox-dead-letters | HTTP 200 | Admin read /api/v1/admin/operations/outbox-dead-letters |
| HTTP-0676 | Operations | admin | GET /api/v1/admin/operations/dispatch-stuck | HTTP 200 | Admin read /api/v1/admin/operations/dispatch-stuck |
| HTTP-0677 | Operations | admin | GET /api/v1/admin/operations/worker-runs | HTTP 200 | Admin read /api/v1/admin/operations/worker-runs |
| HTTP-0678 | Operations | admin | GET /api/v1/admin/users?limit=0 | HTTP 400/422 | Admin filter /api/v1/admin/users?limit=0 |
| HTTP-0679 | Operations | admin | GET /api/v1/admin/users?limit=101 | HTTP 400/422 | Admin filter /api/v1/admin/users?limit=101 |
| HTTP-0680 | Operations | admin | GET /api/v1/admin/users?cursor=invalid | HTTP 400/422 | Admin filter /api/v1/admin/users?cursor=invalid |
| HTTP-0681 | Operations | admin | GET /api/v1/admin/mechanics?limit=0 | HTTP 400/422 | Admin filter /api/v1/admin/mechanics?limit=0 |
| HTTP-0682 | Operations | admin | GET /api/v1/admin/mechanics?limit=101 | HTTP 400/422 | Admin filter /api/v1/admin/mechanics?limit=101 |
| HTTP-0683 | Operations | admin | GET /api/v1/admin/mechanics?cursor=invalid | HTTP 400/422 | Admin filter /api/v1/admin/mechanics?cursor=invalid |
| HTTP-0684 | Operations | admin | GET /api/v1/admin/service-requests?limit=0 | HTTP 400/422 | Admin filter /api/v1/admin/service-requests?limit=0 |
| HTTP-0685 | Operations | admin | GET /api/v1/admin/service-requests?limit=101 | HTTP 400/422 | Admin filter /api/v1/admin/service-requests?limit=101 |
| HTTP-0686 | Operations | admin | GET /api/v1/admin/service-requests?cursor=invalid | HTTP 400/422 | Admin filter /api/v1/admin/service-requests?cursor=invalid |
| HTTP-0687 | Operations | admin | GET /api/v1/admin/operations/worker-runs?limit=0 | HTTP 400/422 | Admin filter /api/v1/admin/operations/worker-runs?limit=0 |
| HTTP-0688 | Operations | admin | GET /api/v1/admin/operations/worker-runs?limit=101 | HTTP 400/422 | Admin filter /api/v1/admin/operations/worker-runs?limit=101 |
| HTTP-0689 | Operations | admin | GET /api/v1/admin/operations/worker-runs?cursor=invalid | HTTP 400/422 | Admin filter /api/v1/admin/operations/worker-runs?cursor=invalid |
| HTTP-0690 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 400/422 | Admin reason required và bounds |
| HTTP-0691 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 400/422 | Admin reason required và bounds |
| HTTP-0692 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 400/422 | Admin reason required và bounds |
| HTTP-0693 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 200 | Suspend rider2 riêng |
| HTTP-0694 | Admin users | rider2 | GET /api/v1/motorcycles | HTTP 403 | Suspended user bị chặn |
| HTTP-0695 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 200 | Suspend replay không tạo event trùng |
| HTTP-0696 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/suspend | HTTP 409 | Suspend same key body khác conflict |
| HTTP-0697 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/reactivate | HTTP 200 | Reactivate rider2 |
| HTTP-0698 | Admin users | rider2 | GET /api/v1/motorcycles | HTTP 200 | Reactivated user dùng API lại |
| HTTP-0699 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/roles/grant | HTTP 200 | Grant role cho fixture rider2 |
| HTTP-0700 | Admin users | admin | POST /api/v1/admin/users/{{rider2_id}}/roles/revoke | HTTP 200 | Revoke role fixture rider2 |
| HTTP-0701 | Admin users | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Không revoke last admin chỉ khi fixture thực sự là admin cuối |
| HTTP-0702 | Admin users | admin | POST /api/v1/admin/devices/{{deviceId}}/revoke | HTTP 200 | Admin revoke device fixture |
| HTTP-0703 | Admin requests | admin | POST /api/v1/admin/service-requests/{{requestId}}/notes | HTTP 201 | Admin add internal note |
| HTTP-0704 | Admin requests | admin | POST /api/v1/admin/service-requests/{{other_request}}/manual-escalate | HTTP 200 | Manual escalate request chưa dispatch |
| HTTP-0705 | Admin requests | admin | POST /api/v1/admin/service-requests/{{periodic_maintenance_request}}/cancel | HTTP 200 | Admin cancel request chưa assign |
| HTTP-0706 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/skills | HTTP 400/422 | Admin skills schema |
| HTTP-0707 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/skills | HTTP 400/422 | Admin skills schema |
| HTTP-0708 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/skills | HTTP 200 | Admin update pending mechanic skills |
| HTTP-0709 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/service-radius | HTTP 200 | Admin update radius |
| HTTP-0710 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/service-radius | HTTP 400/422 | Admin radius biên |
| HTTP-0711 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/service-radius | HTTP 400/422 | Admin radius biên |
| HTTP-0712 | Admin mechanics | admin | PUT /api/v1/admin/mechanics/{{pending_id}}/service-radius | HTTP 400/422 | Admin radius biên |
| HTTP-0713 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{pending_id}}/reject | HTTP 200 | Reject pending mechanic riêng |
| HTTP-0714 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{fresh_id}}/approve | HTTP 200 | Approve fresh mechanic riêng |
| HTTP-0715 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{fresh_id}}/suspend | HTTP 200 | Fresh fixture lifecycle suspend (200) |
| HTTP-0716 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{fresh_id}}/reactivate | HTTP 200 | Fresh fixture lifecycle reactivate (200) |
| HTTP-0717 | Admin mechanics | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Force available mechanic unavailable |
| HTTP-0718 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{fresh_id}}/ban | HTTP 200 | Fresh fixture lifecycle ban (200) |
| HTTP-0719 | Admin mechanics | admin | POST /api/v1/admin/mechanics/{{fresh_id}}/reactivate | HTTP 409 | Fresh fixture lifecycle reactivate (409) |
| HTTP-0720 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Retention dry-run: không xóa dữ liệu |
| HTTP-0721 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /reminders/run cần project cô lập |
| HTTP-0722 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /dispatch/run cần project cô lập |
| HTTP-0723 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /outbox/run cần project cô lập |
| HTTP-0724 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /media-uploads/cleanup cần project cô lập |
| HTTP-0725 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /reviews/rebuild-ratings cần project cô lập |
| HTTP-0726 | Workers | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Worker authorized /live-locations/cleanup cần project cô lập |
| HTTP-0727 | Chatbot | anonymous | POST /api/chatbot/sessions | HTTP 200 | Tạo anonymous session cookie owner |
| HTTP-0728 | Chatbot | anonymous | GET /api/chatbot/sessions/{{sessionId}}/diagnosis | HTTP 404 | Session ownership không có credential bị 404 |
| HTTP-0729 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 404 | Session ownership sai token bị 404 |
| HTTP-0730 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 400 | Messages schema/empty text |
| HTTP-0731 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 400 | Messages schema/empty text |
| HTTP-0732 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 400 | Messages schema/empty text |
| HTTP-0733 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 400 | Messages schema/empty text |
| HTTP-0734 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 400 | Messages schema/empty text |
| HTTP-0735 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe khó đề và đèn yếu |
| HTTP-0736 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe chạy kêu lạ chưa rõ vị trí |
| HTTP-0737 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe bị mất phanh |
| HTTP-0738 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe rò xăng và có mùi xăng |
| HTTP-0739 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe bị đảo tay lái khi chạy |
| HTTP-0740 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe có khói và mùi khét |
| HTTP-0741 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/messages | HTTP 200 | Diagnosis: Xe đang chạy thì chết máy |
| HTTP-0742 | Chatbot | anonymous | GET /api/chatbot/sessions/{{sessionId}}/diagnosis | HTTP 200 | Restore diagnosis đúng latest |
| HTTP-0743 | Chatbot | anonymous | POST /api/chatbot/sessions/{{sessionId}}/claim | HTTP 404 | Claim thiếu bearer bị từ chối không lộ session |
| HTTP-0744 | Chatbot | rider1 | POST /api/chatbot/sessions/{{sessionId}}/claim | HTTP 404 | Claim có JWT nhưng thiếu cookie bị 404 |
| HTTP-0745 | Chatbot | rider1 | POST /api/chatbot/sessions/{{sessionId}}/claim | HTTP 200 | Claim với đủ JWT và cookie |
| HTTP-0746 | Chatbot | rider1 | GET /api/chatbot/sessions/{{sessionId}}/diagnosis | HTTP 200 | Sau claim owner JWT restore |
| HTTP-0747 | Chatbot | rider2 | GET /api/chatbot/sessions/{{sessionId}}/diagnosis | HTTP 404 | Sau claim rider khác không restore |
| HTTP-0748 | Chatbot | anonymous | GET /api/chatbot/sessions/{{sessionId}}/diagnosis | HTTP 404 | Anonymous cookie cũ không còn quyền sau claim |
| HTTP-0749 | ASR | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Reject multipart thiếu file/sai WAV |
| HTTP-0750 | ASR | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | WAV thật → transcription → text diagnosis |
| HTTP-0751 | Chatbot | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Rate limit valid text tối đa 10/hour theo task T006 |
| HTTP-0752 | RLS | workflow | Nhiều request trong cases.mjs | Các bước đúng hợp đồng; không bypass state/ownership | Supabase REST chỉ thấy motorcycle owner bằng user JWT |

## Tiền điều kiện bổ sung

- **INF-01 Google login thật/callback/refresh/logout và JWT Google**: Provider Google; API nhận JWT Supabase, chọn role đúng, chống replay code/state. Cần: Google bật trên Supabase, callback allowlist, tài khoản Google test có tương tác; API_TEST_GOOGLE_ACCESS_TOKEN và tùy chọn refresh token.
- **INF-02 Google huỷ consent, state thiếu/sai, code dùng lại, callback không allowlist**: Không cấp session/không nâng quyền/không open redirect. Cần: OAuth browser với PKCE và callback của client thực; không thay bằng password login.
- **INF-03 ASR WAV giọng Việt → transcription → diagnosis**: Chép nội dung đúng; không tự diagnosis ở transcription; không lộ audio. Cần: Models ONNX và API_TEST_WAV_PATH WAV đã biết transcript; API_TEST_WAV_EXPECTED_TEXT.
- **INF-04 FCM success/invalid token/timeout/retry/deduplication**: Inbox tồn tại độc lập delivery; đúng retry/dead-letter; không gửi lặp. Cần: FCM test credentials/device và database/worker cô lập; không gửi tới device thật.
- **INF-05 Workers reminder/dispatch/outbox cạnh tranh lease, crash, lease recovery**: Một consumer, không duplicate; rollback không residue; round hết hạn mới advance. Cần: Project riêng và API_TEST_ALLOW_GLOBAL_WORKERS=true; kiểm soát thời gian/lease hoặc hai worker process.
- **INF-06 Tracking enabled, replay/throttle/expiry/travel-state deletion**: Latest-only, ownership và timestamp/accuracy đúng; deletion khi hết hạn/đổi state. Cần: LIVE_TRACKING_ENABLED=true + retention rõ ràng; không bật thay user trong lần chạy.
- **INF-07 Google Routes lỗi quota/timeout/invalid/no route/cache expiry**: Fallback có nhãn, không thay state, không rò provider key. Cần: Provider test/proxy chủ động gây lỗi; API test không gọi dịch vụ Maps trả phí.
- **INF-08 Restart server, PostgreSQL chatbot persistence/shared limiter cross-instance**: Session/diagnosis restore, circuit và limit giữa hai instance đúng. Cần: Hai instance + controlled restart + shared-runtime config; tránh thay env app ngoài run.
- **INF-09 Retention execution, expiry orphan, audit append-only/RLS write attack**: Chỉ policy explicit xóa, bounded batch; audit update/delete bị cấm; user không ghi chéo. Cần: Database disposable riêng được xác nhận; TEST_DATABASE_URL hiện trùng DB ứng dụng nên không reset/mutation audit thử.
- **INF-10 Completed assignment review success/duplicate/rating aggregate**: Một review bất biến từ owner; average/count đúng; concurrent duplicate bị chặn. Cần: Assignment completed đã có hợp lệ; workflow không thể completed qua payment đang ngoài scope.
- **INF-11 Standard repair complete workflow sau awaiting_payment**: State đồng bộ, completion đúng, rider thấy lịch sử. Cần: Fixture completed hợp lệ hoặc mở phạm vi payment; không giả thanh toán bằng SQL.
- **INF-12 Stale location, expired offers/quote, 64-round cap, active workload ranking**: Không dispatch thợ không eligible, không accept offer expired, không approve expired/stale. Cần: Controlled time/fixtures disposable; không backdate DB ứng dụng.
- **INF-13 Malformed media MIME/signature, size/hash mismatch, orphan cleanup**: Finalize fail, không tạo media; replay không duplicate. Cần: Storage bucket test hoạt động và đối tượng test riêng; chỉ signed URL thuộc fixture.
