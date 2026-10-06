# Address thread Insights

Status: resolved
Type: task
Spec: [spec.md](../spec.md)

## Answer

Independent review of the thread's auth/UI Insights found three actionable areas. Credential failures now share the canonical 401 envelope, while a refused Better Auth session returns 503 on both sign-in paths. Recovery tests hold the account lookup itself and prove the generic response arrives before it completes. Bottom and right sheets use a fade under reduced motion with sufficient selector specificity.

## Comments

- 2026-10-06: Integrated tip `7e39f0b` into `feat/auth-one-form-resume`. The stale sweep branch's Horizon regression was restored. Independent 6.1 Sol review approved the final seven-file diff; 40 focused API tests, API types and the integrated 544-test API suite pass. The sheet behavior remains part of the full browser gate. No additional actionable pattern was found in that sweep.
