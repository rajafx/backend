// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  // --- PERUBAHAN UTAMA: Prioritaskan DATABASE_URL ---
  // Railway dan kebanyakan platform cloud menyediakan satu variable connection string.
  const databaseUrl = configService.get<string>('DATABASE_URL');

  // Jika DATABASE_URL ada (di Railway), gunakan itu.
  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl, // <-- INI KUNCI-NYA
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      // PASTIKAN FALSE DI PRODUCTION! Sangat berbahaya jika true.
      synchronize: false,
      logging: configService.get<string>('NODE_ENV') === 'development',
      // SSL seringkali diperlukan untuk koneksi ke database eksternal seperti Railway
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }

  // --- FALLBACK: Untuk development lokal ---
  // Jika tidak ada DATABASE_URL (misal saat jalan lokal), gunakan variable terpisah.
  // Ini memungkinkan kamu tetap bisa develop di komputer lokal.
  console.warn('DATABASE_URL not found, falling back to individual DB variables for local development.');
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    logging: true,
  };
};