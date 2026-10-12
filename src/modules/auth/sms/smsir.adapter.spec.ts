import { SmsIrAdapter } from './smsir.adapter';

describe('SmsIrAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps a business template code to its configured SMS.ir template without logging message values', async () => {
    const config = {
      getOrThrow: jest.fn((key: string) => key === 'SMSIR_API_KEY' ? 'api-key' : '123456'),
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const adapter = new SmsIrAdapter(config as never);

    await adapter.sendTemplate('09120000000', 'SUBSCRIPTION_RENEWAL_7_DAYS', [{ name: 'Date', value: '۱۴۰۵/۰۸/۰۱' }]);

    expect(config.getOrThrow).toHaveBeenCalledWith('SMSIR_SUBSCRIPTION_RENEWAL_7_TEMPLATE_ID');
    expect(fetchMock).toHaveBeenCalledWith('https://api.sms.ir/v1/send/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ mobile: '09120000000', templateId: 123456, parameters: [{ name: 'Date', value: '۱۴۰۵/۰۸/۰۱' }] }),
    }));
  });
});
