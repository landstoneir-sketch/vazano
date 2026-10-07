import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FileSafetyResult = { verdict: 'CLEAN'; provider: string } | { verdict: 'PENDING'; provider: string };

@Injectable()
export class FileSafetyService {
  constructor(private readonly config: ConfigService) {}

  inspect(): FileSafetyResult {
    const mode = this.config.get<string>('FILE_SCAN_MODE', this.config.get<string>('NODE_ENV') === 'production' ? 'pending' : 'development-bypass');
    if (mode === 'development-bypass' && this.config.get<string>('NODE_ENV') !== 'production') {
      return { verdict: 'CLEAN', provider: 'development-bypass' };
    }
    return { verdict: 'PENDING', provider: 'scanner-not-configured' };
  }
}
