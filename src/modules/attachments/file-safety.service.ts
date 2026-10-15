import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { once } from 'node:events';
import { createConnection, type Socket } from 'node:net';
import type { Readable } from 'node:stream';

export type FileSafetyResult =
  | { verdict: 'CLEAN'; provider: string }
  | { verdict: 'INFECTED'; provider: string; reason: string }
  | { verdict: 'PENDING'; provider: string; reason: string };

export function parseClamAvResponse(rawResponse: string): Exclude<FileSafetyResult, { verdict: 'PENDING' }> {
  const response = rawResponse.replaceAll('\0', '').trim();
  if (response.endsWith(': OK')) return { verdict: 'CLEAN', provider: 'clamav' };
  const infected = response.match(/:\s+(.+)\s+FOUND$/);
  if (infected?.[1]) return { verdict: 'INFECTED', provider: 'clamav', reason: infected[1].slice(0, 200) };
  throw new Error('Unexpected response from the malware scanner.');
}

export function parseClamAvPingResponse(rawResponse: string): void {
  const response = rawResponse.replaceAll('\0', '').trim();
  if (response !== 'PONG') throw new Error('Malware scanner health response is invalid.');
}

@Injectable()
export class FileSafetyService {
  private readonly logger = new Logger(FileSafetyService.name);

  constructor(private readonly config: ConfigService) {}

  async inspect(content?: Readable): Promise<FileSafetyResult> {
    const mode = this.config.get<string>('FILE_SCAN_MODE', this.config.get<string>('NODE_ENV') === 'production' ? 'pending' : 'development-bypass');
    if (mode === 'development-bypass' && this.config.get<string>('NODE_ENV') !== 'production') {
      return { verdict: 'CLEAN', provider: 'development-bypass' };
    }
    if (mode !== 'clamav' || !content) {
      return { verdict: 'PENDING', provider: 'scanner-not-configured', reason: 'SCANNER_NOT_CONFIGURED' };
    }

    try {
      return await this.scanWithClamAv(content);
    } catch {
      this.logger.warn('Malware scanner unavailable; attachment remains pending.');
      return { verdict: 'PENDING', provider: 'clamav', reason: 'SCANNER_UNAVAILABLE' };
    } finally {
      content.destroy();
    }
  }

  requiresContent(): boolean {
    return this.config.get<string>('FILE_SCAN_MODE') === 'clamav';
  }

  async checkHealth(): Promise<void> {
    if (!this.requiresContent()) throw new Error('Malware scanner is not configured.');
    const response = await this.sendCommand('zPING\0', Math.min(this.scannerTimeoutMs(), 3000));
    parseClamAvPingResponse(response);
  }

  private scanWithClamAv(content: Readable): Promise<Exclude<FileSafetyResult, { verdict: 'PENDING' }>> {
    const { host, port } = this.scannerEndpoint();
    const timeoutMs = this.scannerTimeoutMs();

    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port });
      let response = '';
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };
      const succeed = () => {
        if (settled) return;
        try {
          const result = parseClamAvResponse(response);
          settled = true;
          socket.destroy();
          resolve(result);
        } catch (error: unknown) {
          fail(error instanceof Error ? error : new Error('Malware scanner response is invalid.'));
        }
      };

      socket.setTimeout(timeoutMs, () => fail(new Error('Malware scanner timed out.')));
      socket.once('error', fail);
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (response.length > 8192) return fail(new Error('Malware scanner response is too large.'));
        if (response.includes('\0')) succeed();
      });
      socket.once('end', succeed);
      socket.once('connect', () => {
        void this.sendStream(socket, content).catch(fail);
      });
    });
  }

  private sendCommand(command: string, timeoutMs: number): Promise<string> {
    const { host, port } = this.scannerEndpoint();
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port });
      let response = '';
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(response);
      };

      socket.setTimeout(timeoutMs, () => fail(new Error('Malware scanner timed out.')));
      socket.once('error', fail);
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (response.length > 1024) return fail(new Error('Malware scanner health response is too large.'));
        if (response.includes('\0')) succeed();
      });
      socket.once('end', succeed);
      socket.once('connect', () => socket.end(command));
    });
  }

  private scannerEndpoint(): { host: string; port: number } {
    return {
      host: this.config.get<string>('CLAMAV_HOST', '127.0.0.1'),
      port: Number(this.config.get<string>('CLAMAV_PORT', '3310')),
    };
  }

  private scannerTimeoutMs(): number {
    return Number(this.config.get<string>('CLAMAV_TIMEOUT_MS', '15000'));
  }

  private async sendStream(socket: Socket, content: Readable): Promise<void> {
    await this.writeWithBackpressure(socket, Buffer.from('zINSTREAM\0'));
    for await (const chunk of content) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      if (buffer.length === 0) continue;
      const length = Buffer.allocUnsafe(4);
      length.writeUInt32BE(buffer.length, 0);
      await this.writeWithBackpressure(socket, length);
      await this.writeWithBackpressure(socket, buffer);
    }
    await this.writeWithBackpressure(socket, Buffer.alloc(4));
  }

  private async writeWithBackpressure(socket: Socket, data: Buffer): Promise<void> {
    if (!socket.write(data)) await once(socket, 'drain');
  }
}
