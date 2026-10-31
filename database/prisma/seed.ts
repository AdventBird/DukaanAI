import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const store = await prisma.store.upsert({
    where: { id: 'demo-store' },
    update: {},
    create: { id: 'demo-store', name: 'Kirana Store (Demo)', currency: 'INR', timezone: 'Asia/Kolkata', isDemo: true },
  });
  await prisma.user.upsert({
    where: { storeId_loginId: { storeId: store.id, loginId: 'demo-owner' } },
    update: {},
    create: { id: 'demo-owner', storeId: store.id, displayName: 'Demo Owner', loginId: 'demo-owner', role: 'OWNER' },
  });
  console.log('Demo store and owner are ready.');
}
main().catch((error) => { console.error('Unable to seed the demo store.', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
