import { BadRequestException } from '@nestjs/common';
import { memoryStorage, type FileFilterCallback } from 'multer';
import type { Request } from 'express';

// Photos are buffered in memory, then uploaded to Supabase Storage by
// FishObservationsService — nothing is written to local disk, so this works
// the same whether the API runs on a host with persistent disk or not.
export const fishPhotoMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
};
