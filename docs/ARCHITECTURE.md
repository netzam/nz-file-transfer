# Architecture

## Data Flow
1. Devices connect to `/signal` WebSocket.
2. Device A creates room code, Device B joins via room code or QR.
3. Signalling exchanged over WebSocket (offer/answer/ICE/presence).
4. Browser peers establish direct WebRTC DataChannel.
5. Files chunked (default 128KB) and sent P2P.

## Security and Ops
- HTTPS/WSS only in production
- Server stores no file payloads
- Room TTL cleanup
- Basic per-connection controls
- Cloud Run backend scales signalling only

## Compatibility
- iOS Safari + Windows Chrome/Edge
- STUN enabled, TURN optional via RTCPeerConnection config
