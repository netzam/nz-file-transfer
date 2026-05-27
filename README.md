# NZ File Transfer

AirDrop-for-browsers PWA for local network peer-to-peer file transfer between Windows and iOS devices.

## Stack
- Frontend: React + TypeScript + Vite + PWA
- Backend: Node.js + TypeScript + WebSocket (`/signal`)
- Transfer: WebRTC DataChannel (binary chunks + bufferedAmount backpressure)
- Deploy: Docker + Google Cloud Run

## Features
- Auto discovery in room
- Friendly device names
- QR pairing + room code join
- Device cards with status
- Multi-file transfer
- Chunking with backpressure
- Progress %, speed, ETA
- Reconnect logic for WebSocket
- PWA installable + offline shell
- No server-side file storage

## Endpoints
- `GET /`
- `GET /health`
- `WS /signal`

## Local Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy
Yes — Dockerfile-first is the best fit for your case.

### Option A (recommended): Cloud Run connected to GitHub repo directly
Use Cloud Build trigger + this repo's `Dockerfile` (no GitHub Actions needed).

1. In GCP Console: **Cloud Build → Triggers → Create Trigger**
2. Connect GitHub repo: `netzam/nz-file-transfer`
3. Event: push to `main`
4. Build config: `Dockerfile` (or `cloudbuild.yaml`)
5. Deploy target: Cloud Run service `nz-file-transfer`
6. Region: `asia-southeast1`, Project: `netzam-wifi`

This gives automatic deploy on every push to `main`, with Cloud Run building from Dockerfile via Cloud Build.

### Option B: CLI source deploy using Dockerfile
```bash
gcloud run deploy nz-file-transfer \
  --source . \
  --region asia-southeast1 \
  --project netzam-wifi \
  --allow-unauthenticated
```

If `Dockerfile` exists, Cloud Build uses it for the image build.

### Notes
- Current repo already has a production Dockerfile.
- Existing `cloudbuild.yaml` is compatible with Docker-based deploy flow.
- GitHub Actions workflow template remains optional at `docs/templates/deploy.workflow.yml`.
