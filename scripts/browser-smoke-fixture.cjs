const http = require('node:http');

const port = Number(process.env.LOCKY_BROWSER_TEST_PORT ?? 9317);
const requests = [];

http.createServer((request, response) => {
  requests.push({ method: request.method, url: request.url });
  if (request.url === '/__requests') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(requests));
    return;
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><title>Locky fixture ${request.url}</title><h1>${request.url}</h1>`);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Locky browser fixture listening on http://127.0.0.1:${port}\n`);
});
