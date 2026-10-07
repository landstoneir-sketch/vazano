import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Injectable()
export class SubscriptionLifecycleWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SubscriptionLifecycleWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED', 'true') !== 'true') return;
    void this.process();
    const intervalMs = this.config.get<number>('SUBSCRIPTION_LIFECYCLE_WORKER_INTERVAL_MS', 60_000);
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
      const result = await this.lifecycle.process();
      if (result.reminders + result.enteredGrace + result.expired > 0) {
        this.logger.log(`Subscription lifecycle processed reminders=${result.reminders}, grace=${result.enteredGrace}, expired=${result.expired}.`);
      }
    } catch (error: unknown) {
      this.logger.error('Subscription lifecycle processing failed.', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
