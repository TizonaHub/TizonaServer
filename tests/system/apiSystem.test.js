const { readEnv, setProcessEnv } = require('../functions')
let app
let dbFunctions
const request = require('supertest');
beforeAll(async () => {
    await setProcessEnv()
    app = require('../../tizonaServer')
    dbFunctions = require('../../dbFunctions')
});
describe('/api/system endpoints testing', () => {

    test('should respond with 200 status code for GET /api/system/ping', async () => {
        const response = await request(app).get('/api/system/ping');
        expect(response.statusCode).toBe(200);
    });
    test('should respond with 403 status code for GET /api/system/errorTest', async () => {
        const response = await request(app).get('/api/system/errorTest');
        expect(response.statusCode).toBe(403);
    });
    test('GET /api/system/charts should respond JSON with server size charts', async () => {
        const response = await request(app).get('/api/system/charts');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.total).toEqual(expect.any(Number));
        expect(response.body.used).toEqual(expect.any(Number));
        expect(response.body.free).toEqual(expect.any(Number));
        expect(response.body.serverSize).toEqual(expect.any(Number));
    });
    
    test('GET /api/system/info should respond JSON with server info', async () => {
        const response = await request(app).get('/api/system/info');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
    });
    afterAll(async () => {
        await dbFunctions.connection.end();
    });
});
