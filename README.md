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
Push to `main` with required GitHub Secrets:
- `GCP_PROJECT_ID` (same as ai-chatbot: `netzam-wifi`)
- `GCP_REGION` (same as ai-chatbot: `asia-southeast1`)
- `GCP_SA_KEY`
- `GAR_LOCATION` (same as ai-chatbot: `asia-southeast1`)
- `GAR_REPOSITORY` (same baseline repo family as ai-chatbot)
- `CLOUD_RUN_SERVICE` (`nz-file-transfer`)

Workflow template: `docs/templates/deploy.workflow.yml`

> Note: this environment's current GitHub token cannot commit `.github/workflows/*` without `workflow` scope. After updating token scope, move template to `.github/workflows/deploy.yml`.
