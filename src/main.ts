import 'reflect-metadata';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { apiRateLimitGuard, RedisRuntime, requestContext, sessionOriginGuard } from './common/request-security';
import { configureOpenApi } from './openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const trustProxyHops = Number(config.get<string>('TRUST_PROXY_HOPS', '0'));
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) app.set('trust proxy', trustProxyHops);
  app.setGlobalPrefix('v1');
  app.use(requestContext);
  app.use(apiRateLimitGuard(app.get(RedisRuntime), config));
  configureOpenApi(app, config);
  app.use(helmet());
  app.use(cookieParser());
  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
  app.use(sessionOriginGuard(webOrigin));
  app.enableCors({ origin: webOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();
  await app.listen(config.get<number>('API_PORT', 3001), '0.0.0.0');
}

void bootstrap();
