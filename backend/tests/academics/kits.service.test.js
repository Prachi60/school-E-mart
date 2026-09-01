const mongoose = require('mongoose');
const kitsService = require('../../src/modules/academics/services/kits.service');
const Kit = require('../../src/database/models/Kit');
const Order = require('../../src/database/models/Order');
const ChildProfile = require('../../src/database/models/ChildProfile');
const { generateOrderNumber } = require('../../src/modules/orders/utils/orderNumber');
const { createParentUser } = require('../orders/helpers');
const PlatformSettings = require('../../src/database/models/PlatformSettings');
const {
  invalidateKitPurchaseWindowCache,
} = require('../../src/modules/academics/utils/kitPurchaseWindow.util');

const baseItems = [{ name: 'Notebook', category: 'Stationary', qty: 5 }];

describe('kitsService', () => {
  let schoolId;
  let vendorId;

  beforeEach(() => {
    schoolId = new mongoose.Types.ObjectId();
    vendorId = new mongoose.Types.ObjectId();
  });

  describe('vendor-required-before-going-live', () => {
    test('createKit rejects an active kit with no vendor', async () => {
      await expect(
        kitsService.createKit(schoolId, { name: 'No Vendor Kit', items: baseItems, status: 'active' })
      ).rejects.toMatchObject({ code: 'KIT_VENDOR_REQUIRED' });
    });

    test('createKit allows a draft kit with no vendor', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Draft Kit', items: baseItems, status: 'draft',
      });
      expect(kit.status).toBe('draft');
      expect(kit.vendorId).toBeNull();
    });

    test('createKit allows an active kit once a vendor is assigned', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Vendored Kit', items: baseItems, status: 'active', vendorId,
      });
      expect(kit.status).toBe('active');
      expect(String(kit.vendorId)).toBe(String(vendorId));
    });

    test('updateKit rejects removing the vendor from a kit that stays active', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Vendored Kit', items: baseItems, status: 'active', vendorId,
      });

      // Not touching status at all — the kit is already active, so this must still
      // be checked, not just an explicit status:'active' in the payload.
      await expect(
        kitsService.updateKit(schoolId, kit._id, { vendorId: null })
      ).rejects.toMatchObject({ code: 'KIT_VENDOR_REQUIRED' });
    });

    test('updateKit rejects publishing a draft that has no vendor', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Draft Kit', items: baseItems, status: 'draft',
      });

      await expect(
        kitsService.updateKit(schoolId, kit._id, { status: 'active' })
      ).rejects.toMatchObject({ code: 'KIT_VENDOR_REQUIRED' });
    });

    test('updateKit allows publishing a draft when a vendor is supplied in the same update', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Draft Kit', items: baseItems, status: 'draft',
      });

      const updated = await kitsService.updateKit(schoolId, kit._id, { status: 'active', vendorId });
      expect(updated.status).toBe('active');
      expect(String(updated.vendorId)).toBe(String(vendorId));
    });

    test('updateKit leaves an already-vendored active kit alone when neither field changes', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Vendored Kit', items: baseItems, status: 'active', vendorId,
      });

      const updated = await kitsService.updateKit(schoolId, kit._id, { description: 'Updated blurb' });
      expect(updated.status).toBe('active');
      expect(String(updated.vendorId)).toBe(String(vendorId));
      expect(updated.description).toBe('Updated blurb');
    });
  });

  describe('draft/deleted kit visibility', () => {
    let draftKit;
    let activeKit;

    beforeEach(async () => {
      draftKit = await kitsService.createKit(schoolId, {
        name: 'Draft Kit', items: baseItems, status: 'draft',
      });
      activeKit = await kitsService.createKit(schoolId, {
        name: 'Active Kit', items: baseItems, status: 'active', vendorId,
      });
    });

    test('getKit with requireActive hides a draft kit', async () => {
      await expect(
        kitsService.getKit(schoolId, draftKit._id, { requireActive: true })
      ).rejects.toMatchObject({ code: 'KIT_NOT_FOUND' });
    });

    test('getKit with requireActive still returns an active kit', async () => {
      const kit = await kitsService.getKit(schoolId, activeKit._id, { requireActive: true });
      expect(String(kit._id)).toBe(String(activeKit._id));
    });

    test('getKit without requireActive (management view) returns the draft', async () => {
      const kit = await kitsService.getKit(schoolId, draftKit._id);
      expect(kit.status).toBe('draft');
    });

    test('listKits with requireActive excludes drafts even if the caller asks for them', async () => {
      const { data } = await kitsService.listKits(schoolId, { status: 'draft' }, { requireActive: true });
      expect(data.map((k) => String(k._id))).not.toContain(String(draftKit._id));
      expect(data.map((k) => String(k._id))).toEqual([String(activeKit._id)]);
    });

    test('listKits without requireActive respects the caller-supplied status filter', async () => {
      const { data } = await kitsService.listKits(schoolId, { status: 'draft' });
      expect(data.map((k) => String(k._id))).toEqual([String(draftKit._id)]);
    });
  });

  describe('kit sale window', () => {
    let buyer;

    // The window setting is cached in-process, and setup.js wipes every
    // collection between tests — so the cache has to be dropped on both sides
    // of a test or one test's setting leaks into the next.
    const setWindow = async (settings) => {
      await PlatformSettings.findByIdAndUpdate(
        'default',
        { $set: { kits: settings } },
        { upsert: true, new: true }
      );
      invalidateKitPurchaseWindowCache();
    };

    // Backdates a kit's publish date so its window has (or hasn't) run out,
    // without waiting days for it.
    const publishedDaysAgo = async (kit, days) => {
      await Kit.updateOne(
        { _id: kit._id },
        { $set: { publishedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
      );
    };

    const buyKit = async (userId, kit) =>
      Order.create({
        orderNumber: generateOrderNumber(),
        userId,
        audience: 'parent',
        items: [{
          productId: kit._id,
          vendorId,
          kitId: kit._id,
          schoolId,
          name: kit.name,
          sku: kit.sku,
          pricePaise: kit.pricePaise,
          mrpPaise: kit.mrpPaise,
          quantity: 1,
          taxPaise: 0,
          lineTotalPaise: kit.pricePaise,
        }],
        subtotalPaise: kit.pricePaise,
        taxPaise: 0,
        discountPaise: 0,
        totalPaise: kit.pricePaise,
        address: { line1: 'Line 1', city: 'City', state: 'State', country: 'India', pinCode: '110001' },
        deliveryType: 'home',
        paymentMethod: 'online',
        paymentStatus: 'paid',
        orderStatus: 'placed',
      });

    const makeActiveKit = (name = 'Window Kit') =>
      kitsService.createKit(schoolId, { name, items: baseItems, status: 'active', vendorId });

    beforeEach(async () => {
      invalidateKitPurchaseWindowCache();
      buyer = await createParentUser();
    });

    afterEach(() => {
      invalidateKitPurchaseWindowCache();
    });

    test('createKit stamps publishedAt only when the kit actually goes live', async () => {
      const draft = await kitsService.createKit(schoolId, {
        name: 'Unpublished', items: baseItems, status: 'draft',
      });
      const live = await makeActiveKit();

      expect(draft.publishedAt).toBeNull();
      expect(live.publishedAt).toBeInstanceOf(Date);
    });

    test('updateKit starts the window when a draft is published', async () => {
      const draft = await kitsService.createKit(schoolId, {
        name: 'Later', items: baseItems, status: 'draft',
      });

      const published = await kitsService.updateKit(schoolId, draft._id, { status: 'active', vendorId });
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    test('editing an already-live kit does not restart its window', async () => {
      const kit = await makeActiveKit();
      await publishedDaysAgo(kit, 10);

      await kitsService.updateKit(schoolId, kit._id, { description: 'Edited' });

      const stored = await Kit.findById(kit._id).select('publishedAt').lean();
      expect(Date.now() - stored.publishedAt.getTime()).toBeGreaterThan(9 * 24 * 60 * 60 * 1000);
    });

    test('a caller cannot set publishedAt itself to buy back a closed window', async () => {
      const kit = await makeActiveKit();
      await publishedDaysAgo(kit, 30);

      await kitsService.updateKit(schoolId, kit._id, { publishedAt: new Date() });

      const stored = await Kit.findById(kit._id).select('publishedAt').lean();
      expect(Date.now() - stored.publishedAt.getTime()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });

    test('listKits hides a closed-window kit from a parent who never bought it', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      const fresh = await makeActiveKit('Fresh Kit');
      await publishedDaysAgo(expired, 8);
      await publishedDaysAgo(fresh, 2);

      const { data, pagination } = await kitsService.listKits(
        schoolId, {}, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );

      expect(data.map((k) => String(k._id))).toEqual([String(fresh._id)]);
      // The filter has to be applied in the query, not to the results, or the
      // pagination total contradicts what actually came back.
      expect(pagination.total).toBe(1);
    });

    test('listKits keeps a closed-window kit visible to the parent who already bought it', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);
      await buyKit(buyer._id, expired);

      const { data } = await kitsService.listKits(
        schoolId, {}, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      expect(data.map((k) => String(k._id))).toEqual([String(expired._id)]);
    });

    test('listKits leaves everything visible while the window is switched off', async () => {
      await setWindow({ purchaseWindowEnabled: false, purchaseWindowDays: 7 });
      const ancient = await makeActiveKit('Ancient Kit');
      await publishedDaysAgo(ancient, 400);

      const { data } = await kitsService.listKits(
        schoolId, {}, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      expect(data.map((k) => String(k._id))).toEqual([String(ancient._id)]);
    });

    test('the management view still sees a kit whose window has closed', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);

      const { data } = await kitsService.listKits(schoolId, {});
      expect(data.map((k) => String(k._id))).toEqual([String(expired._id)]);
    });

    test('the school is told the deadline on its own kits, without them being hidden', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);

      const { data } = await kitsService.listKits(schoolId, {});
      expect(data).toHaveLength(1);
      expect(data[0].purchaseWindow).toMatchObject({ enabled: true, expired: true });
      expect(data[0].purchaseWindow.endsAt).toEqual(expect.any(String));
    });

    test('the purchase report explains that the window has closed', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);

      const report = await kitsService.getKitPurchaseReport(schoolId, expired._id);
      expect(report.kit.purchaseWindow).toMatchObject({ enabled: true, expired: true });
    });

    test('a teacher/vendor reading kits for reference is not subject to the window', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);

      // requireActive without applyPurchaseWindow: they still only see
      // published kits, but the sale deadline is a parent-purchase rule and
      // doesn't take the kit away from them.
      const { data } = await kitsService.listKits(schoolId, {}, { requireActive: true });
      expect(data.map((k) => String(k._id))).toEqual([String(expired._id)]);
    });

    test('a kit published before publishedAt existed falls back to its creation date', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const legacy = await makeActiveKit('Legacy Kit');
      await Kit.updateOne(
        { _id: legacy._id },
        {
          $unset: { publishedAt: '' },
          $set: { 'audit.createdAt': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }
      );

      const { data } = await kitsService.listKits(
        schoolId, {}, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      expect(data).toHaveLength(0);
    });

    test('getKit refuses a closed-window kit even when the parent knows its id', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);

      await expect(
        kitsService.getKit(schoolId, expired._id, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id })
      ).rejects.toMatchObject({ code: 'KIT_PURCHASE_WINDOW_CLOSED' });
    });

    test('getKit still serves a closed-window kit to the parent who bought it', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const expired = await makeActiveKit('Expired Kit');
      await publishedDaysAgo(expired, 8);
      await buyKit(buyer._id, expired);

      const kit = await kitsService.getKit(
        schoolId, expired._id, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      expect(String(kit._id)).toBe(String(expired._id));
    });

    test('parents get the deadline their countdown runs off', async () => {
      await setWindow({ purchaseWindowEnabled: true, purchaseWindowDays: 7 });
      const kit = await makeActiveKit();
      await publishedDaysAgo(kit, 2);

      const detail = await kitsService.getKit(
        schoolId, kit._id, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      const daysLeft = (new Date(detail.purchaseWindow.endsAt) - Date.now()) / (24 * 60 * 60 * 1000);

      expect(detail.purchaseWindow.enabled).toBe(true);
      expect(detail.purchaseWindow.expired).toBe(false);
      // Both ends, so the card can draw how much of the window is already gone.
      expect(new Date(detail.purchaseWindow.endsAt) - new Date(detail.purchaseWindow.startsAt))
        .toBe(7 * 24 * 60 * 60 * 1000);
      expect(daysLeft).toBeGreaterThan(4.9);
      expect(daysLeft).toBeLessThan(5.1);
    });

    test('no deadline is published while the admin has the window switched off', async () => {
      await setWindow({ purchaseWindowEnabled: false, purchaseWindowDays: 7 });
      const kit = await makeActiveKit();

      const detail = await kitsService.getKit(
        schoolId, kit._id, { requireActive: true, applyPurchaseWindow: true, viewerUserId: buyer._id }
      );
      expect(detail.purchaseWindow).toMatchObject({ enabled: false, endsAt: null, startsAt: null });
    });
  });

  describe('Kit.purchasableFilter', () => {
    test('matches only an active, non-deleted kit with a vendor assigned', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Purchasable Kit', items: baseItems, status: 'active', vendorId,
      });

      const found = await Kit.findOne(Kit.purchasableFilter(kit._id)).lean();
      expect(found).not.toBeNull();
    });

    test('excludes a draft kit', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Draft', items: baseItems, status: 'draft' });
      const found = await Kit.findOne(Kit.purchasableFilter(kit._id)).lean();
      expect(found).toBeNull();
    });

    test('excludes a soft-deleted kit even though it was active', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'To Delete', items: baseItems, status: 'active', vendorId,
      });
      await kitsService.deleteKit(schoolId, kit._id, new mongoose.Types.ObjectId());

      const found = await Kit.findOne(Kit.purchasableFilter(kit._id)).lean();
      expect(found).toBeNull();
    });

    test('excludes an active kit with no vendor assigned', async () => {
      // Bypasses the service's own guard to simulate legacy/inconsistent data.
      const kit = await Kit.create({
        name: 'Legacy Vendorless Kit',
        slug: `legacy-vendorless-${Date.now()}`,
        items: baseItems,
        pricePaise: 1000,
        mrpPaise: 1000,
        status: 'active',
        vendorId: null,
      });

      const found = await Kit.findOne(Kit.purchasableFilter(kit._id)).lean();
      expect(found).toBeNull();
    });
  });

  describe('sales / purchase reporting', () => {
    const makeOrder = async ({ userId, kit, orderStatus = 'placed', paymentStatus = 'paid', paymentMethod = 'online' }) =>
      Order.create({
        orderNumber: generateOrderNumber(),
        userId,
        audience: 'parent',
        items: [{
          productId: kit._id,
          vendorId,
          kitId: kit._id,
          schoolId,
          name: kit.name,
          sku: kit.sku,
          pricePaise: kit.pricePaise,
          mrpPaise: kit.mrpPaise,
          quantity: 1,
          taxPaise: 0,
          lineTotalPaise: kit.pricePaise,
        }],
        subtotalPaise: kit.pricePaise,
        taxPaise: 0,
        discountPaise: 0,
        totalPaise: kit.pricePaise,
        address: { line1: 'Line 1', city: 'City', state: 'State', country: 'India', pinCode: '110001' },
        deliveryType: 'home',
        paymentMethod,
        paymentStatus,
        orderStatus,
      });

    test('getSalesCounts / listKits report how many non-cancelled orders bought each kit', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Popular Kit', items: baseItems, status: 'active', vendorId,
      });
      const buyerA = await createParentUser();
      const buyerB = await createParentUser();
      await makeOrder({ userId: buyerA._id, kit });
      await makeOrder({ userId: buyerB._id, kit });
      // Cancelled purchases don't count towards sales.
      await makeOrder({ userId: buyerA._id, kit, orderStatus: 'cancelled' });

      const { data } = await kitsService.listKits(schoolId, {});
      const row = data.find((k) => String(k._id) === String(kit._id));
      expect(row.salesCount).toBe(2);
    });

    test('listKits tells the school how many eligible students have not bought each kit', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Class 5 Kit', items: baseItems, status: 'active', vendorId, classGrade: 'Class 5',
      });
      const buyer = await createParentUser();
      const nonBuyer = await createParentUser();
      await ChildProfile.create([
        { schoolId, parentUserId: buyer._id, name: 'Bought Child', grade: 'Class 5' },
        { schoolId, parentUserId: nonBuyer._id, name: 'Pending Child', grade: 'Class 5' },
        // Different class — this kit isn't for them, so they must not count
        // as a student who is missing it.
        { schoolId, parentUserId: nonBuyer._id, name: 'Other Class Child', grade: 'Class 6' },
      ]);
      await makeOrder({ userId: buyer._id, kit });

      const { data } = await kitsService.listKits(schoolId, {});
      const row = data.find((k) => String(k._id) === String(kit._id));

      expect(row.coverage).toEqual({ eligibleCount: 2, purchasedCount: 1, pendingCount: 1 });
    });

    test('coverage counts on the list match the names inside the report', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'All Classes Kit', items: baseItems, status: 'active', vendorId,
      });
      const buyer = await createParentUser();
      const nonBuyer = await createParentUser();
      await ChildProfile.create([
        { schoolId, parentUserId: buyer._id, name: 'A', grade: 'Class 1' },
        { schoolId, parentUserId: nonBuyer._id, name: 'B', grade: 'Class 2' },
        { schoolId, parentUserId: nonBuyer._id, name: 'C', grade: 'Class 3' },
      ]);
      await makeOrder({ userId: buyer._id, kit });

      const { data } = await kitsService.listKits(schoolId, {});
      const row = data.find((k) => String(k._id) === String(kit._id));
      const report = await kitsService.getKitPurchaseReport(schoolId, kit._id);

      expect(row.coverage.pendingCount).toBe(report.notPurchasedCount);
      expect(row.coverage.purchasedCount).toBe(report.purchasedChildrenCount);
      expect(row.coverage.eligibleCount).toBe(report.totalEligibleChildren);
    });

    test('a cancelled order does not count as coverage', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Cancelled Kit', items: baseItems, status: 'active', vendorId,
      });
      const parent = await createParentUser();
      await ChildProfile.create({ schoolId, parentUserId: parent._id, name: 'Child', grade: 'Class 1' });
      await makeOrder({ userId: parent._id, kit, orderStatus: 'cancelled' });

      const { data } = await kitsService.listKits(schoolId, {});
      const row = data.find((k) => String(k._id) === String(kit._id));

      expect(row.coverage).toEqual({ eligibleCount: 1, purchasedCount: 0, pendingCount: 1 });
    });

    test('parents are not served the coverage figures', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Parent View Kit', items: baseItems, status: 'active', vendorId,
      });
      const parent = await createParentUser();
      await ChildProfile.create({ schoolId, parentUserId: parent._id, name: 'Child', grade: 'Class 1' });

      const { data } = await kitsService.listKits(
        schoolId, {}, { requireActive: true, applyPurchaseWindow: true, viewerUserId: parent._id }
      );
      const row = data.find((k) => String(k._id) === String(kit._id));

      expect(row.coverage).toBeUndefined();
      expect(row.salesCount).toBeUndefined();
    });

    test('getKitPurchaseReport lists who bought and who (in the target class) has not', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'Class 5 Kit', classGrade: 'Class 5', items: baseItems, status: 'active', vendorId,
      });
      const buyer = await createParentUser();
      const nonBuyer = await createParentUser();
      await makeOrder({ userId: buyer._id, kit });

      await ChildProfile.create({ parentUserId: buyer._id, name: 'Bought Child', schoolId, grade: 'Class 5' });
      await ChildProfile.create({ parentUserId: nonBuyer._id, name: 'Waiting Child', schoolId, grade: 'Class 5' });
      // A different grade must not count towards this kit's coverage.
      await ChildProfile.create({ parentUserId: nonBuyer._id, name: 'Other Grade Child', schoolId, grade: 'Class 6' });

      const report = await kitsService.getKitPurchaseReport(schoolId, kit._id);
      expect(report.totalOrders).toBe(1);
      expect(report.totalEligibleChildren).toBe(2);
      expect(report.purchasedChildrenCount).toBe(1);
      expect(report.notPurchasedCount).toBe(1);
      expect(report.purchasedChildren[0].name).toBe('Bought Child');
      expect(report.notPurchased[0].name).toBe('Waiting Child');
    });

    test('getKitPurchaseReport scopes to every child at the school when the kit has no target class', async () => {
      const kit = await kitsService.createKit(schoolId, {
        name: 'All-Class Kit', items: baseItems, status: 'active', vendorId,
      });
      const nonBuyer = await createParentUser();
      await ChildProfile.create({ parentUserId: nonBuyer._id, name: 'Any Grade Child', schoolId, grade: 'Class 3' });

      const report = await kitsService.getKitPurchaseReport(schoolId, kit._id);
      expect(report.totalEligibleChildren).toBe(1);
      expect(report.notPurchasedCount).toBe(1);
    });
  });

  describe('listPurchasedKitIds (progress bar source of truth)', () => {
    const makeKitOrder = async ({ userId, kit, orderStatus = 'placed', paymentStatus = 'paid', paymentMethod = 'online' }) =>
      Order.create({
        orderNumber: generateOrderNumber(),
        userId,
        audience: 'parent',
        items: [{
          productId: kit._id,
          vendorId,
          kitId: kit._id,
          schoolId,
          name: kit.name,
          sku: kit.sku,
          pricePaise: kit.pricePaise,
          mrpPaise: kit.mrpPaise,
          quantity: 1,
          taxPaise: 0,
          lineTotalPaise: kit.pricePaise,
        }],
        subtotalPaise: kit.pricePaise,
        taxPaise: 0,
        discountPaise: 0,
        totalPaise: kit.pricePaise,
        address: { line1: 'Line 1', city: 'City', state: 'State', country: 'India', pinCode: '110001' },
        deliveryType: 'home',
        paymentMethod,
        paymentStatus,
        orderStatus,
      });

    test('returns no kits when the school has none configured', async () => {
      const buyer = await createParentUser();
      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([]);
    });

    test('an unpaid online order does not count as purchased', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      await makeKitOrder({ userId: buyer._id, kit, paymentStatus: 'pending', paymentMethod: 'online' });

      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([]);
    });

    test('a placed COD order counts as purchased even before payment is collected', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      await makeKitOrder({ userId: buyer._id, kit, paymentStatus: 'pending', paymentMethod: 'cod' });

      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([String(kit._id)]);
    });

    test('a cancelled order does not count, even if it was paid', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      await makeKitOrder({ userId: buyer._id, kit, orderStatus: 'cancelled' });

      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([]);
    });

    test("one parent's purchase never counts for another parent", async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      const otherParent = await createParentUser();
      await makeKitOrder({ userId: buyer._id, kit });

      const purchased = await kitsService.listPurchasedKitIds(otherParent._id, schoolId);
      expect(purchased).toEqual([]);
    });

    test('stays correct even when the parent has 100+ unrelated orders — not bounded by order-list pagination', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      // The kit purchase happens first — a naive "scan the latest 100 orders"
      // approach would push it off the page once enough newer orders exist.
      await makeKitOrder({ userId: buyer._id, kit });
      for (let i = 0; i < 100; i += 1) {
        await Order.create({
          orderNumber: generateOrderNumber(),
          userId: buyer._id,
          audience: 'parent',
          items: [{
            productId: new mongoose.Types.ObjectId(),
            vendorId,
            name: `Unrelated item ${i}`,
            sku: `SKU-${i}`,
            pricePaise: 1000,
            mrpPaise: 1000,
            quantity: 1,
            taxPaise: 0,
            lineTotalPaise: 1000,
          }],
          subtotalPaise: 1000,
          taxPaise: 0,
          discountPaise: 0,
          totalPaise: 1000,
          address: { line1: 'Line 1', city: 'City', state: 'State', country: 'India', pinCode: '110001' },
          deliveryType: 'home',
          paymentMethod: 'online',
          paymentStatus: 'paid',
          orderStatus: 'placed',
        });
      }

      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([String(kit._id)]);
    });

    test('a draft kit never counts towards the purchased set even if somehow ordered', async () => {
      const kit = await kitsService.createKit(schoolId, { name: 'Kit', items: baseItems, status: 'active', vendorId });
      const buyer = await createParentUser();
      await makeKitOrder({ userId: buyer._id, kit });
      // School un-publishes the kit after the purchase.
      await kitsService.updateKit(schoolId, kit._id, { status: 'draft' });

      const purchased = await kitsService.listPurchasedKitIds(buyer._id, schoolId);
      expect(purchased).toEqual([]);
    });
  });
});
