import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Check, ShoppingCart, 
  ShieldCheck, ChevronRight,
  Info, AlertCircle, Package, Truck,
  Plus, X, Loader2, CheckCircle2, Clock
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import AuthPrompt from '../../components/AuthPrompt';
import * as catalogApi from '../../../services/catalogApi';
import { getKit, listKits, listPurchasedKitIds } from '../../../services/schoolApi';
import { getErrorMessage } from '../../../utils/apiHelpers';
import { mapProductForDetailView } from '../../../utils/mappers/productMapper';
import { toAbsoluteUrl } from '../../../utils/url';
import { resolveParentSchoolId } from '../../../hooks/useKitProcurementProgress';
import KitSaleCountdown from '../../components/KitSaleCountdown';

const KitDetailsPage = () => {
  const { kitId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const isGuest = !localStorage.getItem('childInfo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentKitData, setCurrentKitData] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isPurchased, setIsPurchased] = useState(false);
  // True once the admin's kit sale window has closed on this kit — either the
  // API refused to serve it, or the countdown ran out while the page sat open.
  const [saleClosed, setSaleClosed] = useState(false);
  // { [itemIndex]: { size, color } } — the parent's picks for items that offer
  // a choice. Required before the kit can be added to cart.
  const [selections, setSelections] = useState({});

  useEffect(() => {
    let cancelled = false;

    const checkPurchased = async () => {
      if (isGuest) return;
      try {
        const childInfo = JSON.parse(localStorage.getItem('childInfo') || '{}');
        // Prefer the parent's linked school; fall back to the kit's own
        // school once it's loaded (covers a deep link opened before the
        // parent's school context is known).
        const schoolId = resolveParentSchoolId(childInfo) || currentKitData?.schoolId;
        if (!schoolId) return;

        // Same query the procurement progress bar uses — accurate regardless
        // of how many other (non-kit) orders this parent has placed, unlike
        // scanning a page of recent orders.
        const purchasedIds = await listPurchasedKitIds(schoolId);
        const purchased = (purchasedIds || []).map(String).includes(String(kitId));
        if (!cancelled) setIsPurchased(purchased);
      } catch {
        // order fetch optional
      }
    };

    checkPurchased();
    return () => {
      cancelled = true;
    };
  }, [kitId, isGuest, currentKitData?.schoolId]);

  useEffect(() => {
    let cancelled = false;

    const loadKit = async () => {
      setLoading(true);
      setError('');
      try {
        const childInfo = JSON.parse(localStorage.getItem('childInfo') || '{}');
        const schoolId = childInfo.schoolId;

        let rawKit = null;
        // A kit whose sale window has closed 404s for this parent. That is a
        // different story from "no such kit", and worth telling them plainly
        // instead of falling through to a generic not-found.
        let windowClosed = false;

        // Step 1: Try school kit API if schoolId exists
        if (schoolId) {
          try {
            rawKit = await getKit(schoolId, kitId);
          } catch (err) {
            windowClosed = err?.response?.data?.code === 'KIT_PURCHASE_WINDOW_CLOSED';
            rawKit = null;
          }
        }

        // Step 2: Fallback query getKit with 'all' or listKits for matching kit _id
        if (!rawKit && !windowClosed) {
          try {
            rawKit = await getKit('all', kitId);
          } catch (err) {
            windowClosed = err?.response?.data?.code === 'KIT_PURCHASE_WINDOW_CLOSED';
            rawKit = null;
          }
        }

        if (windowClosed) {
          if (!cancelled) {
            setSaleClosed(true);
            setCurrentKitData(null);
            setLoading(false);
          }
          return;
        }

        if (!rawKit && schoolId) {
          try {
            const listRes = await listKits(schoolId);
            const kitsList = listRes.data || listRes || [];
            rawKit = kitsList.find((k) => String(k._id || k.id) === String(kitId));
          } catch {
            rawKit = null;
          }
        }

        if (cancelled) return;

        // Step 3: If School Kit found, map it
        if (rawKit) {
          const kitData = {
            id: rawKit._id || rawKit.id,
            schoolId: rawKit.schoolId?._id || rawKit.schoolId || null,
            name: rawKit.name,
            description: rawKit.description || 'Official school procurement kit',
            image: toAbsoluteUrl(rawKit.imageUrl || rawKit.avatar || rawKit.items?.find((i) => i.imageUrl)?.imageUrl || rawKit.items?.[0]?.imageUrl) || '',
            price: rawKit.pricePaise ? Math.round(rawKit.pricePaise / 100) : (rawKit.price || 0),
            mrp: rawKit.mrpPaise ? Math.round(rawKit.mrpPaise / 100) : (rawKit.mrp || 0),
            classes: rawKit.classGrade || rawKit.classes || '',
            category: rawKit.category || 'School Kit',
            // Both null unless the admin has the kit sale window switched on.
            saleStartsAt: rawKit.purchaseWindow?.startsAt || null,
            saleEndsAt: rawKit.purchaseWindow?.endsAt || null,
            items: (rawKit.items || []).map((item, index) => {
              const pName = item.name || item.masterProductId?.name || `Item ${index + 1}`;
              const pImg = toAbsoluteUrl(item.imageUrl || item.masterProductId?.imageUrl || rawKit.imageUrl) || '';
              const pPrice = item.pricePaise ? Math.round(item.pricePaise / 100) : (item.price || 0);
              return {
                id: item._id || item.id || item.masterProductId?._id || `item-${index}`,
                itemIndex: index,
                name: pName,
                price: pPrice,
                originalPrice: item.mrpPaise ? Math.round(item.mrpPaise / 100) : pPrice,
                quantity: item.quantity || 1,
                type: item.type || item.masterProductId?.category || 'Item',
                image: pImg,
                // What the school made available for this item — the parent
                // must pick exactly one of each before this kit can be ordered,
                // so the vendor knows exactly what to pack for their child.
                sizes: item.attributes?.sizes || [],
                colors: item.attributes?.colors || [],
                gender: item.attributes?.gender || '',
              };
            }),
            addons: [],
          };

          setCurrentKitData(kitData);
          setSelectedItemIds(kitData.items.map((item) => item.id));
          setSelections({});
          setLoading(false);
          return;
        }

        // Step 4: Fallback to General Marketplace Product
        const product = await catalogApi.getProduct(kitId);
        if (cancelled) return;
        const mapped = mapProductForDetailView(product);
        const kitData = {
          id: mapped.id,
          name: mapped.name,
          description: mapped.description || '',
          image: mapped.image,
          price: mapped.price || 0,
          mrp: mapped.originalPrice || mapped.price || 0,
          items: (mapped.bundleItems || []).map((item, index) => ({
            id: item.id || `item-${index}`,
            name: item.name,
            price: item.pricePaise ? Math.round(item.pricePaise / 100) : item.price || 0,
            originalPrice: item.originalPrice,
            quantity: 1,
            type: item.category || 'Item',
            image: item.image || mapped.image,
          })),
          addons: [],
        };

        setCurrentKitData(kitData);
        setSelectedItemIds(kitData.items.map((item) => item.id));
        setSelections({});
      } catch (err) {
        if (!cancelled) {
          setCurrentKitData(null);
          setError(getErrorMessage(err, 'Kit not found'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadKit();
    return () => {
      cancelled = true;
    };
  }, [kitId]);

  const toggleItem = (id) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const setSelection = (itemIndex, field, value) => {
    setSelections((prev) => ({
      ...prev,
      [itemIndex]: { ...prev[itemIndex], [field]: value },
    }));
  };

  // Every item that offers sizes/colors must have a pick before checkout — a
  // silent default risks the wrong size/color reaching a vendor for someone's
  // child.
  const itemsNeedingSelection = (currentKitData?.items || []).filter(
    (item) => item.sizes?.length > 0 || item.colors?.length > 0
  );
  const missingSelections = itemsNeedingSelection.some((item) => {
    const picked = selections[item.itemIndex] || {};
    return (item.sizes?.length > 0 && !picked.size) || (item.colors?.length > 0 && !picked.color);
  });

  const handleAddOn = (addon) => {
    if (isGuest) {
      setIsAuthPromptOpen(true);
      return;
    }
    addToCart(addon);
    setCurrentKitData(prev => ({
      ...prev,
      items: [...prev.items, addon],
      addons: prev.addons.filter(a => a.id !== addon.id)
    }));
    setSelectedItemIds(prev => [...prev, addon.id]);
  };

  const handleRemoveItem = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItemIds(prev => prev.filter(id => id !== item.id));
    setCurrentKitData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== item.id),
      addons: [item, ...prev.addons]
    }));
  };

  const [addingToCart, setAddingToCart] = useState(false);
  const [buyError, setBuyError] = useState('');

  const { currentTotal, isFullKit } = useMemo(() => {
    if (!currentKitData) return { currentTotal: 0, isFullKit: true };
    return {
      currentTotal: currentKitData.price,
      isFullKit: true
    };
  }, [currentKitData]);

  const handleAddToCart = async () => {
    if (!currentKitData || isPurchased || addingToCart || saleClosed) return;
    if (isGuest) {
      setIsAuthPromptOpen(true);
      return;
    }
    if (missingSelections) {
      setBuyError('Please choose a size and color for every item that needs one before ordering.');
      return;
    }

    setAddingToCart(true);
    setBuyError('');

    try {
      const kitSelections = (currentKitData.items || [])
        .filter((item) => item.sizes?.length > 0 || item.colors?.length > 0)
        .map((item) => ({
          itemIndex: item.itemIndex,
          name: item.name,
          size: selections[item.itemIndex]?.size || undefined,
          color: selections[item.itemIndex]?.color || undefined,
        }));

      const kitCartItem = {
        id: currentKitData.id,
        productId: currentKitData.id,
        kitId: currentKitData.id,
        name: currentKitData.name,
        price: currentKitData.price,
        pricePaise: Math.round(currentKitData.price * 100),
        image: currentKitData.image || currentKitData.items?.find((i) => i.image)?.image || '',
        quantity: 1,
        kitSelections,
      };

      await addToCart(kitCartItem);
      navigate('/user/checkout');
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to process kit purchase');
      setBuyError(msg);
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center font-outfit">
        <Loader2 size={32} className="animate-spin text-[#3b2d7d] mb-3" />
        <p className="text-sm font-bold text-gray-400">Loading kit details…</p>
      </div>
    );
  }

  if (saleClosed && !currentKitData) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center px-6 font-outfit text-center">
        <Clock size={48} className="text-red-300 mb-4" />
        <h2 className="text-lg font-black text-gray-900 mb-2">This kit is no longer on sale</h2>
        <p className="text-xs text-gray-400 mb-6 font-medium max-w-xs">
          Its purchase window has closed. Ask your school if you still need this kit for your child.
        </p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-[#3b2d7d] text-white rounded-2xl text-xs font-black uppercase tracking-wider">
          Go Back
        </button>
      </div>
    );
  }

  if (!currentKitData || error) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center px-6 font-outfit text-center">
        <Package size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-black text-gray-900 mb-2">Kit not found</h2>
        <p className="text-xs text-gray-400 mb-6 font-medium">{error || 'This kit is unavailable or does not exist.'}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-[#3b2d7d] text-white rounded-2xl text-xs font-black uppercase tracking-wider">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF] pb-32 font-outfit relative">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-gray-150 z-50 px-6 py-4 flex items-center gap-4 shadow-xs">
        <button onClick={() => navigate(-1)} className="text-gray-800 p-1 active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-black text-gray-900 uppercase tracking-wider">Kit Details</h1>
      </div>

      <div className="pt-20">
        <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gray-100 flex items-center justify-center">
          {currentKitData.image ? (
            <img 
              src={currentKitData.image} 
              alt={currentKitData.name} 
              className="w-full h-full object-contain p-4"
            />
          ) : (
            <Package size={64} className="text-purple-300" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7FF] via-transparent to-transparent"></div>
        </div>

        <div className="px-6 -mt-12 relative z-10">
          <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-150">
            <span className="px-2.5 py-0.5 bg-purple-50 text-[#3b2d7d] border border-purple-100 rounded-lg text-[9px] font-black uppercase tracking-wider inline-block mb-2">
              {currentKitData.category}
            </span>
            <h2 className="text-xl font-black text-gray-900 mb-2 leading-tight">{currentKitData.name}</h2>
            <p className="text-gray-400 text-xs font-medium leading-relaxed mb-5">
              {currentKitData.description}
            </p>
            {isPurchased && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 font-bold text-xs flex items-center gap-2.5 shadow-2xs">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                <span>You have already purchased this kit for your child.</span>
              </div>
            )}
            {/* Only worth pressuring a parent who can still act on it. Once the
                countdown hits zero the kit stops being orderable here too, so
                the CTA below flips rather than failing at the cart. */}
            {!isPurchased && currentKitData.saleEndsAt && (
              <KitSaleCountdown
                startsAt={currentKitData.saleStartsAt}
                endsAt={currentKitData.saleEndsAt}
                variant="banner"
                className="mt-4"
                onExpire={() => setSaleClosed(true)}
              />
            )}
            <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-100/80 flex items-center justify-between mt-3">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Kit Price</p>
                <span className="text-2xl font-black text-[#3b2d7d]">₹{currentTotal.toLocaleString()}</span>
              </div>
              {currentKitData.mrp > currentTotal && (
                <span className="text-xs text-gray-400 font-bold line-through">₹{currentKitData.mrp.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">What&apos;s Included</h3>
          <span className="text-[9px] font-black text-[#3b2d7d] bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            {selectedItemIds.length} / {currentKitData.items.length} Items Selected
          </span>
        </div>

        <div className="space-y-3">
          {currentKitData.items.map((item) => {
            const isSelected = selectedItemIds.includes(item.id);
            const needsSize = item.sizes?.length > 0;
            const needsColor = item.colors?.length > 0;
            const picked = selections[item.itemIndex] || {};
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isSelected ? 'bg-white border-[#3b2d7d] shadow-xs' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div
                  onClick={() => toggleItem(item.id)}
                  className="flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 p-1 shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <Package size={20} className="text-purple-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-gray-900 truncate">{item.name}</h4>
                      <span className="text-[10px] text-gray-400 font-bold">{item.type} • Qty: {item.quantity}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected ? 'bg-[#3b2d7d] border-[#3b2d7d] text-white shadow-2xs' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && <Check size={13} className="stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Size/color pickers — required whenever the school offered options,
                    so the vendor gets the exact fit for this child, not a guess. */}
                {(needsSize || needsColor) && (
                  <div className="pt-3 border-t border-gray-100 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                    {needsSize && (
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">
                          Select Size <span className="text-red-500">*</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.sizes.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setSelection(item.itemIndex, 'size', sz)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                                picked.size === sz
                                  ? 'bg-[#3b2d7d] text-white border-[#3b2d7d]'
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {needsColor && (
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">
                          Select Color <span className="text-red-500">*</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.colors.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSelection(item.itemIndex, 'color', c)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                                picked.color === c
                                  ? 'bg-[#3b2d7d] text-white border-[#3b2d7d]'
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-gray-200 z-40">
        {buyError && (
          <div className="max-w-md mx-auto mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{buyError}</span>
            </div>
            <button onClick={() => setBuyError('')} className="p-0.5 hover:bg-red-100 rounded-md">
              <X size={14} />
            </button>
          </div>
        )}
        {!buyError && missingSelections && !isPurchased && !saleClosed && (
          <div className="max-w-md mx-auto mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <span>Select a size and color for every item above to continue.</span>
          </div>
        )}
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Payable Amount</span>
            <span className="text-xl font-black text-[#3b2d7d]">₹{currentTotal.toLocaleString()}</span>
          </div>

          <button
            type="button"
            disabled={isPurchased || addingToCart || missingSelections || saleClosed}
            onClick={handleAddToCart}
            className={`px-6 py-3.5 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
              isPurchased
                ? 'bg-emerald-600 text-white opacity-90 cursor-not-allowed shadow-emerald-900/10'
                : saleClosed
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : addingToCart
                ? 'bg-[#3b2d7d]/80 text-white cursor-wait'
                : missingSelections
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : 'bg-[#3b2d7d] hover:bg-[#2c2060] text-white shadow-purple-950/15'
            }`}
          >
            {addingToCart ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing…</span>
              </>
            ) : isPurchased ? (
              <>
                <CheckCircle2 size={16} className="stroke-[2.5]" />
                <span>Already Purchased</span>
              </>
            ) : saleClosed ? (
              <>
                <Clock size={16} />
                <span>Sale Closed</span>
              </>
            ) : (
              <>
                <ShoppingCart size={16} />
                <span>Proceed to Buy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <AuthPrompt isOpen={isAuthPromptOpen} onClose={() => setIsAuthPromptOpen(false)} />
    </div>
  );
};

export default KitDetailsPage;
