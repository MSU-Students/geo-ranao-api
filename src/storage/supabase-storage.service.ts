import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Backs fish observation photo storage — replaces local disk so the API can
// run on any host (including ones with an ephemeral filesystem) without
// losing uploaded photos. Bucket is private; access is only ever through
// short-lived signed URLs, never a public bucket URL.
@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;
  readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'fish-photos';
  }

  get configured(): boolean {
    return !!(this.configService.get<string>('SUPABASE_URL') && this.configService.get<string>('SUPABASE_SECRET_KEY'));
  }

  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.logger.warn('SUPABASE_URL / SUPABASE_SECRET_KEY not set — photo uploads will fail until configured.');
      return;
    }
    this.client = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SECRET_KEY')!,
      { auth: { persistSession: false } },
    );
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client) return;
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (data) return;
    if (error && !error.message.toLowerCase().includes('not found')) {
      this.logger.error(`Failed to check Supabase Storage bucket "${this.bucket}": ${error.message}`);
      return;
    }
    const { error: createError } = await this.client.storage.createBucket(this.bucket, { public: false });
    if (createError) {
      this.logger.error(`Failed to create Supabase Storage bucket "${this.bucket}": ${createError.message}`);
    } else {
      this.logger.log(`Created Supabase Storage bucket "${this.bucket}".`);
    }
  }

  async upload(path: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (!this.client) throw new Error('Supabase Storage is not configured');
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) throw error;
  }

  async remove(paths: string[]): Promise<void> {
    if (!this.client || paths.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove(paths);
    if (error) this.logger.warn(`Failed to remove ${paths.length} file(s) from Storage: ${error.message}`);
  }

  async createSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.client) throw new Error('Supabase Storage is not configured');
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw error ?? new Error('Failed to create signed URL');
    return data.signedUrl;
  }
}
