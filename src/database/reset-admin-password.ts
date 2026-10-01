import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { UserEntity, UserRole } from '../users/entities/user.entity';

// seedAdmin() in seed.ts only ever *creates* the bootstrap admin — it skips
// entirely once one exists, specifically so routinely running `npm run
// seed` can never silently reset a real admin's password back to whatever
// ADMIN_PASSWORD happens to be sitting in .env. This is the explicit,
// separate action for actually rotating an existing admin's password —
// reads the new password from the same ADMIN_PASSWORD var, applies it to
// the admin account that already exists.
async function main() {
  const newPassword = process.env.ADMIN_PASSWORD;
  if (!newPassword) {
    throw new Error(
      'Set ADMIN_PASSWORD in .env to the new password before running this.',
    );
  }

  await dataSource.initialize();
  const repo = dataSource.getRepository(UserEntity);
  const admin = await repo.findOne({ where: { role: UserRole.ADMIN } });
  if (!admin) {
    throw new Error(
      'No admin account exists yet — run `npm run seed` first to create one.',
    );
  }

  admin.password = await bcrypt.hash(newPassword, 10);
  await repo.save(admin);
  console.log(`Password updated for admin account: ${admin.email}`);
  await dataSource.destroy();
}

main().catch((err: unknown) => {
  console.error('Failed to reset admin password:', err);
  process.exit(1);
});
