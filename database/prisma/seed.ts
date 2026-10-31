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
      where: { id: cat.id },
      update: { name: cat.name },
      create: {
        id: cat.id,
        storeId: store.id,
        name: cat.name,
      },
    });
  }
  console.log(`✓ ${categoriesData.length} Kirana categories created`);

  // 4. Products with Barcodes & Opening Inventory
  const productsData = [
    {
      id: 'prod-amul-milk',
      sku: 'AMUL-TZ-1L',
      name: 'Amul Taaza Homogenised Toned Milk 1L',
      brand: 'Amul',
      categoryId: 'cat-dairy',
      description: 'Long life UHT treated toned milk, 3.0% fat, 8.5% SNF',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Crate (12 pouches)',
      unitsPerPurchasePack: '12',
      mrp: '56.00',
      sellingPrice: '56.00',
      purchaseCost: '51.50',
      reorderLevel: '24',
      openingStock: '36',
      barcode: '8901262010054',
    },
    {
      id: 'prod-amul-butter',
      sku: 'AMUL-BTR-500G',
      name: 'Amul Butter Pasteurised 500g',
      brand: 'Amul',
      categoryId: 'cat-dairy',
      description: 'Utterly butterly delicious salted pasteurised butter block',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Carton (20 blocks)',
      unitsPerPurchasePack: '20',
      mrp: '285.00',
      sellingPrice: '275.00',
      purchaseCost: '248.00',
      reorderLevel: '10',
      openingStock: '8', // Low stock alert!
      barcode: '8901262010108',
    },
    {
      id: 'prod-aashirvaad-atta',
      sku: 'AASH-ATTA-5KG',
      name: 'Aashirvaad Superior MP Chakki Atta 5kg',
      brand: 'ITC Aashirvaad',
      categoryId: 'cat-staples',
      description: '100% whole wheat flour ground from MP Sehore grains',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bale (4 bags)',
      unitsPerPurchasePack: '4',
      mrp: '285.00',
      sellingPrice: '265.00',
      purchaseCost: '242.00',
      reorderLevel: '10',
      openingStock: '18',
      barcode: '8901030383457',
    },
    {
      id: 'prod-india-gate-rice',
      sku: 'IG-RICE-5KG',
      name: 'India Gate Basmati Rice Feast Rozzana 5kg',
      brand: 'India Gate',
      categoryId: 'cat-staples',
      description: 'Aged long grain aromatic basmati rice for daily meals',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bale (4 bags)',
      unitsPerPurchasePack: '4',
      mrp: '450.00',
      sellingPrice: '420.00',
      purchaseCost: '375.00',
      reorderLevel: '8',
      openingStock: '12',
      barcode: '8906001020300',
    },
    {
      id: 'prod-tata-toor-dal',
      sku: 'TATA-TOOR-1KG',
      name: 'Tata Sampann Unpolished Toor Dal 1kg',
      brand: 'Tata Sampann',
      categoryId: 'cat-staples',
      description: 'Rich in natural protein, water-polished unpolished arhar dal',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bag (20 packs)',
      unitsPerPurchasePack: '20',
      mrp: '185.00',
      sellingPrice: '172.00',
      purchaseCost: '152.00',
      reorderLevel: '10',
      openingStock: '15',
      barcode: '8904004403333',
    },
    {
      id: 'prod-fortune-oil',
      sku: 'FORT-SUN-1L',
      name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch',
      brand: 'Fortune',
      categoryId: 'cat-oils',
      description: 'Light and healthy cooking oil rich in Vitamin E',
      stockUnit: StockUnit.PIECE,
      purchasePackLabel: 'Carton (12 pouches)',
      unitsPerPurchasePack: '12',
      mrp: '150.00',
      sellingPrice: '138.00',
      purchaseCost: '124.00',
      reorderLevel: '15',
      openingStock: '30',
      barcode: '8906007280234',
    },
    {
      id: 'prod-saffola-gold',
      sku: 'SAFF-GOLD-1L',
      name: 'Saffola Gold Pro Healthy Lifestyle Blended Oil 1L',
      brand: 'Saffola',
      categoryId: 'cat-oils',
      description: 'Rice bran and sunflower oil blend with Losorb technology',
      stockUnit: StockUnit.PIECE,
      purchasePackLabel: 'Box (12 bottles)',
      unitsPerPurchasePack: '12',
      mrp: '195.00',
      sellingPrice: '178.00',
      purchaseCost: '158.00',
      reorderLevel: '8',
      openingStock: '5', // Low stock alert!
      barcode: '8901088012345',
    },
    {
      id: 'prod-tata-salt',
      sku: 'TATA-SALT-1KG',
      name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg',
      brand: 'Tata Salt',
      categoryId: 'cat-spices',
      description: 'Desh Ka Namak, vacuum evaporated pure white iodised cooking salt',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Bag (25 packets)',
      unitsPerPurchasePack: '25',
      mrp: '30.00',
      sellingPrice: '28.00',
      purchaseCost: '23.50',
      reorderLevel: '25',
      openingStock: '45',
      barcode: '8904004400301',
    },
    {
      id: 'prod-everest-haldi',
      sku: 'EVR-HALDI-200G',
      name: 'Everest Turmeric / Haldi Powder 200g Box',
      brand: 'Everest',
      categoryId: 'cat-spices',
      description: 'High curcumin rich pure ground turmeric spice powder',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Carton (30 boxes)',
      unitsPerPurchasePack: '30',
      mrp: '74.00',
      sellingPrice: '68.00',
      purchaseCost: '58.00',
      reorderLevel: '12',
      openingStock: '25',
      barcode: '8901786101010',
    },
    {
      id: 'prod-parle-g',
      sku: 'PARLE-G-1KG',
      name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack',
      brand: 'Parle',
      categoryId: 'cat-snacks',
      description: 'Crispy delicious glucose energy biscuits beloved across India',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Corrugated Box (12 packs)',
      unitsPerPurchasePack: '12',
      mrp: '135.00',
      sellingPrice: '125.00',
      purchaseCost: '112.00',
      reorderLevel: '12',
      openingStock: '20',
      barcode: '8901719114321',
    },
    {
      id: 'prod-maggi-noodles',
      sku: 'MAGGI-2MIN-4PK',
      name: 'Maggi 2-Minute Masala Instant Noodles 70g (Pack of 4)',
      brand: 'Nestle Maggi',
      categoryId: 'cat-snacks',
      description: 'Classic Indian spicy masala instant noodles with tastemaker',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Box (24 packs)',
      unitsPerPurchasePack: '24',
      mrp: '60.00',
      sellingPrice: '56.00',
      purchaseCost: '50.00',
      reorderLevel: '16',
      openingStock: '28',
      barcode: '8901058852331',
    },
    {
      id: 'prod-red-label-tea',
      sku: 'RED-LBL-500G',
      name: 'Brooke Bond Red Label Tea 500g',
      brand: 'Brooke Bond',
      categoryId: 'cat-beverages',
      description: 'Strong CTC black tea granules for daily masala chai',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Case (20 packs)',
      unitsPerPurchasePack: '20',
      mrp: '290.00',
      sellingPrice: '260.00',
      purchaseCost: '235.00',
      reorderLevel: '10',
      openingStock: '16',
      barcode: '8901030018441',
    },
    {
      id: 'prod-nescafe-classic',
      sku: 'NES-CLAS-50G',
      name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar',
      brand: 'Nestle Nescafe',
      categoryId: 'cat-beverages',
      description: 'Rich aroma robust coffee granules for hot & cold coffee',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Case (24 jars)',
      unitsPerPurchasePack: '24',
      mrp: '195.00',
      sellingPrice: '185.00',
      purchaseCost: '162.00',
      reorderLevel: '8',
      openingStock: '4', // Low stock alert!
      barcode: '8901058850023',
    },
    {
      id: 'prod-surf-excel',
      sku: 'SURF-QW-1KG',
      name: 'Surf Excel Quick Wash Detergent Powder 1kg',
      brand: 'Surf Excel',
      categoryId: 'cat-household',
      description: 'Premium stain removing washing powder with pleasant fragrance',
      stockUnit: StockUnit.PACKET,
      purchasePackLabel: 'Sack (10 bags)',
      unitsPerPurchasePack: '10',
      mrp: '160.00',
      sellingPrice: '145.00',
      purchaseCost: '128.00',
      reorderLevel: '10',
      openingStock: '24',
      barcode: '8901030025340',
    },
    {
      id: 'prod-dettol-soap',
      sku: 'DETT-ORIG-4PK',
      name: 'Dettol Original Bathing Soap 75g (Pack of 4)',
      brand: 'Dettol',
      categoryId: 'cat-personal',
      description: 'Antibacterial germ protection trusted bathing soap bar',
      stockUnit: StockUnit.BOX,
      purchasePackLabel: 'Case (18 packs)',
      unitsPerPurchasePack: '18',
      mrp: '190.00',
      sellingPrice: '170.00',
      purchaseCost: '148.00',
      reorderLevel: '10',
      openingStock: '14',
      barcode: '8901396120448',
    },
  ];

  for (const p of productsData) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        categoryId: p.categoryId,
        description: p.description,
        stockUnit: p.stockUnit,
        purchasePackLabel: p.purchasePackLabel,
        unitsPerPurchasePack: p.unitsPerPurchasePack,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        purchaseCost: p.purchaseCost,
        reorderLevel: p.reorderLevel,
      },
      create: {
        id: p.id,
        storeId: store.id,
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        categoryId: p.categoryId,
        description: p.description,
        stockUnit: p.stockUnit,
        purchasePackLabel: p.purchasePackLabel,
        unitsPerPurchasePack: p.unitsPerPurchasePack,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        purchaseCost: p.purchaseCost,
        reorderLevel: p.reorderLevel,
        isActive: true,
      },
    });

    // Barcode
    const existingBarcode = await prisma.productBarcode.findFirst({
      where: { storeId: store.id, barcode: p.barcode },
    });
    if (!existingBarcode) {
      await prisma.productBarcode.create({
        data: {
          storeId: store.id,
          productId: p.id,
          barcode: p.barcode,
          symbology: 'EAN-13',
          isPrimary: true,
        },
      });
    }

    // Opening Inventory Balance
    await prisma.inventoryBalance.upsert({
      where: { storeId_productId: { storeId: store.id, productId: p.id } },
      update: { quantityOnHand: p.openingStock },
      create: {
        storeId: store.id,
        productId: p.id,
        quantityOnHand: p.openingStock,
      },
    });
  }
  console.log(`✓ ${productsData.length} Real FMCG products, barcodes, and inventory balances seeded`);

  // 5. 26 Real-World Indian Kirana POS Sales across the past 7 days & today
  const salesHistory = [
    // Today: Nov 01, 2026
    {
      receiptNumber: 'BILL-20261101-001',
      customerLabel: 'Morning Milk Walk-in (Cash)',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '168.00',
      discount: '0.00',
      total: '168.00',
      amountPaid: '200.00',
      changeDue: '32.00',
      completedAt: new Date('2026-11-01T07:45:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '3', price: '56.00', cost: '51.50', lineTotal: '168.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
    {
      receiptNumber: 'BILL-20261101-002',
      customerLabel: 'Sharmaji (Flat 302)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '1393.00',
      discount: '43.00',
      total: '1350.00',
      amountPaid: '1350.00',
      changeDue: '0.00',
      completedAt: new Date('2026-11-01T09:15:00+05:30'),
      items: [
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
      ],
      paymentRef: 'UPI/20261101/992817260199',
    },
    {
      receiptNumber: 'BILL-20261101-003',
      customerLabel: 'Amit Verma (Hostel Student)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '516.00',
      discount: '0.00',
      total: '516.00',
      amountPaid: '516.00',
      changeDue: '0.00',
      completedAt: new Date('2026-11-01T11:30:00+05:30'),
      items: [
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '4', price: '14.00', cost: '11.80', lineTotal: '56.00' },
        { productId: 'prod-nescafe-classic', name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar', barcode: '8901058850023', unit: 'BOX', qty: '1', price: '185.00', cost: '162.00', lineTotal: '185.00' },
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
      ],
      paymentRef: 'UPI/20261101/883719204455',
    },
    {
      receiptNumber: 'BILL-20261101-004',
      customerLabel: 'Gupta Kirana Khata (#42)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '373.00',
      discount: '0.00',
      total: '373.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-11-01T13:10:00+05:30'),
      items: [
        { productId: 'prod-surf-excel', name: 'Surf Excel Quick Wash Detergent Powder 1kg', barcode: '8901030025340', unit: 'PACKET', qty: '1', price: '145.00', cost: '128.00', lineTotal: '145.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
        { productId: 'prod-everest-haldi', name: 'Everest Turmeric / Haldi Powder 200g Box', barcode: '8901786101010', unit: 'PACKET', qty: '1', price: '58.00', cost: '49.00', lineTotal: '58.00' },
      ],
      paymentRef: 'KHATA-BOOK-PAGE-42',
    },
    {
      receiptNumber: 'BILL-20261101-005',
      customerLabel: 'Mrs. Iyer (Flat 101)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '435.00',
      discount: '15.00',
      total: '420.00',
      amountPaid: '420.00',
      changeDue: '0.00',
      completedAt: new Date('2026-11-01T15:20:00+05:30'),
      items: [
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-everest-haldi', name: 'Everest Turmeric / Haldi Powder 200g Box', barcode: '8901786101010', unit: 'PACKET', qty: '2', price: '68.00', cost: '58.00', lineTotal: '136.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
      ],
      paymentRef: 'UPI/20261101/771928374655',
    },

    // Yesterday: Oct 31, 2026
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
      customerLabel: 'Dr. Kulkarni (Society Secy)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '865.00',
      discount: '15.00',
      total: '850.00',
      amountPaid: '850.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T12:00:00+05:30'),
      items: [
        { productId: 'prod-saffola-gold', name: 'Saffola Gold Pro Healthy Lifestyle Blended Oil 1L', barcode: '8901088012345', unit: 'PIECE', qty: '2', price: '178.00', cost: '158.00', lineTotal: '356.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
      ],
      paymentRef: 'UPI/20261031/1029384756',
    },
    {
      receiptNumber: 'BILL-20261031-003',
      customerLabel: 'Priya Singh (College Hostel)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '497.00',
      discount: '0.00',
      total: '497.00',
      amountPaid: '497.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T16:40:00+05:30'),
      items: [
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '5', price: '14.00', cost: '11.80', lineTotal: '70.00' },
        { productId: 'prod-nescafe-classic', name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar', barcode: '8901058850023', unit: 'BOX', qty: '1', price: '185.00', cost: '162.00', lineTotal: '185.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
      ],
      paymentRef: 'UPI/20261031/6543219870',
    },
    {
      receiptNumber: 'BILL-20261031-004',
      customerLabel: 'Tiwari Tailors Khata (#18)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '616.00',
      discount: '0.00',
      total: '616.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-31T19:50:00+05:30'),
      items: [
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
      ],
      paymentRef: 'KHATA-TIWARI-18',
    },

    // Oct 30, 2026
    {
      receiptNumber: 'BILL-20261030-001',
      customerLabel: 'Saini Tea Stall Khata (#05)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '1040.00',
      discount: '40.00',
      total: '1000.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-30T06:30:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '10', price: '56.00', cost: '51.50', lineTotal: '560.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '2', price: '260.00', cost: '235.00', lineTotal: '520.00' },
      ],
      paymentRef: 'KHATA-SAINI-05',
    },
    {
      receiptNumber: 'BILL-20261030-002',
      customerLabel: 'Vermaji (B-Wing 401)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '857.00',
      discount: '7.00',
      total: '850.00',
      amountPaid: '850.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-30T11:15:00+05:30'),
      items: [
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-surf-excel', name: 'Surf Excel Quick Wash Detergent Powder 1kg', barcode: '8901030025340', unit: 'PACKET', qty: '1', price: '145.00', cost: '128.00', lineTotal: '145.00' },
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
      ],
      paymentRef: 'UPI/20261030/1928374650',
    },
    {
      receiptNumber: 'BILL-20261030-003',
      customerLabel: 'Walk-in Cash Customer',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '211.00',
      discount: '1.00',
      total: '210.00',
      amountPaid: '250.00',
      changeDue: '40.00',
      completedAt: new Date('2026-10-30T17:10:00+05:30'),
      items: [
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
        { productId: 'prod-everest-haldi', name: 'Everest Turmeric / Haldi Powder 200g Box', barcode: '8901786101010', unit: 'PACKET', qty: '1', price: '58.00', cost: '49.00', lineTotal: '58.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },

    // Oct 29, 2026
    {
      receiptNumber: 'BILL-20261029-001',
      customerLabel: 'Mrs. Deshmukh',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '958.00',
      discount: '18.00',
      total: '940.00',
      amountPaid: '940.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-29T10:20:00+05:30'),
      items: [
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
      ],
      paymentRef: 'UPI/20261029/3847291048',
    },
    {
      receiptNumber: 'BILL-20261029-002',
      customerLabel: 'Rohan Mehta (Hostel Snack Run)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '366.00',
      discount: '6.00',
      total: '360.00',
      amountPaid: '360.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-29T18:30:00+05:30'),
      items: [
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '4', price: '14.00', cost: '11.80', lineTotal: '56.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
        { productId: 'prod-nescafe-classic', name: 'Nescafe Classic 100% Pure Instant Coffee 50g Glass Jar', barcode: '8901058850023', unit: 'BOX', qty: '1', price: '185.00', cost: '162.00', lineTotal: '185.00' },
      ],
      paymentRef: 'UPI/20261029/9871234509',
    },
    {
      receiptNumber: 'BILL-20261029-003',
      customerLabel: 'Walk-in Cash Customer',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '282.00',
      discount: '2.00',
      total: '280.00',
      amountPaid: '300.00',
      changeDue: '20.00',
      completedAt: new Date('2026-10-29T20:15:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '2', price: '56.00', cost: '51.50', lineTotal: '112.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },

    // Oct 28, 2026
    {
      receiptNumber: 'BILL-20261028-001',
      customerLabel: 'Gupta Kirana Khata (#42)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '974.00',
      discount: '14.00',
      total: '960.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-28T09:40:00+05:30'),
      items: [
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '2', price: '265.00', cost: '242.00', lineTotal: '530.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
      ],
      paymentRef: 'KHATA-BOOK-PAGE-42',
    },
    {
      receiptNumber: 'BILL-20261028-002',
      customerLabel: 'Sunita Bai (Domestic Worker)',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '201.00',
      discount: '1.00',
      total: '200.00',
      amountPaid: '200.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-28T14:15:00+05:30'),
      items: [
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
    {
      receiptNumber: 'BILL-20261028-003',
      customerLabel: 'Dr. Kulkarni (Society Secy)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '730.00',
      discount: '0.00',
      total: '730.00',
      amountPaid: '730.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-28T19:00:00+05:30'),
      items: [
        { productId: 'prod-saffola-gold', name: 'Saffola Gold Pro Healthy Lifestyle Blended Oil 1L', barcode: '8901088012345', unit: 'PIECE', qty: '2', price: '178.00', cost: '158.00', lineTotal: '356.00' },
        { productId: 'prod-surf-excel', name: 'Surf Excel Quick Wash Detergent Powder 1kg', barcode: '8901030025340', unit: 'PACKET', qty: '1', price: '145.00', cost: '128.00', lineTotal: '145.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
      ],
      paymentRef: 'UPI/20261028/4820193847',
    },

    // Oct 27, 2026
    {
      receiptNumber: 'BILL-20261027-001',
      customerLabel: 'Sharmaji (Flat 302)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '1158.00',
      discount: '28.00',
      total: '1130.00',
      amountPaid: '1130.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-27T10:00:00+05:30'),
      items: [
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
      ],
      paymentRef: 'UPI/20261027/2948103948',
    },
    {
      receiptNumber: 'BILL-20261027-002',
      customerLabel: 'Walk-in Cash Customer',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '249.00',
      discount: '0.00',
      total: '249.00',
      amountPaid: '250.00',
      changeDue: '1.00',
      completedAt: new Date('2026-10-27T16:15:00+05:30'),
      items: [
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '4', price: '14.00', cost: '11.80', lineTotal: '56.00' },
        { productId: 'prod-everest-haldi', name: 'Everest Turmeric / Haldi Powder 200g Box', barcode: '8901786101010', unit: 'PACKET', qty: '1', price: '68.00', cost: '58.00', lineTotal: '68.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
    {
      receiptNumber: 'BILL-20261027-003',
      customerLabel: 'Rajesh Carpenter (Woodworks)',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '438.00',
      discount: '8.00',
      total: '430.00',
      amountPaid: '500.00',
      changeDue: '70.00',
      completedAt: new Date('2026-10-27T19:40:00+05:30'),
      items: [
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
        { productId: 'prod-surf-excel', name: 'Surf Excel Quick Wash Detergent Powder 1kg', barcode: '8901030025340', unit: 'PACKET', qty: '1', price: '145.00', cost: '128.00', lineTotal: '145.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },

    // Oct 26, 2026
    {
      receiptNumber: 'BILL-20261026-001',
      customerLabel: 'Saini Tea Stall Khata (#05)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '1040.00',
      discount: '40.00',
      total: '1000.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-26T06:45:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '10', price: '56.00', cost: '51.50', lineTotal: '560.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '2', price: '260.00', cost: '235.00', lineTotal: '520.00' },
      ],
      paymentRef: 'KHATA-SAINI-05',
    },
    {
      receiptNumber: 'BILL-20261026-002',
      customerLabel: 'Amit Verma (Hostel Student)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '430.00',
      discount: '0.00',
      total: '430.00',
      amountPaid: '430.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-26T14:30:00+05:30'),
      items: [
        { productId: 'prod-amul-butter', name: 'Amul Butter Pasteurised 500g', barcode: '8901262010108', unit: 'BOX', qty: '1', price: '275.00', cost: '248.00', lineTotal: '275.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '2', price: '14.00', cost: '11.80', lineTotal: '28.00' },
      ],
      paymentRef: 'UPI/20261026/8391029485',
    },
    {
      receiptNumber: 'BILL-20261026-003',
      customerLabel: 'Mrs. Iyer (Flat 101)',
      paymentMethod: PaymentMethod.UPI,
      subtotal: '614.00',
      discount: '14.00',
      total: '600.00',
      amountPaid: '600.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-26T18:00:00+05:30'),
      items: [
        { productId: 'prod-india-gate-rice', name: 'India Gate Basmati Rice Feast Rozzana 5kg', barcode: '8906001020300', unit: 'PACKET', qty: '1', price: '420.00', cost: '375.00', lineTotal: '420.00' },
        { productId: 'prod-tata-toor-dal', name: 'Tata Sampann Unpolished Toor Dal 1kg', barcode: '8904004403333', unit: 'PACKET', qty: '1', price: '172.00', cost: '152.00', lineTotal: '172.00' },
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
      ],
      paymentRef: 'UPI/20261026/9283741029',
    },

    // Oct 25, 2026
    {
      receiptNumber: 'BILL-20261025-001',
      customerLabel: 'Morning Milk Rush',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '224.00',
      discount: '0.00',
      total: '224.00',
      amountPaid: '250.00',
      changeDue: '26.00',
      completedAt: new Date('2026-10-25T08:00:00+05:30'),
      items: [
        { productId: 'prod-amul-milk', name: 'Amul Taaza Homogenised Toned Milk 1L', barcode: '8901262010054', unit: 'PACKET', qty: '4', price: '56.00', cost: '51.50', lineTotal: '224.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
    {
      receiptNumber: 'BILL-20261025-002',
      customerLabel: 'Gupta Kirana Khata (#42)',
      paymentMethod: PaymentMethod.CREDIT,
      subtotal: '835.00',
      discount: '15.00',
      total: '820.00',
      amountPaid: '0.00',
      changeDue: '0.00',
      completedAt: new Date('2026-10-25T11:45:00+05:30'),
      items: [
        { productId: 'prod-aashirvaad-atta', name: 'Aashirvaad Superior MP Chakki Atta 5kg', barcode: '8901030383457', unit: 'PACKET', qty: '1', price: '265.00', cost: '242.00', lineTotal: '265.00' },
        { productId: 'prod-fortune-oil', name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', barcode: '8906007280234', unit: 'PACKET', qty: '2', price: '138.00', cost: '124.00', lineTotal: '276.00' },
        { productId: 'prod-red-label-tea', name: 'Brooke Bond Red Label Tea 500g', barcode: '8901030018441', unit: 'PACKET', qty: '1', price: '260.00', cost: '235.00', lineTotal: '260.00' },
        { productId: 'prod-tata-salt', name: 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', barcode: '8904004400301', unit: 'PACKET', qty: '1', price: '28.00', cost: '23.50', lineTotal: '28.00' },
      ],
      paymentRef: 'KHATA-BOOK-PAGE-42',
    },
    {
      receiptNumber: 'BILL-20261025-003',
      customerLabel: 'Bunty (Snack & Soap)',
      paymentMethod: PaymentMethod.CASH,
      subtotal: '351.00',
      discount: '1.00',
      total: '350.00',
      amountPaid: '500.00',
      changeDue: '150.00',
      completedAt: new Date('2026-10-25T17:20:00+05:30'),
      items: [
        { productId: 'prod-maggi-noodles', name: 'Maggi 2-Minute Masala Instant Noodles 70g', barcode: '8901058852331', unit: 'PACKET', qty: '4', price: '14.00', cost: '11.80', lineTotal: '56.00' },
        { productId: 'prod-parle-g', name: 'Parle-G Gold Glucose Biscuits 1kg Family Pack', barcode: '8901719114321', unit: 'PACKET', qty: '1', price: '125.00', cost: '112.00', lineTotal: '125.00' },
        { productId: 'prod-dettol-soap', name: 'Dettol Original Bathing Soap 75g (Pack of 4)', barcode: '8901396120448', unit: 'BOX', qty: '1', price: '170.00', cost: '148.00', lineTotal: '170.00' },
      ],
      paymentRef: 'CASH-TILL-01',
    },
  ];

  for (const s of salesHistory) {
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
          createdAt: s.completedAt,
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
              createdAt: s.completedAt,
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
      description: 'Daily helper wage for Guddu Kumar (stock loading and neighborhood deliveries)',
      amount: '450.00',
      occurredAt: new Date('2026-11-01T20:00:00+05:30'),
    },
    {
      category: 'Store Staff Wages',
      description: 'Daily helper wage for Guddu Kumar (stock loading and deliveries)',
      amount: '450.00',
      occurredAt: new Date('2026-10-31T20:00:00+05:30'),
    },
    {
      category: 'Store Staff Wages',
      description: 'Daily helper wage for Guddu Kumar',
      amount: '450.00',
      occurredAt: new Date('2026-10-30T20:00:00+05:30'),
    },
    {
      category: 'Freight & Transportation',
      description: 'Loading tempo freight from APMC Wholesale Grain Mandi to shop',
      amount: '650.00',
      occurredAt: new Date('2026-10-30T16:30:00+05:30'),
    },
    {
      category: 'Packaging & Supplies',
      description: 'Kraft paper brown grocery carry bags & plastic rolls (Bundle of 500)',
      amount: '380.00',
      occurredAt: new Date('2026-10-29T12:00:00+05:30'),
    },
    {
      category: 'Licenses & Maintenance',
      description: 'Annual Municipal Shop & Establishment trade license registration renewal',
      amount: '1200.00',
      occurredAt: new Date('2026-10-25T11:00:00+05:30'),
    },
    {
      category: 'Repair & Servicing',
      description: 'Ice cream and butter deep freezer compressor gas top-up & condenser clean',
      amount: '850.00',
      occurredAt: new Date('2026-10-27T15:00:00+05:30'),
    },
    {
      category: 'Counter Stationery',
      description: 'Thermal billing paper rolls (Box of 10 rolls) for barcode receipt printer',
      amount: '260.00',
      occurredAt: new Date('2026-10-26T16:00:00+05:30'),
    },
  ];

  // Clean old sample expenses and seed realistic timeline
  const existingExpenses = await prisma.expense.count({ where: { storeId: store.id } });
  if (existingExpenses < expensesData.length) {
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
  }

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
