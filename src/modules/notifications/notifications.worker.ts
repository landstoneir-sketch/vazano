import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('NOTIFICATION_WORKER_ENABLED', 'true') !== 'true') return;
    void this.process();
    const intervalMs = this.config.get<number>('NOTIFICATION_WORKER_INTERVAL_MS', 15_000);
    this.timer = setInterval(() => void this.process(), intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.notifications.processPendingEvents();
      if (result.events > 0) this.logger.log(`Processed ${result.events} notification events for ${result.notifications} recipients.`);
    } catch (error: unknown) {
      this.logger.error('Notification event processing failed.', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
