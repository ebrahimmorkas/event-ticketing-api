process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED ??= 'false';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough-123';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/ticketing_test?schema=public';
