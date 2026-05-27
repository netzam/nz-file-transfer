# Manual Test Checklist

## Pairing
- [ ] Create room from Windows browser
- [ ] Join with iPhone via room code
- [ ] Join with iPhone via QR link
- [ ] Device list shows both devices

## Transfer
- [ ] Send single small file
- [ ] Send multiple files
- [ ] Send large file (>500MB)
- [ ] Verify progress/speed/ETA update
- [ ] Cancel transfer mid-way (to be implemented next iteration)

## Realtime
- [ ] Refresh one device and verify reconnect
- [ ] Rejoin room after disconnect
- [ ] Verify stale rooms expire

## PWA
- [ ] Install on iOS home screen
- [ ] Install on Windows browser
- [ ] App shell loads offline

## Security/Infra
- [ ] Backend health endpoint returns 200
- [ ] Cloud Run over HTTPS
- [ ] No server-side file artifacts
