import { useEffect, useMemo, useState } from 'react';
import { getCheckoutSummary } from '../services/ordersApi';
import { getErrorMessage } from '../utils/apiHelpers';
import {
  buildCheckoutPayload,
  summaryTotalsToDisplay,
} from '../utils/mappers/orderMapper';
import { useCart } from '../app/context/CartContext';

export const useCheckoutSummary = ({
  deliveryType,
  paymentMethod,
  addressSource,
  schoolIdForPickup,
  gstin,
  audience,
  enabled = true,
}) => {
  const { cartItems } = useCart();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Key the fetch on the address *contents*, not the object's identity. Callers
  // routinely build this inline or memoize it against a parent object, so
  // depending on the reference re-fetched the summary on every render.
  const addressKey = JSON.stringify(addressSource || {});
  const stableAddressSource = useMemo(() => JSON.parse(addressKey), [addressKey]);

  useEffect(() => {
    if (!enabled || !cartItems.length) {
      setSummary(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getCheckoutSummary(
      buildCheckoutPayload({
        deliveryType,
        paymentMethod,
        addressSource: stableAddressSource,
        schoolIdForPickup,
        gstin,
      }),
      { audience }
    )
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null);
          setError(getErrorMessage(err, 'Unable to load checkout summary'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    cartItems.length,
    deliveryType,
    paymentMethod,
    schoolIdForPickup,
    gstin,
    audience,
    stableAddressSource,
  ]);

  return {
    summary,
    loading,
    error,
    totals: summaryTotalsToDisplay(summary),
    buildPayload: () =>
      buildCheckoutPayload({
        deliveryType,
        paymentMethod,
        addressSource,
        schoolIdForPickup,
        gstin,
        summary,
      }),
  };
};
