const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, connectToDatabase } = require('../index'); // updated import

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectToDatabase(uri);
});

afterAll(async () => {
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
    const res = await request(app).get('/test');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Watchlist service is running');
  });

  it('should add content to watchlist', async () => {
    const res = await request(app).post('/add').send(testData);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Content added to watchlist');
  });

  it('should prevent adding duplicate content', async () => {
    await request(app).post('/add').send(testData);
    const res = await request(app).post('/add').send(testData);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Content is already in the watchlist');
  });

  it('should fetch user watchlist', async () => {
    await request(app).post('/add').send(testData);
    const res = await request(app).get(`/${testData.userId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contentId).toBe(testData.contentId);
  });

  it('should remove content from watchlist', async () => {
    await request(app).post('/add').send(testData);
    const res = await request(app).post('/remove').send(testData);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Content removed from watchlist');
  });
});
