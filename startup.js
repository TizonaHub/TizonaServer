const fs = require('fs');
const http = require('http');
const https = require('https');
const app = require('./tizonaserver');

try {
  const params = {
    cert: fs.readFileSync(process.env.CRT),
    key: fs.readFileSync(process.env.SSL_KEY),
    passphrase: process.env.PASSPHRASE
  };
  const testHTTPS = process.env.TEST_HTTPS;
  const mode = process.env.NODE_ENV;
  const condition1 = mode == 'development' && testHTTPS != 'true';
  const condition2 = mode != 'production';
  if (condition1 && condition2) throw new Error('Development mode, creating http server...');

  https.createServer(params, app).listen(443, () => {
    console.log(`HTTPS Server is running`);
  });
} catch (error) {
  console.log('Unable to create HTTPS server, creating HTTP server...');
  http.createServer(app).listen(80, () => {
    console.log('HTTP server is running');
  });
}
