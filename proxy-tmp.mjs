import http from 'node:http';
http.createServer((req, res) => {
  const r = http.request({ host: '127.0.0.1', port: 3000, path: req.url, method: req.method,
    headers: { ...req.headers, host: 'bacanalmadrid.com', 'x-forwarded-host': 'bacanalmadrid.com' } },
    (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
  r.on('error', () => { res.writeHead(502); res.end('x'); });
  req.pipe(r);
}).listen(4321, () => console.log('proxy 4321'));
