# HTTP Contract

- `POST /api/chatbot/sessions`: unchanged JSON `{session_id}` plus `Set-Cookie: careonroad_chat_owner=...; HttpOnly; SameSite=Lax; Path=/api/chatbot/sessions/{id}`.
- Session endpoints accept cookie or `X-Chatbot-Session-Token`; a claimed owner may use `Authorization: Bearer ...`.
- Unauthorized/missing/wrong ownership returns `404 NOT_FOUND`.
- `POST /api/chatbot/sessions/{id}/claim`: requires bearer authentication and anonymous ownership credential; returns `{session_id, owner_user_id, claimed:true}`.
