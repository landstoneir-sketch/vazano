import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication, config: ConfigService): void {
  if (config.get<string>('API_DOCS_ENABLED', 'false') !== 'true') return;

  const specification = new DocumentBuilder()
    .setTitle('Vazano API')
    .setDescription('قرارداد API پلتفرم استعلام قیمت وازانو')
    .setVersion('1.0')
    .setOpenAPIVersion('3.1.0')
    .addCookieAuth('vazano_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'vazano_session',
      description: 'نشست امن کاربر؛ پس از ورود توسط سرور تنظیم می‌شود.',
    }, 'sessionCookie')
    .build();

  const document = SwaggerModule.createDocument(app, specification, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}.${methodKey}`,
  });

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs/openapi.json',
    yamlDocumentUrl: 'docs/openapi.yaml',
    raw: ['json', 'yaml'],
    customSiteTitle: 'مستندات API وازانو',
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      tryItOutEnabled: false,
    },
  });
}
