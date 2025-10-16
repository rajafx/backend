// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- KONFIGURASI CORS YANG CERDAS ---
  const allowedOrigins = [
    'http://localhost:3000', // Untuk development lokal
    'https://billionup.crypto', // Untuk production domain 1
    'https://billionup.ai',      // Untuk production domain 2
  ];

  app.enableCors({
    origin: function (origin, callback) {
      // Izinkan request tanpa origin (misalnya dari Postman atau mobile app)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        // Origin diizinkan
        callback(null, true);
      } else {
        // Origin tidak diizinkan
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Penting jika kamu menggunakan cookies atau auth headers
  });
  // ------------------------------------

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();