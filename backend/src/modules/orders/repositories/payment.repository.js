const mongoose = require('mongoose');
const Payment = require('../../../database/models/Payment');
const { BaseRepository } = require('../../../repositories');
const { executePaginatedQuery } = require('../../../repositories/query');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment, { useSoftDelete: false });
  }

  findByOrderId(orderId, queryOptions = {}) {
    return this.findOne({ orderId }, queryOptions);
  }

  findByIdempotencyKey(key) {
    return this.findOne({ idempotencyKey: key });
  }

  /**
   * Total money actually captured against one order, in paise.
   *
   * The authority on whether an order is paid. Deciding that from the request body —
   * or from the mere existence of a Payment row — is what let an unpaid online order
   * be treated as paid; only a captured payment counts, and an RFQ order's advance and
   * remainder both count towards the same total.
   */
  async sumCapturedForOrder(orderId) {
    const [row] = await Payment.aggregate([
      { $match: { orderId: new mongoose.Types.ObjectId(String(orderId)), status: 'captured' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]);
    return row?.total || 0;
  }

  async paginateByOrder(orderId, queryString = {}) {
    return executePaginatedQuery(this.model, { orderId }, queryString, {
      defaultSort: '-audit.createdAt',
    });
  }
}

module.exports = new PaymentRepository();
