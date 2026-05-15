type SecureStoreMock = {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

function loadAuthStorage() {
  jest.resetModules();

  const secureStore: SecureStoreMock = {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  };

  jest.doMock('expo-secure-store', () => secureStore);

  const { AuthStorage } = require('../AuthStorage');
  return { AuthStorage, secureStore };
}

const testUser = {
  userId: 'user-1',
  email: 'worker@example.com',
  hospitalId: 'hospital-1',
  specialty: 'icu',
  roleLevel: 'resident',
};

describe('AuthStorage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.dontMock('expo-secure-store');
    jest.restoreAllMocks();
  });

  it('retries transient SecureStore read failures instead of falling back to empty memory', async () => {
    const { AuthStorage, secureStore } = loadAuthStorage();
    secureStore.getItemAsync
      .mockRejectedValueOnce(new Error('temporary keychain read failure'))
      .mockResolvedValueOnce('token-123');

    await expect(AuthStorage.getToken()).resolves.toBe('token-123');
    expect(secureStore.getItemAsync).toHaveBeenCalledTimes(2);
  });

  it('uses in-memory fallback only when SecureStore is unavailable', async () => {
    const { AuthStorage, secureStore } = loadAuthStorage();
    const expiresAt = new Date('2026-05-15T12:00:00.000Z');

    secureStore.setItemAsync.mockRejectedValueOnce(new Error('OSStatus error -34018'));

    await AuthStorage.saveAuth('token-123', testUser, expiresAt);

    await expect(AuthStorage.getToken()).resolves.toBe('token-123');
    await expect(AuthStorage.getUser()).resolves.toEqual(testUser);
    await expect(AuthStorage.getExpiresAt()).resolves.toEqual(expiresAt);
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('does not hide non-availability SecureStore write failures', async () => {
    const { AuthStorage, secureStore } = loadAuthStorage();
    secureStore.setItemAsync.mockRejectedValue(new Error('write failed'));

    await expect(
      AuthStorage.saveAuth('token-123', testUser, new Date('2026-05-15T12:00:00.000Z'))
    ).rejects.toThrow('Failed to save authentication data');
  });
});
