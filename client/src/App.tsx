import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSignal } from './hooks/useSignal';
import { defaultDeviceName, getSavedDeviceName, saveDeviceName } from './lib/device';
import { useAppStore } from './store/appStore';

function PhotoPreview({ file, alt }: { file: File; alt: string }) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  return <img src={objectUrl} alt={alt} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6 }} />;
}

function photoKey(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export default function App() {
  const store = useAppStore();
  const [joinCode, setJoinCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('-');
  const [eta, setEta] = useState('-');
  const [tab, setTab] = useState<'home'|'history'|'settings'>('home');
  const [transferError, setTransferError] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [photoPool, setPhotoPool] = useState<File[]>([]);
  const [selectedPhotoKeys, setSelectedPhotoKeys] = useState<Set<string>>(new Set());

  const signal = useSignal();

  useEffect(() => {
    if (!store.deviceName) {
      const name = getSavedDeviceName() || defaultDeviceName();
      store.setState({ deviceName: name });
    }
  }, [store]);

  const onNameSave = (value: string) => {
    saveDeviceName(value);
    store.setState({ deviceName: value });
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setTransferError('');
    try {
      const sentCount = await signal.sendFiles(e.target.files, (p, s, t) => {
        setProgress(p);
        setSpeed(s);
        setEta(t);
      });
      store.setState({ transferHistory: [`${new Date().toLocaleString()} Sent ${sentCount} file(s)`, ...store.transferHistory] });
    } catch (error) {
      setTransferError((error as Error).message || 'Transfer failed');
    }

    e.target.value = '';
  };

  const onPhotoPoolLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const images = files.filter((file) => file.type.startsWith('image/'));
    setPhotoPool(images);

    const allKeys = new Set(images.map((file, index) => photoKey(file, index)));
    setSelectedPhotoKeys(allKeys);

    e.target.value = '';
  };

  const togglePhoto = (key: string) => {
    setSelectedPhotoKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllPhotos = () => {
    setSelectedPhotoKeys(new Set(photoPool.map((file, index) => photoKey(file, index))));
  };

  const clearPhotoSelection = () => {
    setSelectedPhotoKeys(new Set());
  };

  const selectedPhotos = useMemo(
    () => photoPool.filter((file, index) => selectedPhotoKeys.has(photoKey(file, index))),
    [photoPool, selectedPhotoKeys],
  );

  const sendSelectedPhotos = async () => {
    if (selectedPhotos.length === 0) return;

    setTransferError('');
    try {
      const sentCount = await signal.sendFiles(selectedPhotos, (p, s, t) => {
        setProgress(p);
        setSpeed(s);
        setEta(t);
      });
      store.setState({ transferHistory: [`${new Date().toLocaleString()} Sent ${sentCount} photo(s)`, ...store.transferHistory] });
    } catch (error) {
      setTransferError((error as Error).message || 'Transfer failed');
    }
  };

  const roleLabel = signal.transferRole === 'sender'
    ? 'Sender'
    : signal.transferRole === 'recipient'
      ? 'Recipient'
      : 'Not connected';

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 20, color: '#e5e7eb', fontFamily: 'Inter, sans-serif', background: '#0b1220', minHeight: '100vh' }}>
      <h1>NZ File Transfer</h1>
      <p>AirDrop for browsers: local peer-to-peer transfers via WebRTC.</p>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setTab('home')}>Home</button>
        <button onClick={() => setTab('history')}>History</button>
        <button onClick={() => setTab('settings')}>Settings</button>
      </div>

      {tab === 'home' && (
        <>
          <section>
            <h2>Pairing</h2>
            <button onClick={signal.createRoom}>Create Room</button>
            <input placeholder="Enter room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <button onClick={() => signal.joinRoom(joinCode)}>Join</button>
            <p>Room code: <b>{store.roomCode || '-'}</b></p>
            {store.roomCode ? <QRCodeSVG value={`${location.origin}?room=${store.roomCode}`} /> : null}
          </section>

          <section>
            <h2>Nearby Devices</h2>
            <p><b>This device:</b> {store.deviceName || 'Unnamed device'} {store.deviceId ? `(${store.deviceId.slice(0, 8)})` : ''}</p>
            <p><b>Role:</b> {roleLabel}</p>
            {signal.counterpartyName ? <p><b>Connected with:</b> {signal.counterpartyName}</p> : null}
            {signal.transferRole !== 'idle' && signal.counterpartyName ? (
              <p>
                <b>Transfer path:</b>{' '}
                {signal.transferRole === 'sender'
                  ? `${store.deviceName || 'This device'} → ${signal.counterpartyName}`
                  : `${signal.counterpartyName} → ${store.deviceName || 'This device'}`}
              </p>
            ) : null}
            <p>Connection state: <b>{signal.connected ? 'Connected' : 'Not connected'}</b></p>
            {store.peers.length === 0 ? <p>No other devices in room yet.</p> : null}
            {store.peers.map((p) => (
              <div key={p.deviceId} style={{ border: '1px solid #334155', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div><b>{p.deviceName}</b></div>
                <div>{p.userAgent}</div>
                <div>Status: {p.status}</div>
                <button onClick={() => signal.connectToPeer(p.deviceId)}>Send to this device</button>
              </div>
            ))}
          </section>

          <section>
            <h2>Transfer</h2>
            <input type="file" multiple onChange={onFiles} />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={onPhotoPoolLoad}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => imageInputRef.current?.click()}>Load Photos</button>
              <button onClick={selectAllPhotos} disabled={photoPool.length === 0}>Select All</button>
              <button onClick={clearPhotoSelection} disabled={photoPool.length === 0}>Clear Selection</button>
              <button onClick={sendSelectedPhotos} disabled={selectedPhotos.length === 0}>Send Selected Photos</button>
            </div>
            <p style={{ marginTop: 6, opacity: 0.9 }}>
              Photos loaded: <b>{photoPool.length}</b> | Selected: <b>{selectedPhotos.length}</b>
            </p>
            <p style={{ marginTop: 4, opacity: 0.8 }}>
              iPhone note: iOS requires manual picker permission. After loading, you can single-select, multi-select, or select all inside this UI.
            </p>

            {photoPool.length > 0 ? (
              <div style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 8,
              }}>
                {photoPool.map((file, index) => {
                  const key = photoKey(file, index);
                  const selected = selectedPhotoKeys.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => togglePhoto(key)}
                      style={{
                        border: selected ? '2px solid #22c55e' : '1px solid #334155',
                        borderRadius: 10,
                        padding: 6,
                        background: selected ? 'rgba(34,197,94,0.12)' : '#111827',
                        color: '#e5e7eb',
                        textAlign: 'left',
                      }}
                    >
                      <PhotoPreview file={file} alt={file.name} />
                      <div style={{ fontSize: 11, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selected ? '✓ ' : ''}{file.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <p>Progress: {progress.toFixed(1)}%</p>
            <p>Speed: {speed} | ETA: {eta}</p>
            {transferError ? <p style={{ color: '#f87171' }}>Transfer error: {transferError}</p> : null}
          </section>
        </>
      )}

      {tab === 'history' && (
        <section><h2>Transfer History</h2>{store.transferHistory.map((i, idx) => <div key={idx}>{i}</div>)}</section>
      )}

      {tab === 'settings' && (
        <section>
          <h2>Settings</h2>
          <label>Device name</label>
          <input value={store.deviceName} onChange={(e) => onNameSave(e.target.value)} />
          <div>
            <label><input type="checkbox" checked={store.autoAccept} onChange={(e) => store.setState({ autoAccept: e.target.checked })} /> Auto-accept transfers</label>
          </div>
        </section>
      )}
    </main>
  );
}
