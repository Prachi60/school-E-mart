const { BadRequestError } = require('../../../common/errors');
const cartService = require('../../marketplace/services/cart.service');
const productRepository = require('../../marketplace/repositories/product.repository');
const variantRepository = require('../../marketplace/repositories/variant.repository');
const orderAccessPolicy = require('../policies/orderAccess.policy');
const BillingConfig = require('../../../database/models/BillingConfig');
const Kit = require('../../../database/models/Kit');
const { validateAndNormalizeKitSelections } = require('../../marketplace/utils/kitSelection.util');
const {
  getKitPurchaseWindow,
  isKitPurchaseWindowOpen,
  KIT_PURCHASE_WINDOW_CLOSED,
} = require('../../academics/utils/kitPurchaseWindow.util');

// Fallbacks used only if the admin has never saved a BillingConfig. Real values
// come from the admin's Billing & Charges page and are resolved per checkout.
const DEFAULT_DELIVERY_CHARGE_PAISE = 4900; // Default ₹49 delivery charge
const DEFAULT_PLATFORM_FEE_PAISE = 1000; // Default ₹10 platform fee
const DEFAULT_HANDLING_CHARGE_PAISE = 0;

const toNumber = (value) => {
  if (value == null) return 0;
  return Number(value.toString());
};

const checkoutService = {
  resolveAudience(auth, requestedAudience) {
    const roleAudience = orderAccessPolicy.resolveAudience(auth);
    return roleAudience || requestedAudience || 'parent';
  },

  async buildLineItems(cartItems) {
    const lineItems = [];
    for (const item of cartItems) {
      let product = await productRepository.findOne(
        productRepository.findPublishedFilter({ _id: item.productId })
      );
      if (!product) {
        // Cart validation already re-checks this, but checkout must not trust that
        // nothing changed between "added to cart" and "placing the order" — a kit
        // can go from active to draft/deleted/vendor-less in between.
        const kit = await Kit.findOne(Kit.purchasableFilter(item.productId)).lean();
        if (kit) {
          // The admin's sale window can also have closed while the kit sat in
          // the cart — placing the order is the last point it can be caught.
          if (!isKitPurchaseWindowOpen(kit, await getKitPurchaseWindow())) {
            throw new BadRequestError(
              `"${kit.name}" is no longer available — its purchase window has closed.`,
              null,
              KIT_PURCHASE_WINDOW_CLOSED
            );
          }
          // Re-validate the parent's size/color picks against the live kit —
          // the school may have edited or removed an option since it was added
          // to the cart, so the choice made then can no longer be trusted blind.
          const selections = validateAndNormalizeKitSelections(kit, item.kitSelections);
          product = {
            _id: kit._id,
            vendorId: kit.vendorId || null,
            name: kit.name,
            sku: kit.sku || `KIT-${kit._id}`,
            images: [{ alt: kit.imageUrl || '' }],
            stock: 999,
            pricePaise: kit.pricePaise || 0,
            originalPricePaise: kit.mrpPaise || kit.pricePaise || 0,
            taxRatePercent: 0,
            audience: 'schools',
            kitId: kit._id,
            schoolId: kit.schoolId,
            kitCreatedAt: kit.audit?.createdAt || kit.createdAt || null,
            kitItems: (kit.items || []).map((kitItem, index) => ({
              name: kitItem.name,
              category: kitItem.category,
              subcategory: kitItem.subcategory,
              imageUrl: kitItem.imageUrl,
              qty: kitItem.qty,
              attributes: kitItem.attributes,
              selectedSize: selections[index]?.size || null,
              selectedColor: selections[index]?.color || null,
            })),
          };
        }
      }
      if (!product) {
        throw new BadRequestError(`Product unavailable: ${item.productId}`, null, 'CART_ITEM_INVALID');
      }

      let stock = product.stock;
      let pricePaise = product.pricePaise;
      let sku = product.sku;
      if (item.variantId) {
        const variant = await variantRepository.findOne({ _id: item.variantId, productId: item.productId });
        if (!variant) throw new BadRequestError('Variant not found', null, 'CART_VARIANT_INVALID');
        stock = variant.stock;
        pricePaise = variant.pricePaise;
        sku = variant.sku;
      }

      if (stock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for ${product.name}`, null, 'INSUFFICIENT_STOCK');
      }
      if (item.pricePaise !== pricePaise) {
        throw new BadRequestError('Cart item price is outdated', null, 'CART_PRICE_STALE');
      }

      const taxRate = Number(product.taxRatePercent) || 0;
      const lineSubtotal = pricePaise * item.quantity;
      const taxPaise = Math.round((lineSubtotal * taxRate) / 100);

      lineItems.push({
        productId: product._id,
        vendorId: product.vendorId,
        name: product.name,
        sku,
        image: product.images?.[0]?.alt || item.image,
        variantId: item.variantId,
        pricePaise,
        mrpPaise: product.originalPricePaise || pricePaise,
        quantity: item.quantity,
        size: item.size,
        taxRatePercent: taxRate,
        taxPaise,
        lineTotalPaise: lineSubtotal + taxPaise,
        availableStock: stock,
        kitId: product.kitId || null,
        kitSchoolId: product.schoolId || null,
        kitCreatedAt: product.kitCreatedAt || null,
        kitItems: product.kitItems || undefined,
        // Drives the commission split: 'users' = retail, 'schools' = bulk.
        productAudience: product.audience || 'users',
      });
    }
    return lineItems;
  },

  /**
   * Server-authoritative charges. Fees are read from the admin's BillingConfig.
   * School delivery is free ONLY within the configured free days window (default 7 days)
   * after kit creation. Otherwise, the configured school delivery fee applies.
   */
  async resolveCharges(subtotalPaise, deliveryType = 'home', lineItems = []) {
    const config = await BillingConfig.findById('default').lean();
    if (!config) {
      return {
        deliveryChargePaise: (deliveryType === 'school' || deliveryType === 'school_address') ? 0 : DEFAULT_DELIVERY_CHARGE_PAISE,
        platformFeePaise: DEFAULT_PLATFORM_FEE_PAISE,
        handlingChargePaise: DEFAULT_HANDLING_CHARGE_PAISE,
      };
    }

    const platformFeePaise =
      config.platformFeePaise != null && Number(config.platformFeePaise) >= 0
        ? toNumber(config.platformFeePaise)
        : DEFAULT_PLATFORM_FEE_PAISE;
    const freeDeliveryThresholdPaise = toNumber(config.freeDeliveryThresholdPaise);

    const isSchoolDelivery = deliveryType === 'school' || deliveryType === 'school_address';
    let deliveryChargePaise = 0;

    if (isSchoolDelivery) {
      const freeDaysLimit = toNumber(config.schoolDeliveryFreeDays ?? 7);
      const kitItems = (lineItems || []).filter(
        (item) => item.kitId || item.kitCreatedAt || item.productAudience === 'schools'
      );

      let isFreeWindow = true;
      if (kitItems.length > 0) {
        let maxKitAgeDays = 0;
        for (const item of kitItems) {
          let createdAt = item.kitCreatedAt;
          if (!createdAt && item.kitId) {
            const kitDoc = await Kit.findById(item.kitId).lean();
            createdAt = kitDoc?.audit?.createdAt || kitDoc?.createdAt;
          }
          if (createdAt) {
            const ageMs = Date.now() - new Date(createdAt).getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            if (ageDays > maxKitAgeDays) maxKitAgeDays = ageDays;
          }
        }
        isFreeWindow = maxKitAgeDays <= freeDaysLimit;
      }

      if (isFreeWindow) {
        deliveryChargePaise = 0;
      } else {
        deliveryChargePaise =
          config.schoolDeliveryChargePaise != null
            ? toNumber(config.schoolDeliveryChargePaise)
            : (config.fixedDeliveryChargePaise != null ? toNumber(config.fixedDeliveryChargePaise) : DEFAULT_DELIVERY_CHARGE_PAISE);
      }
    } else {
      const fixedCharge =
        config.fixedDeliveryChargePaise != null && Number(config.fixedDeliveryChargePaise) >= 0
          ? toNumber(config.fixedDeliveryChargePaise)
          : DEFAULT_DELIVERY_CHARGE_PAISE;

      const qualifiesForFreeDelivery =
        freeDeliveryThresholdPaise > 0 && subtotalPaise >= freeDeliveryThresholdPaise;
      deliveryChargePaise = qualifiesForFreeDelivery ? 0 : fixedCharge;
    }

    return { deliveryChargePaise, platformFeePaise, handlingChargePaise: DEFAULT_HANDLING_CHARGE_PAISE };
  },

  async computeOrderTotals(lineItems, deliveryType = 'home') {
    const subtotalPaise = lineItems.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
    const taxPaise = lineItems.reduce((sum, item) => sum + item.taxPaise, 0);
    const discountPaise = lineItems.reduce(
      (sum, item) => sum + Math.max(0, (item.mrpPaise - item.pricePaise) * item.quantity),
      0
    );

    const { deliveryChargePaise, platformFeePaise, handlingChargePaise } =
      await this.resolveCharges(subtotalPaise, deliveryType, lineItems);
    const totalPaise =
      subtotalPaise + taxPaise + deliveryChargePaise + platformFeePaise + handlingChargePaise;

    return {
      subtotalPaise,
      taxPaise,
      discountPaise,
      deliveryChargePaise,
      platformFeePaise,
      handlingChargePaise,
      totalPaise,
    };
  },

  validateShipping({ address, deliveryType, schoolIdForPickup }) {
    if (!address?.line1 || !address?.city || !address?.pinCode) {
      throw new BadRequestError('Complete shipping address is required', null, 'ADDRESS_REQUIRED');
    }
    if (deliveryType === 'school' && !schoolIdForPickup) {
      throw new BadRequestError('School pickup requires schoolIdForPickup', null, 'SCHOOL_PICKUP_REQUIRED');
    }
  },

  async validateCheckout(userId, audience, payload = {}, isSummaryOnly = false) {
    const cart = await cartService.getOrCreateCart(userId, audience);
    if (!cart.items?.length) {
      throw new BadRequestError('Cart is empty', null, 'CART_EMPTY');
    }
    await cartService.validateCartItems(cart.items);
    const lineItems = await this.buildLineItems(cart.items);
    if (!isSummaryOnly && (payload.address || payload.deliveryType)) {
      this.validateShipping({
        address: payload.address,
        deliveryType: payload.deliveryType || 'home',
        schoolIdForPickup: payload.schoolIdForPickup,
      });
    }
    return { cart, lineItems, valid: true };
  },

  async getOrderSummary(userId, audience, payload = {}) {
    const deliveryType = payload.deliveryType || (payload.address?.addressType === 'school' ? 'school' : 'home');
    const cart = await cartService.getOrCreateCart(userId, audience);
    if (!cart.items?.length) {
      const { deliveryChargePaise, platformFeePaise, handlingChargePaise } =
        await this.resolveCharges(0, deliveryType);
      return {
        audience,
        itemCount: 0,
        items: [],
        vendorCount: 0,
        subtotalPaise: 0,
        taxPaise: 0,
        discountPaise: 0,
        deliveryChargePaise,
        platformFeePaise,
        handlingChargePaise,
        totalPaise: deliveryChargePaise + platformFeePaise + handlingChargePaise,
        deliveryType,
        address: payload.address || null,
        paymentMethod: payload.paymentMethod || 'cod',
      };
    }
    const { lineItems } = await this.validateCheckout(userId, audience, payload, true);
    const totals = await this.computeOrderTotals(lineItems, deliveryType);
    const vendorIds = [...new Set(lineItems.map((item) => String(item.vendorId)))];

    return {
      audience,
      itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      items: lineItems,
      vendorCount: vendorIds.length,
      ...totals,
      deliveryType,
      address: payload.address || null,
      paymentMethod: payload.paymentMethod || 'cod',
    };
  },
};

module.exports = checkoutService;
