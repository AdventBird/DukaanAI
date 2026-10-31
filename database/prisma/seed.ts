import 'dotenv/config';
import { PrismaClient, Prisma, StockUnit, StockMovementType } from '@prisma/client';

const prisma = new PrismaClient();

interface DemoProductSeed {
  sku?: string;
  name: string;
  brand?: string;
  categoryName: string;
  stockUnit: StockUnit;
  purchasePackLabel?: string;
  unitsPerPurchasePack?: string;
  mrp?: string;
  sellingPrice: string;
  purchaseCost?: string;
  reorderLevel: string;
  initialStock: string;
  barcode?: string;
}

const demoProducts: DemoProductSeed[] = [
  // Packaged Foods & Snacks
  {
    name: 'Maggi 2-Minute Noodles 70g',
    brand: 'Nestle',
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Carton (96 pcs)',
    unitsPerPurchasePack: '96',
    mrp: '14.00',
    sellingPrice: '13.00',
    purchaseCost: '11.20',
    reorderLevel: '24',
    initialStock: '48',
    barcode: '8901058852309',
  },
  {
    name: 'Parle-G Gold Biscuits 100g',
    brand: 'Parle',
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Carton (120 pcs)',
    unitsPerPurchasePack: '120',
    mrp: '10.00',
    sellingPrice: '10.00',
    purchaseCost: '8.50',
    reorderLevel: '30',
    initialStock: '60',
    barcode: '8901719101038',
  },
  {
    name: 'Good Day Cashew Cookies 100g',
    brand: 'Britannia',
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    mrp: '25.00',
    sellingPrice: '24.00',
    purchaseCost: '20.00',
    reorderLevel: '20',
    initialStock: '8', // Low stock!
    barcode: '8901063012118',
  },
  {
    name: "Lay's India's Magic Masala 50g",
    brand: "Lay's",
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    mrp: '20.00',
    sellingPrice: '20.00',
    purchaseCost: '16.50',
    reorderLevel: '15',
    initialStock: '30',
    barcode: '8901491101831',
  },
  {
    name: "Haldiram's Bhujia Sev 200g",
    brand: "Haldiram's",
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    mrp: '55.00',
    sellingPrice: '52.00',
    purchaseCost: '44.00',
    reorderLevel: '12',
    initialStock: '20',
    barcode: '8904004400511',
  },
  {
    name: 'Kissan Fresh Tomato Ketchup 500g',
    brand: 'Kissan',
    categoryName: 'Packaged Foods & Snacks',
    stockUnit: 'PIECE',
    mrp: '120.00',
    sellingPrice: '110.00',
    purchaseCost: '95.00',
    reorderLevel: '8',
    initialStock: '4', // Low stock!
    barcode: '8901030382218',
  },

  // Dairy & Breakfast
  {
    name: 'Amul Taaza Homogenised Toned Milk 1L',
    brand: 'Amul',
    categoryName: 'Dairy & Breakfast',
    stockUnit: 'LITRE',
    purchasePackLabel: 'Crate (12 pcs)',
    unitsPerPurchasePack: '12',
    mrp: '74.00',
    sellingPrice: '72.00',
    purchaseCost: '66.00',
    reorderLevel: '10',
    initialStock: '25',
    barcode: '8901262010053',
  },
  {
    name: 'Amul Butter 100g',
    brand: 'Amul',
    categoryName: 'Dairy & Breakfast',
    stockUnit: 'PIECE',
    mrp: '58.00',
    sellingPrice: '56.00',
    purchaseCost: '50.00',
    reorderLevel: '15',
    initialStock: '12', // Low stock!
    barcode: '8901262010107',
  },
  {
    name: 'Mother Dairy Cow Milk Paneer 200g',
    brand: 'Mother Dairy',
    categoryName: 'Dairy & Breakfast',
    stockUnit: 'PIECE',
    mrp: '90.00',
    sellingPrice: '88.00',
    purchaseCost: '78.00',
    reorderLevel: '8',
    initialStock: '15',
    barcode: '8901648001019',
  },
  {
    name: "Kellogg's Corn Flakes 475g",
    brand: "Kellogg's",
    categoryName: 'Dairy & Breakfast',
    stockUnit: 'PIECE',
    mrp: '195.00',
    sellingPrice: '180.00',
    purchaseCost: '155.00',
    reorderLevel: '6',
    initialStock: '10',
    barcode: '8901499008026',
  },

  // Staples & Grains
  {
    name: 'Tata Salt Vacuum Evaporated 1kg',
    brand: 'Tata',
    categoryName: 'Staples & Grains',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Bag (25 pcs)',
    unitsPerPurchasePack: '25',
    mrp: '28.00',
    sellingPrice: '26.00',
    purchaseCost: '22.00',
    reorderLevel: '25',
    initialStock: '50',
    barcode: '8904004400016',
  },
  {
    name: 'Aashirvaad Shudh Chakki Atta 5kg',
    brand: 'Aashirvaad',
    categoryName: 'Staples & Grains',
    stockUnit: 'PIECE',
    mrp: '265.00',
    sellingPrice: '250.00',
    purchaseCost: '225.00',
    reorderLevel: '10',
    initialStock: '18',
    barcode: '8901725121112',
  },
  {
    name: 'Fortune Sunlite Refined Sunflower Oil 1L',
    brand: 'Fortune',
    categoryName: 'Staples & Grains',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Carton (12 pcs)',
    unitsPerPurchasePack: '12',
    mrp: '145.00',
    sellingPrice: '138.00',
    purchaseCost: '122.00',
    reorderLevel: '12',
    initialStock: '6', // Low stock!
    barcode: '8906007280014',
  },
  {
    name: 'Loose Basmati Rice (Premium)',
    categoryName: 'Staples & Grains',
    stockUnit: 'KG',
    mrp: '120.00',
    sellingPrice: '110.00',
    purchaseCost: '92.00',
    reorderLevel: '50',
    initialStock: '85.500',
  },
  {
    name: 'Loose Toor Dal (Desi)',
    categoryName: 'Staples & Grains',
    stockUnit: 'KG',
    mrp: '160.00',
    sellingPrice: '155.00',
    purchaseCost: '135.00',
    reorderLevel: '30',
    initialStock: '15.200', // Low stock!
  },
  {
    name: 'Loose Sugar (Medium Grain)',
    categoryName: 'Staples & Grains',
    stockUnit: 'KG',
    mrp: '46.00',
    sellingPrice: '44.00',
    purchaseCost: '39.00',
    reorderLevel: '100',
    initialStock: '240.000',
  },
  {
    name: 'Loose Chana Dal',
    categoryName: 'Staples & Grains',
    stockUnit: 'KG',
    mrp: '95.00',
    sellingPrice: '90.00',
    purchaseCost: '76.00',
    reorderLevel: '25',
    initialStock: '40.000',
  },

  // Beverages
  {
    name: 'Red Label Tea 250g',
    brand: 'Brooke Bond',
    categoryName: 'Beverages',
    stockUnit: 'PIECE',
    mrp: '130.00',
    sellingPrice: '125.00',
    purchaseCost: '108.00',
    reorderLevel: '10',
    initialStock: '20',
    barcode: '8901030383017',
  },
  {
    name: 'Bru Instant Coffee 50g',
    brand: 'Bru',
    categoryName: 'Beverages',
    stockUnit: 'PIECE',
    mrp: '90.00',
    sellingPrice: '85.00',
    purchaseCost: '72.00',
    reorderLevel: '8',
    initialStock: '5', // Low stock!
    barcode: '8901030384014',
  },
  {
    name: 'Coca-Cola Original 750ml PET',
    brand: 'Coca-Cola',
    categoryName: 'Beverages',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Crate (24 pcs)',
    unitsPerPurchasePack: '24',
    mrp: '40.00',
    sellingPrice: '40.00',
    purchaseCost: '32.00',
    reorderLevel: '24',
    initialStock: '48',
    barcode: '8901764012013',
  },
  {
    name: 'Frooti Mango Drink 160ml Tetra',
    brand: 'Parle Agro',
    categoryName: 'Beverages',
    stockUnit: 'PIECE',
    purchasePackLabel: 'Carton (40 pcs)',
    unitsPerPurchasePack: '40',
    mrp: '10.00',
    sellingPrice: '10.00',
    purchaseCost: '8.20',
    reorderLevel: '30',
    initialStock: '60',
    barcode: '8901719114014',
  },

  // Personal Care & Hygiene
  {
    name: 'Dettol Original Bathing Soap 75g',
    brand: 'Dettol',
    categoryName: 'Personal Care & Hygiene',
    stockUnit: 'PIECE',
    mrp: '38.00',
    sellingPrice: '36.00',
    purchaseCost: '30.00',
    reorderLevel: '15',
    initialStock: '25',
    barcode: '8901396112111',
  },
  {
    name: 'Lifebuoy Total Soap 125g',
    brand: 'Lifebuoy',
    categoryName: 'Personal Care & Hygiene',
    stockUnit: 'PIECE',
    mrp: '42.00',
    sellingPrice: '40.00',
    purchaseCost: '34.00',
    reorderLevel: '15',
    initialStock: '7', // Low stock!
    barcode: '8901030342014',
  },
  {
    name: 'Colgate Strong Teeth Toothpaste 150g',
    brand: 'Colgate',
    categoryName: 'Personal Care & Hygiene',
    stockUnit: 'PIECE',
    mrp: '110.00',
    sellingPrice: '102.00',
    purchaseCost: '88.00',
    reorderLevel: '12',
    initialStock: '22',
    barcode: '8901314010529',
  },
  {
    name: 'Clinic Plus Strong & Long Shampoo 80ml',
    brand: 'Clinic Plus',
    categoryName: 'Personal Care & Hygiene',
    stockUnit: 'PIECE',
    mrp: '55.00',
    sellingPrice: '52.00',
    purchaseCost: '43.00',
    reorderLevel: '10',
    initialStock: '18',
    barcode: '8901030351016',
  },
  {
    name: 'Whisper Choice Regular Sanitary Pads (6s)',
    brand: 'Whisper',
    categoryName: 'Personal Care & Hygiene',
    stockUnit: 'PIECE',
    mrp: '36.00',
    sellingPrice: '34.00',
    purchaseCost: '28.00',
    reorderLevel: '15',
    initialStock: '30',
    barcode: '8901314502017',
  },

  // Household & Cleaning
  {
    name: 'Surf Excel Quick Wash Detergent Powder 1kg',
    brand: 'Surf Excel',
    categoryName: 'Household & Cleaning',
    stockUnit: 'PIECE',
    mrp: '145.00',
    sellingPrice: '138.00',
    purchaseCost: '118.00',
    reorderLevel: '10',
    initialStock: '16',
    barcode: '8901030361015',
  },
  {
    name: 'Vim Dishwash Bar 135g',
    brand: 'Vim',
    categoryName: 'Household & Cleaning',
    stockUnit: 'PIECE',
    mrp: '10.00',
    sellingPrice: '10.00',
    purchaseCost: '8.20',
    reorderLevel: '30',
    initialStock: '45',
    barcode: '8901030371014',
  },
  {
    name: 'Harpic Power Plus Disinfectant Toilet Cleaner 500ml',
    brand: 'Harpic',
    categoryName: 'Household & Cleaning',
    stockUnit: 'PIECE',
    mrp: '95.00',
    sellingPrice: '90.00',
    purchaseCost: '75.00',
    reorderLevel: '8',
    initialStock: '3', // Low stock!
    barcode: '8901396131013',
  },
  {
    name: 'Good Knight Gold Flash Liquid Mosquito Refill',
    brand: 'Good Knight',
    categoryName: 'Household & Cleaning',
    stockUnit: 'PIECE',
    mrp: '85.00',
    sellingPrice: '80.00',
    purchaseCost: '68.00',
    reorderLevel: '12',
    initialStock: '18',
    barcode: '8901023015015',
  },
];

async function main() {
  const store = await prisma.store.upsert({
    where: { id: 'demo-store' },
    update: {},
    create: {
      id: 'demo-store',
      name: 'Kirana Store (Demo)',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      isDemo: true,
    },
  });

  await prisma.user.upsert({
    where: { storeId_loginId: { storeId: store.id, loginId: 'demo-owner' } },
    update: {},
    create: {
      id: 'demo-owner',
      storeId: store.id,
      displayName: 'Demo Owner',
      loginId: 'demo-owner',
      role: 'OWNER',
    },
  });

  console.log('Demo store and owner verified.');

  // Collect unique category names
  const categoryNames = Array.from(new Set(demoProducts.map((p) => p.categoryName)));
  const categoryMap = new Map<string, string>();

  for (const catName of categoryNames) {
    const category = await prisma.category.upsert({
      where: { storeId_name: { storeId: store.id, name: catName } },
      update: {},
      create: { storeId: store.id, name: catName },
    });
    categoryMap.set(catName, category.id);
  }
  console.log(`Seeded ${categoryMap.size} product categories.`);

  let seededCount = 0;
  for (const item of demoProducts) {
    const categoryId = categoryMap.get(item.categoryName)!;

    // Check if product already exists by name in store
    let product = await prisma.product.findFirst({
      where: { storeId: store.id, name: item.name },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          storeId: store.id,
          sku: item.sku,
          name: item.name,
          brand: item.brand,
          categoryId,
          stockUnit: item.stockUnit,
          purchasePackLabel: item.purchasePackLabel,
          unitsPerPurchasePack: item.unitsPerPurchasePack ? new Prisma.Decimal(item.unitsPerPurchasePack) : null,
          mrp: item.mrp ? new Prisma.Decimal(item.mrp) : null,
          sellingPrice: new Prisma.Decimal(item.sellingPrice),
          purchaseCost: item.purchaseCost ? new Prisma.Decimal(item.purchaseCost) : null,
          reorderLevel: new Prisma.Decimal(item.reorderLevel),
          isActive: true,
        },
      });

      // Link barcode if present
      if (item.barcode) {
        await prisma.productBarcode.create({
          data: {
            storeId: store.id,
            productId: product.id,
            barcode: item.barcode,
            isPrimary: true,
          },
        });
      }

      // Create opening stock balance and opening stock movement atomically
      const initialQty = new Prisma.Decimal(item.initialStock);
      await prisma.$transaction([
        prisma.inventoryBalance.create({
          data: {
            storeId: store.id,
            productId: product.id,
            quantityOnHand: initialQty,
          },
        }),
        prisma.stockMovement.create({
          data: {
            storeId: store.id,
            productId: product.id,
            movementType: StockMovementType.OPENING,
            quantityDelta: initialQty,
            unit: item.stockUnit,
            reason: 'Opening stock count',
            referenceType: 'OPENING',
            referenceId: 'demo-seed',
            actorType: 'SYSTEM',
            actorId: 'seed-runner',
          },
        }),
      ]);

      seededCount++;
    }
  }

  console.log(`Successfully seeded ${seededCount} Kirana store products with inventory ledger.`);
}

main()
  .catch((error) => {
    console.error('Unable to seed the demo store.', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
