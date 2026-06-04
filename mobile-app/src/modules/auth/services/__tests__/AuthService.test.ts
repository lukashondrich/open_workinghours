jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      authBaseUrl: 'http://test-api.local',
    },
  },
}));

import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/auth/consent-types';
import { AuthService } from '../AuthService';

function mockOkResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockTextErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    text: jest.fn().mockResolvedValue(text),
  } as unknown as Response;
}

describe('AuthService.updateConsent', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts current policy versions and refreshes the user profile', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(mockOkResponse({}))
      .mockResolvedValueOnce(mockOkResponse({
        user_id: 'user-1',
        hospital_id: 'hospital-1',
        specialty: 'surgery',
        role_level: 'resident',
        state_code: 'BY',
        terms_accepted_version: CURRENT_TERMS_VERSION,
        privacy_accepted_version: CURRENT_PRIVACY_VERSION,
        consent_accepted_at: '2026-05-22T00:00:00.000Z',
      }));

    const user = await AuthService.updateConsent('token-123', 'doctor@example.com');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://test-api.local/auth/consent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          terms_version: CURRENT_TERMS_VERSION,
          privacy_version: CURRENT_PRIVACY_VERSION,
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://test-api.local/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
      })
    );
    expect(user).toEqual(expect.objectContaining({
      userId: 'user-1',
      email: 'doctor@example.com',
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
      consentAcceptedAt: '2026-05-22T00:00:00.000Z',
    }));
  });

  it('surfaces plain-text backend failures without a JSON parse error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(mockTextErrorResponse(500, 'Internal Server Error'));

    await expect(AuthService.updateConsent('token-123')).rejects.toThrow('Internal Server Error');
  });
});
