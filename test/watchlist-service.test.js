// Set NODE_ENV to 'test' before importing app
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import database connection function directly from config
const { connectToDatabase } = require('../src/config/database');

// Import the app after setting environment variables
const { app } = require('../src/app');

let mongoServer;
let server;

beforeAll(async () => {
  // Create MongoDB memory server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Connect to test database
  await connectToDatabase(uri);
  
  // Create server
  server = app.listen(0);
});

afterAll(async () => {
  // Close the server to prevent Jest hanging
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Watchlist API', () => {
  const testData = {
    userId: 'user123',
    contentId: 'movie456',
    mediaType: 'movie'
  };

  it('should return service running on /test', async () => {
    const res = await request(server).get('/test');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Watchlist service is running');
  });

  it('should add content to watchlist', async () => {
    const res = await request(server).post('/add').send(testData);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Content added to watchlist');
  });

  it('should prevent adding duplicate content', async () => {
    await request(server).post('/add').send(testData);
    const res = await request(server).post('/add').send(testData);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Content is already in the watchlist');
  });

  it('should fetch user watchlist', async () => {
    await request(server).post('/add').send(testData);
    const res = await request(server).get(`/${testData.userId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contentId).toBe(testData.contentId);
  });

  it('should remove content from watchlist', async () => {
    await request(server).post('/add').send(testData);
    const res = await request(server).post('/remove').send(testData);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Content removed from watchlist');
  });
});
