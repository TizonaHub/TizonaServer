const request = require('supertest');
const app = require('./tizonaserver');


describe('Pruebas básicas de TizonaServer', () => {

  test('GET / ruta principal responde 200', async () => {
    const response = await request(app).get('/api/system/ping');
    expect(response.statusCode).toBe(200);
  });
});