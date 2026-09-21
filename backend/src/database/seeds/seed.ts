import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../config/typeorm.datasource';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../user/enums/user-role.enum';
import { UserStatus } from '../../user/enums/user-status.enum';
import { Package } from '../../packages/entities/package.entity';
import { PackageTier } from '../../packages/entities/package-tier.entity';
import { PackageType } from '../../packages/enums/package-type.enum';
import { PackageStatus } from '../../packages/enums/package-status.enum';
import { TierName, TierStatus } from '../../packages/enums/tier-name.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { VendorType } from '../../vendors/enums/vendor-type.enum';
import { VendorStatus } from '../../vendors/enums/vendor-status.enum';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryStatus } from '../../inventory/enums/inventory-status.enum';

async function runSeed() {
  console.log('🌱 Starting database seeding...');
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  const userRepo = AppDataSource.getRepository(User);
  const packageRepo = AppDataSource.getRepository(Package);
  const tierRepo = AppDataSource.getRepository(PackageTier);
  const vendorRepo = AppDataSource.getRepository(Vendor);
  const inventoryRepo = AppDataSource.getRepository(InventoryItem);

  // ─── 1. Seed Users ───────────────────────────────────────────────────────────
  console.log('👤 Seeding Users...');
  const saltRounds = 10;

  const adminEmail = 'admin@hajj.gov.bd';
  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const adminPasswordHash = await bcrypt.hash('Admin123!', saltRounds);
    admin = userRepo.create({
      name: 'System Administrator',
      email: adminEmail,
      phone: '+8801700000001',
      password_hash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(admin);
    console.log(`   + Created Admin: ${adminEmail} (password: Admin123!)`);
  } else {
    console.log(`   = Admin already exists: ${adminEmail}`);
  }

  const pilgrimEmail = 'pilgrim@example.com';
  let pilgrim = await userRepo.findOne({ where: { email: pilgrimEmail } });
  if (!pilgrim) {
    const pilgrimPasswordHash = await bcrypt.hash('User123!', saltRounds);
    pilgrim = userRepo.create({
      name: 'Rahim Ahmed',
      email: pilgrimEmail,
      phone: '+8801800000002',
      password_hash: pilgrimPasswordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(pilgrim);
    console.log(`   + Created Pilgrim User: ${pilgrimEmail} (password: User123!)`);
  } else {
    console.log(`   = Pilgrim User already exists: ${pilgrimEmail}`);
  }

  // ─── 2. Seed Packages & Tiers ────────────────────────────────────────────────
  console.log('📦 Seeding Packages & Tiers...');

  const packagesData = [
    {
      name: 'Hajj VIP Executive 2027',
      slug: 'hajj-vip-executive-2027',
      type: PackageType.HAJJ,
      description: 'Exclusive 5-star Hajj package with Clock Tower accommodation and VIP Maktab in Mina.',
      departure_date: '2027-05-15',
      return_date: '2027-06-08',
      booking_start: new Date('2026-01-01T00:00:00Z'),
      booking_end: new Date('2027-04-01T23:59:59Z'),
      status: PackageStatus.PUBLISHED,
      tiers: [
        {
          name: TierName.VIP,
          price: '1200000.00',
          currency: 'BDT',
          total_quota: 40,
        },
        {
          name: TierName.STANDARD,
          price: '850000.00',
          currency: 'BDT',
          total_quota: 120,
        },
      ],
    },
    {
      name: 'Ramadan Special Umrah 2027',
      slug: 'ramadan-special-umrah-2027',
      type: PackageType.RAMADAN_UMRAH,
      description: 'Perform Umrah in the last 10 nights of blessed Ramadan with Tahajjud at Haramain.',
      departure_date: '2027-03-20',
      return_date: '2027-04-05',
      booking_start: new Date('2026-01-01T00:00:00Z'),
      booking_end: new Date('2027-03-01T23:59:59Z'),
      status: PackageStatus.PUBLISHED,
      tiers: [
        {
          name: TierName.STANDARD,
          price: '250000.00',
          currency: 'BDT',
          total_quota: 100,
        },
        {
          name: TierName.ECONOMY,
          price: '180000.00',
          currency: 'BDT',
          total_quota: 200,
        },
      ],
    },
    {
      name: 'Off-Season Winter Umrah 2026',
      slug: 'off-season-winter-umrah-2026',
      type: PackageType.OFF_SEASON_UMRAH,
      description: 'Pleasant winter weather Umrah tour with guided historical Ziyarah in Makkah & Madinah.',
      departure_date: '2026-11-10',
      return_date: '2026-11-24',
      booking_start: new Date('2026-01-01T00:00:00Z'),
      booking_end: new Date('2026-10-25T23:59:59Z'),
      status: PackageStatus.PUBLISHED,
      tiers: [
        {
          name: TierName.ECONOMY,
          price: '135000.00',
          currency: 'BDT',
          total_quota: 80,
        },
      ],
    },
  ];

  for (const pkgData of packagesData) {
    let pkg = await packageRepo.findOne({ where: { slug: pkgData.slug } });
    if (!pkg) {
      pkg = packageRepo.create({
        name: pkgData.name,
        slug: pkgData.slug,
        type: pkgData.type,
        description: pkgData.description,
        departure_date: pkgData.departure_date,
        return_date: pkgData.return_date,
        booking_start: pkgData.booking_start,
        booking_end: pkgData.booking_end,
        status: pkgData.status,
      });
      await packageRepo.save(pkg);
      console.log(`   + Created Package: ${pkg.name}`);

      for (const t of pkgData.tiers) {
        const tier = tierRepo.create({
          package_id: pkg.id,
          name: t.name,
          price: t.price,
          currency: t.currency,
          total_quota: t.total_quota,
          held_seats: 0,
          confirmed_seats: 0,
          status: TierStatus.ACTIVE,
        });
        await tierRepo.save(tier);
        console.log(`      * Added Tier: ${tier.name} (Price: ${tier.price} ${tier.currency}, Quota: ${tier.total_quota})`);
      }
    } else {
      console.log(`   = Package already exists: ${pkg.name}`);
    }
  }

  // ─── 3. Seed Vendors ─────────────────────────────────────────────────────────
  console.log('🏢 Seeding Vendors...');
  const vendorsData = [
    {
      name: 'Swissôtel Al Maqam Makkah',
      type: VendorType.HOTEL,
      contact_name: 'Ahmed Al-Ghamdi',
      contact_email: 'reservations@almaqam.com',
      contact_phone: '+966125717333',
      address: 'Abraj Al Bait Complex, King Abdul Aziz Endowment, Makkah, Saudi Arabia',
    },
    {
      name: 'Biman Bangladesh Airlines',
      type: VendorType.AIRLINE,
      contact_name: 'Flight Ops Desk',
      contact_email: 'hajj.ops@bdbiman.com',
      contact_phone: '+88028901600',
      address: 'Balaka Bhaban, Kurmitola, Dhaka 1229, Bangladesh',
    },
    {
      name: 'SAPTCO - Saudi Public Transport Company',
      type: VendorType.TRANSPORT,
      contact_name: 'Hajj Transport Logistics',
      contact_email: 'hajj@saptco.com.sa',
      contact_phone: '+966920000877',
      address: 'Al Nakheel, Riyadh, Saudi Arabia',
    },
    {
      name: 'KSA MoFA Umrah Visa Division',
      type: VendorType.VISA,
      contact_name: 'Consular Services',
      contact_email: 'visa@mofa.gov.sa',
      contact_phone: '+966114077777',
      address: 'Ministry of Foreign Affairs, Riyadh, Saudi Arabia',
    },
  ];

  for (const vData of vendorsData) {
    let vendor = await vendorRepo.findOne({ where: { name: vData.name } });
    if (!vendor) {
      vendor = vendorRepo.create({
        name: vData.name,
        type: vData.type,
        contact_name: vData.contact_name,
        contact_email: vData.contact_email,
        contact_phone: vData.contact_phone,
        address: vData.address,
        status: VendorStatus.ACTIVE,
      });
      await vendorRepo.save(vendor);
      console.log(`   + Created Vendor: ${vendor.name} (${vendor.type})`);
    } else {
      console.log(`   = Vendor already exists: ${vendor.name}`);
    }
  }

  // ─── 4. Seed Inventory Items ─────────────────────────────────────────────────
  console.log('🎒 Seeding Inventory Items...');
  const inventoryData = [
    {
      name: 'Ihram Fabric Set (Male, 100% Cotton)',
      sku: 'IHR-M-01',
      unit: 'SET',
      quantity: 400,
      minimum_stock: 50,
    },
    {
      name: 'Travel Luggage Bag 28" (Waterproof)',
      sku: 'BAG-28-01',
      unit: 'PCS',
      quantity: 250,
      minimum_stock: 30,
    },
    {
      name: 'STC 5G Data & Calling SIM (15 Days)',
      sku: 'SIM-STC-01',
      unit: 'PCS',
      quantity: 500,
      minimum_stock: 50,
    },
    {
      name: 'Tawaf Counter Digital Ring',
      sku: 'CNT-DIG-01',
      unit: 'PCS',
      quantity: 600,
      minimum_stock: 100,
    },
  ];

  for (const itemData of inventoryData) {
    let item = await inventoryRepo.findOne({ where: { sku: itemData.sku } });
    if (!item) {
      item = inventoryRepo.create({
        name: itemData.name,
        sku: itemData.sku,
        unit: itemData.unit,
        quantity: itemData.quantity,
        minimum_stock: itemData.minimum_stock,
        status: InventoryStatus.ACTIVE,
      });
      await inventoryRepo.save(item);
      console.log(`   + Created Inventory Item: ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity})`);
    } else {
      console.log(`   = Inventory Item already exists: ${item.sku}`);
    }
  }

  console.log('✨ Database seeding completed successfully!');
  await AppDataSource.destroy();
}

runSeed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
