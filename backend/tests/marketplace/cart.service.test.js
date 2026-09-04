const mongoose = require('mongoose');
const cartService = require('../../src/modules/marketplace/services/cart.service');
const productService = require('../../src/modules/marketplace/services/product.service');
const taxonomyService = require('../../src/modules/marketplace/services/taxonomy.service');
const kitsService = require('../../src/modules/academics/services/kits.service');
const VendorProfile = require('../../src/database/models/VendorProfile');
const Kit = require('../../src/database/models/Kit');
const Order = require('../../src/database/models/Order');

describe('cartService', () => {
  let userId;
  let productId;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    const header = await taxonomyService.createHeaderCategory({ name: 'Books' });
    const category = await taxonomyService.createCategory({ headerId: header._id, name: 'Textbooks' });
    const vendor = await VendorProfile.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Book Vendor',
      storeSlug: 'book-vendor',
      commissionPercent: 5,
      approvalStatus: 'approved',
      address: {
        line1: 'Line 1',
        city: 'City',
        state: 'State',
        country: 'India',
        pinCode: '110001',
      },
      location: { type: 'Point', coordinates: [77.2, 28.6] },
      serviceRadiusKm: 10,
    });

    const product = await productService.createProduct(vendor._id, {
      name: 'Math Book',
      sku: 'BOOK-001',
      headerId: header._id,
      categoryId: category._id,
      pricePaise: 25000,
      images: [{ attachmentId: new mongoose.Types.ObjectId() }],
      approvalStatus: 'approved',
      publishStatus: 'published',
      stock: 20,
    });
    productId = product._id;
  });

  test('adds, updates, and clears cart without duplicate variant entries', async () => {
    await cartService.addItem(userId, 'parent', { productId, quantity: 1 });
    const updated = await cartService.addItem(userId, 'parent', { productId, quantity: 2 });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].quantity).toBe(3);

    const cart = await cartService.updateItemQuantity(userId, 'parent', productId, null, 2);
    expect(cart.items[0].quantity).toBe(2);

    const summary = await cartService.getCartSummary(userId, 'parent');
    expect(summary.itemCount).toBe(2);
    expect(summary.totalPaise).toBe(50000);

    const cleared = await cartService.clearCart(userId, 'parent');
    expect(cleared.items).toHaveLength(0);
  });

  describe('kit purchasability', () => {
    let schoolId;
    let vendorId;
    const kitItems = [{ name: 'Notebook', category: 'Stationary', qty: 5 }];

    beforeEach(() => {
      schoolId = new mongoose.Types.ObjectId();
      vendorId = new mongoose.Types.ObjectId();
    });

    test('an active, vendored kit can be added to cart', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Class 5 Kit', items: kitItems, status: 'active', vendorId, pricePaise: 50000,
      });

      const cart = await cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].pricePaise).toBe(50000);
    });

    test('a draft kit cannot be added to cart', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Draft Kit', items: kitItems, status: 'draft',
      });

      await expect(
        cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    test('a soft-deleted kit cannot be added to cart even though it was active', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Deleted Kit', items: kitItems, status: 'active', vendorId,
      });
      await kitsService.deleteKit(schoolId, kit._id, new mongoose.Types.ObjectId());

      await expect(
        cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    test('an item with size/color options requires a matching selection', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Uniform Kit',
        status: 'active',
        vendorId,
        items: [{
          name: 'Shirt',
          category: 'Uniform',
          qty: 1,
          attributes: { sizes: ['S', 'M', 'L'], colors: ['White', 'Sky Blue'] },
        }],
      });

      await expect(
        cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
      ).rejects.toMatchObject({ code: 'KIT_SIZE_REQUIRED' });

      await expect(
        cartService.addItem(userId, 'parent', {
          productId: kit._id,
          quantity: 1,
          kitSelections: [{ itemIndex: 0, size: 'M' }],
        })
      ).rejects.toMatchObject({ code: 'KIT_COLOR_REQUIRED' });

      await expect(
        cartService.addItem(userId, 'parent', {
          productId: kit._id,
          quantity: 1,
          kitSelections: [{ itemIndex: 0, size: 'XXL', color: 'White' }],
        })
      ).rejects.toMatchObject({ code: 'KIT_INVALID_SIZE' });

      const cart = await cartService.addItem(userId, 'parent', {
        productId: kit._id,
        quantity: 1,
        kitSelections: [{ itemIndex: 0, size: 'M', color: 'White' }],
      });
      expect(cart.items[0].kitSelections).toEqual([
        expect.objectContaining({ itemIndex: 0, size: 'M', color: 'White' }),
      ]);
    });

    test('an item with no size/color options needs no selection at all', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Stationary Kit', items: kitItems, status: 'active', vendorId, pricePaise: 1000,
      });

      const cart = await cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 });
      expect(cart.items[0].kitSelections).toEqual([
        expect.objectContaining({ itemIndex: 0 }),
      ]);
      expect(cart.items[0].kitSelections[0].size).toBeUndefined();
      expect(cart.items[0].kitSelections[0].color).toBeUndefined();
    });

    test('an active kit with no vendor cannot be added to cart', async () => {
      // Bypasses the service's own create-time guard to simulate legacy data.
      const kit = await Kit.create({
        name: 'Vendorless Kit',
        slug: `vendorless-${Date.now()}`,
        items: kitItems,
        pricePaise: 1000,
        mrpPaise: 1000,
        status: 'active',
        vendorId: null,
      });

      await expect(
        cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    describe('already-purchased guard', () => {
      const seedKitOrder = async (kitId, overrides) =>
        Order.create({
          orderNumber: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
          userId,
          audience: 'parent',
          items: [{
            productId: kitId,
            kitId,
            vendorId,
            name: 'Class 5 Kit',
            sku: `KIT-${kitId}`,
            pricePaise: 50000,
            mrpPaise: 50000,
            quantity: 1,
            taxPaise: 0,
            lineTotalPaise: 50000,
          }],
          vendorIds: [vendorId],
          subtotalPaise: 50000,
          taxPaise: 0,
          discountPaise: 0,
          platformFeePaise: 0,
          deliveryChargePaise: 0,
          handlingChargePaise: 0,
          totalPaise: 50000,
          address: { line1: 'Test' },
          deliveryType: 'home',
          statusHistory: [{ status: 'placed', at: new Date() }],
          placedAt: new Date(),
          ...overrides,
        });

      const makeKit = () =>
        kitsService.createKit(schoolId, {
          name: 'Class 5 Kit', items: kitItems, status: 'active', vendorId, pricePaise: 50000,
        });

      test('a paid order blocks buying the same kit again', async () => {
        const kit = await makeKit();
        await seedKitOrder(kit._id, { paymentMethod: 'online', paymentStatus: 'paid', orderStatus: 'placed' });

        await expect(
          cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
        ).rejects.toMatchObject({ code: 'KIT_ALREADY_PURCHASED' });
      });

      test('a COD order blocks buying the same kit again', async () => {
        const kit = await makeKit();
        await seedKitOrder(kit._id, { paymentMethod: 'cod', paymentStatus: 'pending', orderStatus: 'placed' });

        await expect(
          cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
        ).rejects.toMatchObject({ code: 'KIT_ALREADY_PURCHASED' });
      });

      // Regression: an online order whose money never arrived is not a purchase.
      // The kit page (hasPurchasedKit) has always agreed, so blocking here left
      // the buyer staring at a live Buy button that failed every time.
      test('an unpaid online order does NOT block buying the kit', async () => {
        const kit = await makeKit();
        await seedKitOrder(kit._id, { paymentMethod: 'online', paymentStatus: 'pending', orderStatus: 'placed' });

        const cart = await cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 });
        expect(cart.items).toHaveLength(1);
        expect(await kitsService.hasPurchasedKit(userId, kit._id)).toBe(false);
      });

      test('the buy guard and the kit page always agree', async () => {
        const kit = await makeKit();
        await seedKitOrder(kit._id, { paymentMethod: 'online', paymentStatus: 'pending', orderStatus: 'delivered' });

        // Page says not purchased, so adding to cart must succeed.
        expect(await kitsService.hasPurchasedKit(userId, kit._id)).toBe(false);
        await expect(
          cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 })
        ).resolves.toBeDefined();
      });

      test('a cancelled order never blocks', async () => {
        const kit = await makeKit();
        await seedKitOrder(kit._id, { paymentMethod: 'online', paymentStatus: 'paid', orderStatus: 'cancelled' });

        const cart = await cartService.addItem(userId, 'parent', { productId: kit._id, quantity: 1 });
        expect(cart.items).toHaveLength(1);
      });
    });
  });
});
