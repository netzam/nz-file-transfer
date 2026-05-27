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
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_SA_KEY`
- `GAR_LOCATION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE`

Workflow: `.github/workflows/deploy.yml`
