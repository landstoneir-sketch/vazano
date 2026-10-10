import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { RfqsModule } from './modules/rfqs/rfqs.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AdminConfigModule } from './modules/admin-config/admin-config.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SupportModule } from './modules/support/support.module';
import { AdminOperationsModule } from './modules/admin-operations/admin-operations.module';
import { CmsModule } from './modules/cms/cms.module';
import { LocationsModule } from './modules/locations/locations.module';
import { QualityControlModule } from './modules/quality-control/quality-control.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CatalogModule,
    RfqsModule,
    SubscriptionsModule,
    PaymentsModule,
    SuppliersModule,
    QuotationsModule,
    NotificationsModule,
    AttachmentsModule,
    AdminConfigModule,
    MessagesModule,
    SupportModule,
    AdminOperationsModule,
    CmsModule,
    LocationsModule,
    QualityControlModule,
    ContractsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
