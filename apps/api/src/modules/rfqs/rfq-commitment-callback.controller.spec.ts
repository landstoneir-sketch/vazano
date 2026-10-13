import type { Response } from 'express';
import { RfqCommitmentCallbackController } from './rfq-commitment-callback.controller';

describe('RfqCommitmentCallbackController', () => {
  it('redirects the buyer to the RFQ after a successful callback', async () => {
    const rfqs = {
      handleCommitmentCallback: jest.fn().mockResolvedValue({ success: true, rfqId: 'rfq/with space', referenceId: 'ref-1', receiptId: 'receipt/1' }),
    };
    const config = { get: jest.fn().mockReturnValue('https://vazano.ir/') };
    const redirect = jest.fn();
    const response = { redirect } as unknown as Response;
    const controller = new RfqCommitmentCallbackController(rfqs as never, config as never);

    await controller.callback({ Authority: 'authority-1', Status: 'OK' }, response);

    expect(redirect).toHaveBeenCalledWith(303, 'https://vazano.ir/dashboard/rfqs/rfq%2Fwith%20space?commitmentPayment=success&receiptId=receipt%2F1');
  });

  it('returns a safe failed destination when callback processing throws', async () => {
    const rfqs = { handleCommitmentCallback: jest.fn().mockRejectedValue(new Error('provider unavailable')) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const redirect = jest.fn();
    const response = { redirect } as unknown as Response;
    const controller = new RfqCommitmentCallbackController(rfqs as never, config as never);

    await controller.callback({ Authority: 'authority-1', Status: 'OK' }, response);

    expect(redirect).toHaveBeenCalledWith(303, 'http://localhost:3000/dashboard/rfqs?commitmentPayment=failed');
  });
});
