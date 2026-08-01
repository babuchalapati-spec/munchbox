# media-service

Owns file uploads — shop/product images, KYC documents, APKs. Stateless and
horizontally scalable independently of business logic; the natural candidate to move
from local disk to S3/Cloudinary later without any other service noticing.

## Owns

Uploaded files (currently on local disk under `backend/downloads` and
`backend/uploads`; target state is object storage, referenced by URL only).

## Depends on

Nothing — leaf service.

## Migrated from (monolith source)

`backend/src/routes/uploadRoutes.js`, `backend/src/middleware/upload.js`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/media/uploads` | Upload an image/PDF/APK | JWT |
| POST | `/media/uploads/public` | Upload without auth (e.g. pre-signup KYC) | public, rate-limited |

Returns a stable URL other services store as a string field (`imageUrl`, `aadhaarUrl`,
etc.) — no other service needs to know whether that URL points at local disk or S3.

## Not yet implemented

Bootable skeleton only (`GET /health`) — recommended alongside notification-service as
an early, low-risk split (ARCHITECTURE.md §6, Phase 3).
