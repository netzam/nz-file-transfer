import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSignal } from './hooks/useSignal';
import { defaultDeviceName, getSavedDeviceName, saveDeviceName } from './lib/device';
import { useAppStore } from './store/appStore';

export default function App() {
  const store = useAppStore();
  const [joinCode, setJoinCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('-');
  const [eta, setEta] = useState('-');
  const [tab, setTab] = useState<'home'|'history'|'settings'>('home');

  const signal = useSignal();

  useMemo(() => {
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
    await signal.sendFiles(e.target.files, (p, s, t) => {
      setProgress(p);
      setSpeed(s);
      setEta(t);
    });
    store.setState({ transferHistory: [`${new Date().toLocaleString()} Sent ${e.target.files.length} file(s)`, ...store.transferHistory] });
  };

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
            <p>Connection state: <b>{signal.connected ? 'Connected' : 'Not connected'}</b></p>
            {store.peers.length === 0 ? <p>No other devices in room yet.</p> : null}
            {store.peers.map((p) => (
              <div key={p.deviceId} style={{ border: '1px solid #334155', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div><b>{p.deviceName}</b></div>
                <div>{p.userAgent}</div>
                <div>Status: {p.status}</div>
                <button onClick={() => signal.connectToPeer(p.deviceId)}>Connect</button>
              </div>
            ))}
          </section>

          <section>
            <h2>Transfer</h2>
            <input type="file" multiple onChange={onFiles} />
            <p>Progress: {progress.toFixed(1)}%</p>
            <p>Speed: {speed} | ETA: {eta}</p>
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
