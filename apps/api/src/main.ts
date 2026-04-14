import './tracing'; // OpenTelemetry — must be first import
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';

// Initialize Sentry (before NestFactory.create)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino as the underlying logger
  app.useLogger(app.get(PinoLogger));

  // Security headers
  app.use(helmet.default());

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — explicit domain whitelist
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8081',
    'https://jyotron-web.vercel.app',
    'https://jyotryx-web.vercel.app',
    'https://www.jyotron.com',
    'https://jyotron.com',
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global metrics interceptor
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new MetricsInterceptor(metricsService));

  // Swagger documentation (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Jyotron API')
      .setDescription('Jyotron Astrology App Backend API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Chat', 'AI Chat endpoints')
      .addTag('Astrology', 'Astrology feature endpoints')
      .addTag('Palmistry', 'Palmistry analysis endpoints')
      .addTag('Payments', 'Payment and subscription endpoints')
      .addTag('Reports', 'Report generation endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  // Bind explicitly to 0.0.0.0 so container orchestrators (Railway, k8s,
  // Docker) can reach the app from outside the container. Nest's default
  // of `::` sometimes routes only IPv6, which silently fails healthchecks
  // that probe over IPv4.
  await app.listen(port, '0.0.0.0');
  logger.log(`Jyotron API running on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });
}

bootstrap();
