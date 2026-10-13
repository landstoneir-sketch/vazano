import { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service';

const config = {
  get: jest.fn((key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'development' : fallback),
  getOrThrow: jest.fn((key: string) => key === 'S3_ENDPOINT' ? 'http://127.0.0.1:9000' : 'development-only-credential'),
} as unknown as ConfigService;

function storageWithSend(send: jest.Mock): ObjectStorageService {
  const storage = new ObjectStorageService(config);
  (storage as unknown as { client: { send: jest.Mock } }).client = { send };
  return storage;
}

describe('ObjectStorageService startup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('continues when the development bucket already exists after a create race', async () => {
    const alreadyOwned = Object.assign(new Error('already owned'), { name: 'BucketAlreadyOwnedByYou' });
    const send = jest.fn().mockRejectedValueOnce(new Error('not found')).mockRejectedValueOnce(alreadyOwned);

    await expect(storageWithSend(send).onModuleInit()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not hide an unexpected bucket creation failure', async () => {
    const createFailure = new Error('storage unavailable');
    const send = jest.fn().mockRejectedValueOnce(new Error('not found')).mockRejectedValueOnce(createFailure);

    await expect(storageWithSend(send).onModuleInit()).rejects.toBe(createFailure);
  });

  it('never attempts bucket creation in production', async () => {
    const productionConfig = {
      ...config,
      get: jest.fn((key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'production' : fallback),
    } as unknown as ConfigService;
    const storage = new ObjectStorageService(productionConfig);
    const headFailure = new Error('forbidden');
    const send = jest.fn().mockRejectedValue(headFailure);
    (storage as unknown as { client: { send: jest.Mock } }).client = { send };

    await expect(storage.onModuleInit()).rejects.toBe(headFailure);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
