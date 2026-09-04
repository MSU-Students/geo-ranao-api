import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { UserEntity, UserRole } from '../users/entities/user.entity';

// One-off: update the existing admin's login credentials in place (the seed
// script intentionally skips re-creating an admin that already exists).
async function updateAdmin() {
  const newEmail = process.argv[2];
  const newPassword = process.argv[3];
  if (!newEmail || !newPassword) {
    console.error('Usage: ts-node update-admin.ts <email> <password>');
    process.exit(1);
  }

  await dataSource.initialize();
  const repo = dataSource.getRepository(UserEntity);
  const admin = await repo.findOne({ where: { role: UserRole.ADMIN } });
  if (!admin) {
    console.error('No admin account found.');
    await dataSource.destroy();
    process.exit(1);
  }

  admin.email = newEmail;
  admin.password = await bcrypt.hash(newPassword, 10);
  await repo.save(admin);
  console.log(`Admin credentials updated: ${newEmail} / ${newPassword}`);
  await dataSource.destroy();
}

updateAdmin().catch((err: unknown) => {
  console.error('Update failed:', err);
  process.exit(1);
});
