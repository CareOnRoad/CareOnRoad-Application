# API and Runtime Checklist

- [x] Existing error codes and rate-limit headers remain unchanged
- [x] Memory remains default and shared mode is explicit
- [x] Shared failures have bounded local fallback
- [x] Persistent keys are purpose-scoped hashes
- [x] No public or worker API is added
- [x] Safety, ASR, provider chain, and local diagnosis fallback are preserved
