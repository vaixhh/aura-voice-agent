
const policies = {
  shipping: {
    freeShippingAbove: 499,
    shippingFeeBelowOrEqual: 499,
    shippingFee: 50,
    deliveryTime: '3–5 business days'
  },

  returns: {
    allowedWithinDays: 7,
    conditions: [
      'Product must be unopened',
      'Product must be unused',
      'Product must be in its original packaging'
    ]
  },

  damagedProducts: {
    reportWithinHours: 48,
    photoRequired: true,
    resolution: 'Replacement'
  },

  cancellation: {
    allowedStatus: 'Processing',
    notAllowedStatuses: [
      'Shipped',
      'Out for Delivery',
      'Delivered'
    ]
  },

  cashOnDelivery: {
    maximumOrderValue: 2500,
    paymentMethods: ['Cash', 'UPI']
  }
}

module.exports = policies
