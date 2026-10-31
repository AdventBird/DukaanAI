import 'dotenv/config';
import { PrismaClient, StockMovementType, StockUnit, SaleStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding real Indian Kirana Store data into Supabase ---');

  // 1. Store
  const store = await prisma.store.upsert({
    where: { id: 'demo-store' },
    update: { name: 'Shree Ganesh Kirana & General Store' },
    create: {
      id: 'demo-store',
      name: 'Shree Ganesh Kirana & General Store',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      isDemo: true,
    },
  });
  console.log(`✓ Store configured: "${store.name}" (${store.id})`);

  // 2. Users (Owner & Staff)
  await prisma.user.upsert({
    where: { storeId_loginId: { storeId: store.id, loginId: 'demo-owner' } },
    update: { displayName: 'Ramesh Kumar (Owner)' },
    create: {
      id: 'demo-owner',
      storeId: store.id,
      displayName: 'Ramesh Kumar (Owner)',
      loginId: 'demo-owner',
      role: 'OWNER',
    },
  });

  await prisma.user.upsert({
    where: { storeId_loginId: { storeId: store.id, loginId: 'cashier-1' } },
    update: { displayName: 'Suresh Patel (Cashier)' },
    create: {
      id: 'cashier-1',
      storeId: store.id,
      displayName: 'Suresh Patel (Cashier)',
      loginId: 'cashier-1',
      role: 'CASHIER',
    },
  });
  console.log('✓ Users configured: demo-owner, cashier-1');

  // 3. Categories
  const categoriesData = [
    { id: 'cat-dairy', name: 'Dairy & Breakfast' },
    { id: 'cat-staples', name: 'Staples: Atta, Rice & Dal' },
    { id: 'cat-oils', name: 'Cooking Oils & Ghee' },
    { id: 'cat-snacks', name: 'Packaged Snacks & Biscuits' },
    { id: 'cat-spices', name: 'Spices, Salt & Masalas' },
    { id: 'cat-beverages', name: 'Beverages & Chai' },
    { id: 'cat-personal', name: 'Personal Care & Soaps' },
    { id: 'cat-household', name: 'Household & Cleaning' },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { storeId_name: { storeId: store.id, name: cat.name } },
      update: {},
      create: { id: cat.id, storeId: store.id, name: cat.name },
    });
  }
  console.log(`✓ ${categoriesData.length} Kirana categories created`);

  // 4. Products with Barcodes & Starting Stock
  const productsData = [
    {
      id: 'prod-amul-milk',
      categoryId: 'cat-dairy',
      sku: 'AMUL-TZ-1L',
      name: 'Amul Taaza Homogenised Toned Milk 1L',
      brand: 'Amul',
      description: 'Long life UHT treated toned milk, 3.0% fat, 8.5% SNF',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Crate (12 pouches)',
      unitsPerPurchasePack: '12',
      mrp: '56.00',
      sellingPrice: '56.00',
      purchaseCost: '51.50',
      reorderLevel: '24',
      barcode: '8901262010054',
      openingStock: '36',
    },
    {
      id: 'prod-amul-butter',
      categoryId: 'cat-dairy',
      sku: 'AMUL-BTR-500G',
      name: 'Amul Butter Pasteurised 500g',
      brand: 'Amul',
      description: 'Utterly butterly delicious salted pasteurised butter block',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Carton (20 blocks)',
      unitsPerPurchasePack: '20',
      mrp: '285.00',
      sellingPrice: '275.00',
      purchaseCost: '248.00',
      reorderLevel: '10',
      barcode: '8901262010108',
      openingStock: '8', // Low stock!
    },
    {
      id: 'prod-aashirvaad-atta',
      categoryId: 'cat-staples',
      sku: 'AASH-ATTA-5KG',
      name: 'Aashirvaad Superior MP Chakki Atta 5kg',
      brand: 'ITC Aashirvaad',
      description: '100% whole wheat flour ground from MP Sehore grains',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bale (4 bags)',
      unitsPerPurchasePack: '4',
      mrp: '285.00',
      sellingPrice: '265.00',
      purchaseCost: '242.00',
      reorderLevel: '10',
      barcode: '8901030383457',
      openingStock: '18',
    },
    {
      id: 'prod-india-gate-rice',
      categoryId: 'cat-staples',
      sku: 'IG-ROZZ-5KG',
      name: 'India Gate Basmati Rice Feast Rozzana 5kg',
      brand: 'India Gate',
      description: 'Aged long-grain aromatic basmati rice for daily cooking',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bale (4 bags)',
      unitsPerPurchasePack: '4',
      mrp: '495.00',
      sellingPrice: '420.00',
      purchaseCost: '375.00',
      reorderLevel: '6',
      barcode: '8906001020300',
      openingStock: '12',
    },
    {
      id: 'prod-tata-toor-dal',
      categoryId: 'cat-staples',
      sku: 'TATA-TOOR-1KG',
      name: 'Tata Sampann Unpolished Toor Dal 1kg',
      brand: 'Tata Sampann',
      description: 'Rich in natural protein, water-polished unpolished arhar dal',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bag (20 packs)',
      unitsPerPurchasePack: '20',
      mrp: '185.00',
      sellingPrice: '172.00',
      purchaseCost: '152.00',
      reorderLevel: '10',
      barcode: '8904004403333',
      openingStock: '15',
    },
    {
      id: 'prod-fortune-oil',
      categoryId: 'cat-oils',
      sku: 'FORT-SUN-1L',
      name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch',
      brand: 'Fortune',
      description: 'Light and healthy edible cooking oil enriched with vitamins A & D',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Carton (15 pouches)',
      unitsPerPurchasePack: '15',
      mrp: '155.00',
      sellingPrice: '138.00',
      purchaseCost: '124.00',
      reorderLevel: '15',
      barcode: '8906007280234',
      openingStock: '30',
    },
    {
      id: 'prod-saffola-gold',
      categoryId: 'cat-oils',
      sku: 'SAFF-GOLD-1L',
      name: 'Saffola Gold Pro Healthy Lifestyle Blended Oil 1L',
      brand: 'Saffola',
      description: 'Rice bran and sunflower oil blend with Losorb technology',
      stockUnit: StockUnit.PIECE,
      purchasePackLabel: 'Box (12 bottles)',
      unitsPerPurchasePack: '12',
      mrp: '195.00',
      sellingPrice: '178.00',
      purchaseCost: '158.00',
      reorderLevel: '8',
      barcode: '8901088012345',
      openingStock: '5', // Low stock!
    },
    {
      id: 'prod-tata-salt',
      categoryId: 'cat-spices',
      sku: 'TATA-SALT-1KG',
      name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg',
      brand: 'Tata Salt',
      description: 'Desh Ka Namak, vacuum evaporated pure white iodised cooking salt',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bag (25 packets)',
      unitsPerPurchasePack: '25',
      mrp: '30.00',
      sellingPrice: '28.00',
      purchaseCost: '23.50',
      reorderLevel: '25',
      barcode: '8904004400301',
      openingStock: '45',
    },
    {
      id: 'prod-everest-haldi',
      categoryId: 'cat-spices',
      sku: 'EVR-HLD-200G',
      name: 'Everest Turmeric / Haldi Powder 200g Box',
      brand: 'Everest',
      description: 'High-curcumin aromatic ground turmeric spice',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Master Carton (50 boxes)',
      unitsPerPurchasePack: '50',
      mrp: '62.00',
      sellingPrice: '58.00',
      purchaseCost: '49.00',
      reorderLevel: '15',
      barcode: '8901786101010',
      openingStock: '22',
    },
    {
      id: 'prod-parle-g',
      categoryId: 'cat-snacks',
      sku: 'PARLE-G-1KG',
      name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack',
      brand: 'Parle',
      description: 'Classic crisp glucose tea-time biscuits with milk and wheat',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Box (12 packs)',
      unitsPerPurchasePack: '12',
      mrp: '140.00',
      sellingPrice: '130.00',
      purchaseCost: '118.00',
      reorderLevel: '8',
      barcode: '8901719114321',
      openingStock: '14',
    },
    {
      id: 'prod-maggi-noodles',
      categoryId: 'cat-snacks',
      sku: 'MAGGI-MAS-70G',
      name: 'Maggi 2-Minute Masala Instant Noodles 70g',
      brand: 'Nestle Maggi',
      description: 'Favorite Indian noodle with signature roasted masala tastemaker',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Carton (96 units)',
      unitsPerPurchasePack: '96',
      mrp: '14.00',
      sellingPrice: '14.00',
      purchaseCost: '11.80',
      reorderLevel: '48',
      barcode: '8901058852331',
      openingStock: '92',
    },
    {
      id: 'prod-red-label-tea',
      categoryId: 'cat-beverages',
      sku: 'RED-LBL-500G',
      name: 'Brooke Bond Red Label Tea 500g',
      brand: 'Brooke Bond',
      description: 'Strong CTC black tea granules for daily masala chai',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Case (20 packs)',
      unitsPerPurchasePack: '20',
      mrp: '290.00',
      sellingPrice: '260.00',
      purchaseCost: '235.00',
      reorderLevel: '10',
      barcode: '8901030018441',
      openingStock: '16',
    },
    {
      id: 'prod-nescafe-classic',
      categoryId: 'cat-beverages',
      sku: 'NESC-CL-50G',
      name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar',
      brand: 'Nestle Nescafe',
      description: 'Roasted Robusta and Arabica coffee granules',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Case (24 jars)',
      unitsPerPurchasePack: '24',
      mrp: '195.00',
      sellingPrice: '185.00',
      purchaseCost: '162.00',
      reorderLevel: '8',
      barcode: '8901058850023',
      openingStock: '4', // Low stock!
    },
    {
      id: 'prod-surf-excel',
      categoryId: 'cat-household',
      sku: 'SURF-QW-1KG',
      name: 'Surf Excel Quick Wash Detergent Powder 1kg',
      brand: 'Surf Excel',
      description: 'Premium stain removing washing powder with pleasant fragrance',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Sack (10 bags)',
      unitsPerPurchasePack: '10',
      mrp: '160.00',
      sellingPrice: '145.00',
      purchaseCost: '128.00',
      reorderLevel: '10',
      barcode: '8901030025340',
      openingStock: '24',
    },
    {
      id: 'prod-dettol-soap',
      categoryId: 'cat-personal',
      sku: 'DETT-SOAP-4X',
      name: 'Dettol Original Bathing Soap 75g (Pack of 4)',
      brand: 'Dettol',
      description: 'Germ protection antibacterial bathing bar soap pack',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Case (24 sets)',
      unitsPerPurchasePack: '24',
      mrp: '190.00',
      sellingPrice: '170.00',
      purchaseCost: '148.00',
      reorderLevel: '6',
      barcode: '8901396120448',
      openingStock: '12',
    },
  ];

  for (const item of productsData) {
    // Upsert product
    const product = await prisma.product.upsert({
      where: { storeId_sku: { storeId: store.id, sku: item.sku } },
      update: {
        name: item.name,
        brand: item.brand,
        categoryId: item.categoryId,
        description: item.description,
        stockUnit: item.stockUnit,
        purchasePackLabel: item.purchasePackLabel,
        unitsPerPurchasePack: item.unitsPerPurchasePack,
        mrp: item.mrp,
        sellingPrice: item.sellingPrice,
        purchaseCost: item.purchaseCost,
        reorderLevel: item.reorderLevel,
      },
      create: {
        id: item.id,
        storeId: store.id,
        sku: item.sku,
        name: item.name,
        brand: item.brand,
        categoryId: item.categoryId,
        description: item.description,
        stockUnit: item.stockUnit,
        purchasePackLabel: item.purchasePackLabel,
        unitsPerPurchasePack: item.unitsPerPurchasePack,
        mrp: item.mrp,
        sellingPrice: item.sellingPrice,
        purchaseCost: item.purchaseCost,
        reorderLevel: item.reorderLevel,
      },
    });

    // Upsert primary barcode
    await prisma.productBarcode.upsert({
      where: { storeId_barcode: { storeId: store.id, barcode: item.barcode } },
      update: {},
      create: {
        storeId: store.id,
        productId: product.id,
        barcode: item.barcode,
        symbology: 'EAN-13',
        isPrimary: true,
      },
    });

    // Upsert inventory balance
    await prisma.inventoryBalance.upsert({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
      update: { quantityOnHand: item.openingStock },
      create: {
        storeId: store.id,
        productId: product.id,
        quantityOnHand: item.openingStock,
      },
    });

    // Record stock opening movement
    const idempotencyKey = `opening-${store.id}-${product.id}`;
    const existingMovement = await prisma.stockMovement.findUnique({ where: { idempotencyKey } });
    if (!existingMovement) {
      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          productId: product.id,
          movementType: StockMovementType.OPENING,
          quantityDelta: item.openingStock,
          unit: item.stockUnit,
          reason: 'Initial verified stock intake',
          idempotencyKey,
          actorType: 'OWNER',
          actorId: 'demo-owner',
        },
      });
    }
  }
  console.log(`✓ ${productsData.length} Real FMCG products, barcodes, and inventory balances seeded`);

  // 5. Real POS Completed Sales & Receipts
  const salesData = [
    {
      receiptNumber: 'BILL-20261031-001',
      customerLabel: 'Walk-in Cash Customer',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '270.00',
      discount: '0.00',
      total: '270.00',
      amountPaid: '300.00',
      changeDue: '30.00',
      completedAt: new Date('2026-10-31T09:30:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '2', price: '56.00', cost: '51.50', lineTotal: '112.00' },
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '130.00', cost: '118.00', lineTotal: '130.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
    {
      receiptNumber: 'BILL-20261031-002',
      customerLabel: 'Sharmaji (Flat 302)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '1393.00',
      discount: '43.00',
      total: '1350.00',
      amountPaid: '1350.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T11:15:00+05:30'),
      items: [
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
      ],
      paymentRef: 'UPI/20261031/992817260199',
    },
    {
      receiptNumber: 'BILL-20261031-003',
      customerLabel: 'Amit Verma (Hostel Student)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '516.00',
      discount: '0.00',
      total: '516.00',
      amountPaid: '516.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T17:45:00+05:30'),
      items: [
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '4', price: '14.00', cost: '11.80', lineTotal: '56.00' },
        { productId: 'prod-nescafe-classic', name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar', barcode: '8901058850023', unit: 'BOX', qty: '1', price: '185.00', cost: '162.00', lineTotal: '185.00' },
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
      ],
      paymentRef: 'UPI/20261031/883719204455',
    },
    {
      receiptNumber: 'BILL-20261031-004',
      customerLabel: 'Gupta Kirana Khata (#42)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '373.00',
      discount: '0.00',
      total: '373.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T19:20:00+05:30'),
      items: [
        { productId: 'prod-surf-excel', name: 'Surf Excel Quick Wash Detergent Powder 1kg', barcode: '8901030025340', unit: 'PACKET', qty: '1', price: '145.00', cost: '128.00', lineTotal: '145.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
        { productId: 'prod-everest-haldi', name: 'Everest Turmeric / Haldi Powder 200g Box', barcode: '8901786101010', unit: 'PACKET', qty: '1', price: '58.00', cost: '49.00', lineTotal: '58.00' },
      ],
      paymentRef: 'KHATA-BOOK-PAGE-42',
    },
  ];

  for (const s of salesData) {
    const existing = await prisma.sale.findUnique({
      where: { storeId_receiptNumber: { storeId: store.id, receiptNumber: s.receiptNumber } },
    });
    if (!existing) {
      const createdSale = await prisma.sale.create({
        data: {
          storeId: store.id,
          receiptNumber: s.receiptNumber,
          status: SaleStatus.COMPLETED,
          subtotal: s.subtotal,
          discountTotal: s.discount,
          total: s.total,
          paymentStatus: PaymentStatus.COMPLETED,
          paymentMethod: s.paymentMethod,
          amountPaid: s.amountPaid,
          changeDue: s.changeDue,
          balanceDue: s.paymentMethod === PaymentMethod.CREDIT ? s.total : '0.00',
          customerLabel: s.customerLabel,
          idempotencyKey: `sale-${store.id}-${s.receiptNumber}`,
          createdBy: 'cashier-1',
          completedAt: s.completedAt,
          items: {
            create: s.items.map((i) => ({
              productId: i.productId,
              productNameSnapshot: i.name,
              barcodeSnapshot: i.barcode,
              stockUnitSnapshot: i.unit,
              quantity: i.qty,
              unitPriceSnapshot: i.price,
              unitCostSnapshot: i.cost,
              lineTotal: i.lineTotal,
            })),
          },
          payments: {
            create: {
              storeId: store.id,
              method: s.paymentMethod,
              amount: s.amountPaid,
              status: PaymentStatus.COMPLETED,
              reference: s.paymentRef,
              occurredAt: s.completedAt,
              recordedBy: 'cashier-1',
            },
          },
        },
      });
      console.log(`✓ Sale created: ${createdSale.receiptNumber} (${s.paymentMethod} - ₹${s.total})`);
    }
  }

  // 6. Real Store Operational Expenses
  const expensesData = [
    {
      category: 'Electricity & Utilities',
      description: 'BSES monthly shop power bill for deep freezer, lights and counter billing system',
      amount: '3850.00',
      occurredAt: new Date('2026-10-28T14:00:00+05:30'),
    },
    {
      category: 'Store Staff Wages',
      description: 'Daily helper wage for Guddu Kumar (stock loading and neighborhood doorstep deliveries)',
      amount: '450.00',
      occurredAt: new Date('2026-10-31T20:00:00+05:30'),
    },
    {
      category: 'Freight & Transportation',
      description: 'Loading tempo freight from APMC Wholesale Grain Mandi to shop',
      amount: '650.00',
      occurredAt: new Date('2026-10-30T16:30:00+05:30'),
    },
    {
      category: 'Licenses & Maintenance',
      description: 'Annual Municipal Shop & Establishment trade license registration renewal',
      amount: '1200.00',
      occurredAt: new Date('2026-10-25T11:00:00+05:30'),
    },
  ];

  for (const exp of expensesData) {
    await prisma.expense.create({
      data: {
        storeId: store.id,
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        currency: 'INR',
        occurredAt: exp.occurredAt,
        createdById: 'demo-owner',
      },
    });
  }
  console.log(`✓ ${expensesData.length} Real operational expenses seeded`);

  // 7. Audit Log trail
  await prisma.auditLog.create({
    data: {
      storeId: store.id,
      actorId: 'demo-owner',
      action: 'store.master_catalog_onboarded',
      entityType: 'catalog',
      metadata: {
        totalProducts: productsData.length,
        categories: categoriesData.length,
        initialStockValuationINR: '48,250.00',
      },
    },
  });
  console.log('✓ Store onboarding audit log entry created');

  console.log('--- Database seeding completed successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
