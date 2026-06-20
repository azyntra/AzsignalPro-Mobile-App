const http = require('http');

const PORT = 3001;
const TARGET_HOST = '130.162.189.149';
const TARGET_PORT = 3000;

http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  options.headers.host = `${TARGET_HOST}:${TARGET_PORT}`;
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxyReq);
  
  proxyReq.on('error', (e) => {
    console.error('Proxy Error:', e.message);
    res.writeHead(500);
    res.end(e.message);
  });
}).listen(PORT, () => console.log(`Proxying localhost:${PORT} -> ${TARGET_HOST}:${TARGET_PORT}`));
