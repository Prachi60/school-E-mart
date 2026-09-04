const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');
const cartRepository = require('../repositories/cart.repository');
const productRepository = require('../repositories/product.repository');
const variantRepository = require('../repositories/variant.repository');
const productService = require('./product.service');
const Kit = require('../../../database/models/Kit');
const { validateAndNormalizeKitSelections } = require('../utils/kitSelection.util');
const {
  getKitPurchaseWindow,
  isKitPurchaseWindowOpen,
  KIT_PURCHASE_WINDOW_CLOSED,
} = require('../../academics/utils/kitPurchaseWindow.util');

// Kit.purchasableFilter can't see the admin's sale window (it needs a settings
// read), so every path that turns a kit into money re-checks it here. A closed
// window has to block the cart too, not just the browse screens — otherwise a
// kit sitting in a cart from before the deadline would still check out.
const assertKitPurchaseWindowOpen = async (kit) => {
  const window = await getKitPurchaseWindow();
  if (!isKitPurchaseWindowOpen(kit, window)) {
    throw new BadRequestError(
      `"${kit.name}" is no longer available — its purchase window has closed.`,
      null,
      KIT_PURCHASE_WINDOW_CLOSED
    );
  }
};

const itemKey = (productId, variantId) => `${productId}:${variantId || 'base'}`;

const computeTotals = (items) => {
  const subtotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const taxPaise = 0;
  const discountPaise = items.reduce(
    (sum, item) => sum + Math.max(0, (item.mrpPaise - item.pricePaise) * item.quantity),
    0
  );
  return {
    subtotalPaise,
    taxPaise,
    discountPaise,
    totalPaise: subtotalPaise + taxPaise,
  };
};

const cartService = {
  itemKey,

  async getOrCreateCart(userId, audience) {
    let cart = await cartRepository.findByUser(userId, audience);
    if (!cart) {
      cart = await cartRepository.upsertCart(userId, audience, {
        items: [],
        subtotalPaise: 0,
        taxPaise: 0,
        discountPaise: 0,
        totalPaise: 0,
      });
    }
    return cart;
  },

  async validateCartItems(items) {
    for (const item of items) {
      let product = await productRepository.findOne(
        productRepository.findPublishedFilter({ _id: item.productId })
      );
      if (!product) {
        const kit = await Kit.findOne(Kit.purchasableFilter(item.productId)).lean();
        if (kit) {
          await assertKitPurchaseWindowOpen(kit);
          const kitImg =
            kit.imageUrl ||
            kit.items?.find((i) => i.imageUrl)?.imageUrl ||
            kit.items?.[0]?.imageUrl ||
            '';
          product = {
            _id: kit._id,
            name: kit.name,
            stock: 999,
            pricePaise: kit.pricePaise || 0,
          };
          if (!item.image && kitImg) {
            item.image = kitImg;
          }
          if (item.name !== kit.name) {
            item.name = kit.name;
          }
        }
      }
      if (!product) throw new BadRequestError(`Product unavailable: ${item.productId}`, null, 'CART_ITEM_INVALID');

      let stock = product.stock;
      let pricePaise = product.pricePaise;
      if (item.variantId) {
        const variant = await variantRepository.findOne({ _id: item.variantId, productId: item.productId });
        if (!variant) throw new BadRequestError('Variant not found', null, 'CART_VARIANT_INVALID');
        stock = variant.stock;
        pricePaise = variant.pricePaise;
      }
      if (stock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for ${product.name}`, null, 'INSUFFICIENT_STOCK');
      }
      if (item.pricePaise !== pricePaise) {
        throw new BadRequestError('Cart item price is outdated', null, 'CART_PRICE_STALE');
      }
    }
    return true;
  },

  async addItem(userId, audience, payload) {
    let product = await productRepository.findOne(
      productRepository.findPublishedFilter({ _id: payload.productId })
    );
    let isKit = false;
    let kitDoc = null;
    if (!product) {
      const kit = await Kit.findOne(Kit.purchasableFilter(payload.productId)).lean();
      if (kit) {
        await assertKitPurchaseWindowOpen(kit);
        isKit = true;
        kitDoc = kit;
        const kitImg =
          kit.imageUrl ||
          kit.items?.find((i) => i.imageUrl)?.imageUrl ||
          kit.items?.[0]?.imageUrl ||
          '';
        product = {
          _id: kit._id,
          name: kit.name,
          stock: 999,
          pricePaise: kit.pricePaise || 0,
          originalPricePaise: kit.mrpPaise || kit.pricePaise || 0,
          sku: kit.sku || `KIT-${kit._id}`,
          imageUrl: kitImg,
          images: [{ url: kitImg, alt: kit.name }],
        };
      }
    }
    if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND');

    // Isolation: a 'parent' (retail) cart may only hold 'users'-audience products,
    // a 'school' (bulk) cart only 'schools'-audience ones. Kits are exempt — they're
    // a separate entity always purchased through the 'parent' channel.
    if (!isKit) {
      const productAudience = product.audience || 'users';
      const expectedAudience = audience === 'school' ? 'schools' : 'users';
      if (productAudience !== expectedAudience) {
        throw new BadRequestError(
          expectedAudience === 'schools'
            ? 'This product is not available for school bulk orders'
            : 'This product is not available in the retail store',
          null,
          'PRODUCT_AUDIENCE_MISMATCH'
        );
      }
    }

    let variant = null;
    let pricePaise = product.pricePaise;
    let stock = product.stock;
    if (payload.variantId) {
      variant = await variantRepository.findOne({ _id: payload.variantId, productId: product._id });
      if (!variant) throw new NotFoundError('Variant not found', 'VARIANT_NOT_FOUND');
      pricePaise = variant.pricePaise;
      stock = variant.stock;
    }

    if (isKit) {
      // Same definition of "already purchased" the kit page uses to decide
      // whether to offer the kit at all — see kits.service.purchasedKitOrderFilter.
      // Any divergence here shows the buyer a live Buy button that then fails.
      const kitsService = require('../../academics/services/kits.service');
      const alreadyPurchased = await kitsService.hasPurchasedKit(userId, product._id);

      if (alreadyPurchased) {
        throw new BadRequestError('You have already purchased this kit.', null, 'KIT_ALREADY_PURCHASED');
      }
    }

    // Every kit item that offers sizes/colors requires an explicit parent
    // choice before it can go in the cart — the vendor needs to know exactly
    // what to pack, not the school's full menu of options.
    const kitSelections = isKit ? validateAndNormalizeKitSelections(kitDoc, payload.kitSelections) : undefined;

    if (stock < payload.quantity) {
      throw new BadRequestError('Insufficient stock', null, 'INSUFFICIENT_STOCK');
    }

    const cart = await this.getOrCreateCart(userId, audience);
    const items = [...(cart.items || [])];
    const index = items.findIndex(
      (item) =>
        String(item.productId) === String(payload.productId) &&
        String(item.variantId || '') === String(payload.variantId || '')
    );

    const itemImage = isKit
      ? product.imageUrl
      : product.images?.[0]?.url || product.images?.[0]?.alt || product.imageUrl || '';

    if (index >= 0) {
      items[index].quantity += payload.quantity;
      if (!items[index].image && itemImage) {
        items[index].image = itemImage;
      }
      if (!items[index].name && product.name) {
        items[index].name = product.name;
      }
      if (isKit) {
        // Re-selecting (e.g. re-adding the same kit) refreshes the choice
        // rather than stacking a second, potentially conflicting one.
        items[index].kitSelections = kitSelections;
      }
    } else {
      items.push({
        productId: product._id,
        variantId: payload.variantId || undefined,
        name: product.name,
        image: itemImage,
        sku: variant?.sku || product.sku,
        pricePaise,
        mrpPaise: product.originalPricePaise || pricePaise,
        quantity: payload.quantity,
        size: payload.size || variant?.attributes?.get?.('size'),
        ...(isKit ? { kitSelections } : {}),
      });
    }

    const totals = computeTotals(items);
    return cartRepository.upsertCart(userId, audience, { items, ...totals });
  },

  async updateItemQuantity(userId, audience, productId, variantId, quantity) {
    if (quantity < 1) throw new BadRequestError('Quantity must be at least 1', null, 'INVALID_QUANTITY');
    const cart = await this.getOrCreateCart(userId, audience);
    const items = [...(cart.items || [])];
    const index = items.findIndex(
      (item) =>
        String(item.productId) === String(productId) &&
        String(item.variantId || '') === String(variantId || '')
    );
    if (index < 0) throw new NotFoundError('Cart item not found', 'CART_ITEM_NOT_FOUND');

    const product = await productRepository.findById(productId);
    let stock = product.stock;
    if (variantId) {
      const variant = await variantRepository.findById(variantId);
      stock = variant?.stock ?? 0;
    }
    if (stock < quantity) throw new BadRequestError('Insufficient stock', null, 'INSUFFICIENT_STOCK');

    items[index].quantity = quantity;
    const totals = computeTotals(items);
    return cartRepository.upsertCart(userId, audience, { items, ...totals });
  },

  async removeItem(userId, audience, productId, variantId) {
    const cart = await this.getOrCreateCart(userId, audience);
    const items = (cart.items || []).filter(
      (item) =>
        !(
          String(item.productId) === String(productId) &&
          String(item.variantId || '') === String(variantId || '')
        )
    );
    const totals = computeTotals(items);
    return cartRepository.upsertCart(userId, audience, { items, ...totals });
  },

  async clearCart(userId, audience) {
    return cartRepository.upsertCart(userId, audience, {
      items: [],
      subtotalPaise: 0,
      taxPaise: 0,
      discountPaise: 0,
      totalPaise: 0,
    });
  },

  async getCartSummary(userId, audience) {
    const cart = await this.getOrCreateCart(userId, audience);
    await this.validateCartItems(cart.items || []);
    return {
      ...cart,
      itemCount: (cart.items || []).reduce((sum, item) => sum + item.quantity, 0),
    };
  },
};

module.exports = cartService;
