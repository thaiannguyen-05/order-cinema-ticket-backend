import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { QUEUE_NAME } from './constant/event.type';
import { EmailWorker } from './email.worker';
import { EmailConsumer } from './email.consumer';
import { existsSync } from 'fs';
import { OutboxService } from './outbox.service';

const resolveTemplateDir = () => {
  const candidates = [
    join(__dirname, 'templates'),
    join(process.cwd(), 'dist/src/background/email/templates'),
    join(process.cwd(), 'src/background/email/templates'),
  ];

  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
};

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: configService.get('USER_SMTP'),
            pass: configService.get('USER_SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: '"No Reply" <noreply@cinemabooking.com>',
        },
        template: {
          dir: resolveTemplateDir(),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: QUEUE_NAME.GMAIL_SERVICE,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              `amqp://${configService.getOrThrow<string>('RABBITMQ_USER')}:${configService.getOrThrow<string>('RABBITMQ_PASS')}@${configService.get<string>('RABBITMQ_HOST', 'localhost')}:${configService.getOrThrow<string>('RABBITMQ_PORT')}/${configService.get<string>('RABBITMQ_VHOST', '')}`,
            ],
            queue: QUEUE_NAME.GMAIL_SERVICE,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [EmailConsumer],
  providers: [EmailService, EmailWorker, OutboxService],
  exports: [EmailService, EmailWorker, OutboxService],
})
export class EmailModule {}
