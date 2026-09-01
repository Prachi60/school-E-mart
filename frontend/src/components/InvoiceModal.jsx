import React from 'react';
import { X, Printer, Building2, User, FileText, AlertCircle, GraduationCap } from 'lucide-react';

const InvoiceModal = ({ isOpen, onClose, invoiceData, loading, error }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (paise) => {
    if (paise === undefined || paise === null || Number.isNaN(Number(paise))) return '₹0.00';
    return `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  // Safe Fallback Data Structure
  const seller = invoiceData?.seller || {};
  const customer = invoiceData?.customer || {};
  const shipping = invoiceData?.shippingAddress || invoiceData?.billingAddress || {};
  const items = invoiceData?.items || [];
  const studentDetails = invoiceData?.studentDetails || invoiceData?.student || {};

  const hasStudentDetails = Boolean(studentDetails.studentName || studentDetails.className || studentDetails.classTeacherName || studentDetails.schoolName);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 print:bg-white print:p-0 print:block">
      {/* Print CSS Rules to fit invoice receipt cleanly on a single A4 page without cropping */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-printable-content, #invoice-printable-content * {
            visibility: visible !important;
          }
          #invoice-printable-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
          }
          .print-hidden-bar {
            display: none !important;
          }
          .print-cards-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
          }
          .print-cards-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .print-compact-p {
            padding: 8px 10px !important;
            border-radius: 8px !important;
          }
          .print-compact-gap > * + * {
            margin-top: 10px !important;
          }
          .print-table th, .print-table td {
            padding: 5px 8px !important;
          }
          .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Printable Area Wrapper */}
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-8 border border-gray-100 flex flex-col max-h-[90vh] print:max-h-none print:my-0 print:border-none print:shadow-none">
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="p-4 bg-gray-900 text-white flex items-center justify-between print-hidden-bar">
          <div className="flex items-center gap-2">
            <FileText className="text-amber-400" size={20} />
            <span className="text-sm font-bold tracking-tight">Tax Invoice Receipt</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || error || !invoiceData}
              className="px-4 py-2 bg-primary hover:bg-amber-500 text-gray-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Printer size={16} />
              Print / Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content Body (Scrollable & Printable) */}
        <div className="p-6 md:p-10 overflow-y-auto flex-1 text-gray-800 font-sans print:overflow-visible print:p-0" id="invoice-printable-content">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-500">Generating Tax Invoice...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-500">
              <AlertCircle size={36} className="mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : !invoiceData ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-sm font-bold">No invoice details available</p>
            </div>
          ) : (
            <div className="space-y-6 print-compact-gap print-no-break">
              {/* Header Branding & Invoice Metadata */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-4 gap-4 print:pb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-black text-indigo-950 tracking-tight">SCHOOL E-MART</span>
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border border-amber-200">
                      TAX INVOICE
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Educational Products & Uniform Marketplace</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <h2 className="text-lg font-black text-gray-900">{invoiceData.invoiceNumber || 'INV-RECEIPT'}</h2>
                  <p className="text-xs text-gray-500"><span className="font-semibold text-gray-400">Order No:</span> #{invoiceData.orderNumber}</p>
                  <p className="text-xs text-gray-500"><span className="font-semibold text-gray-400">Date:</span> {formatDate(invoiceData.issuedAt)}</p>
                </div>
              </div>

              {/* Seller, Customer & Academic Information Cards */}
              <div className={`grid grid-cols-1 ${hasStudentDetails ? 'md:grid-cols-2 lg:grid-cols-3 print-cards-grid' : 'md:grid-cols-2 print-cards-grid-2'} gap-6`}>
                {/* Vendor / Seller Info */}
                <div className="bg-gray-50/80 p-5 print-compact-p rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-wider mb-1">
                    <Building2 size={15} />
                    <span>Seller / Merchant Details</span>
                  </div>
                  <p className="text-sm font-black text-gray-900">{seller.storeName || 'Vendor Store'}</p>
                  {seller.gstin && (
                    <p className="text-xs font-mono text-gray-600">
                      <span className="font-bold text-gray-400">GSTIN:</span> {seller.gstin}
                    </p>
                  )}
                  {seller.address && (
                    <p className="text-xs text-gray-600 leading-relaxed">{seller.address}</p>
                  )}
                  {(seller.phone || seller.email) && (
                    <p className="text-xs text-gray-500">
                      {seller.phone && <span>Ph: {seller.phone}</span>}
                      {seller.phone && seller.email && <span> • </span>}
                      {seller.email && <span>{seller.email}</span>}
                    </p>
                  )}
                </div>

                {/* Buyer / Customer Info */}
                <div className="bg-gray-50/80 p-5 print-compact-p rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-wider mb-1">
                    <User size={15} />
                    <span>Billed / Shipped To</span>
                  </div>
                  <p className="text-sm font-black text-gray-900">{customer.name || shipping.name || 'Valued Customer'}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {[shipping.addressLine1 || shipping.line1, shipping.addressLine2 || shipping.line2, shipping.city, shipping.state, shipping.zipCode || shipping.pinCode]
                      .filter(Boolean)
                      .join(', ') || 'N/A'}
                  </p>
                  {(customer.phone || shipping.phone) && (
                    <p className="text-xs text-gray-600 font-mono">
                      <span className="font-bold text-gray-400">Phone:</span> {customer.phone || shipping.phone}
                    </p>
                  )}
                </div>

                {/* Student & Academic Info (if available) */}
                {hasStudentDetails && (
                  <div className="bg-amber-50/60 p-5 print-compact-p rounded-2xl border border-amber-200/80 space-y-2 col-span-1 md:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-800 uppercase tracking-wider mb-1">
                      <GraduationCap size={15} />
                      <span>Student & Academic Info</span>
                    </div>
                    {studentDetails.studentName && (
                      <p className="text-sm font-black text-gray-900">
                        <span className="text-gray-500 font-semibold text-xs block text-[10px] uppercase">Student Name</span>
                        {studentDetails.studentName}
                      </p>
                    )}
                    {studentDetails.className && (
                      <p className="text-xs text-gray-700">
                        <span className="font-bold text-gray-500">Class:</span>{' '}
                        <span className="font-extrabold text-gray-900">
                          {studentDetails.className.replace(/^class\s+/i, '')}
                        </span>
                      </p>
                    )}
                    {studentDetails.classTeacherName && (
                      <p className="text-xs text-gray-700">
                        <span className="font-bold text-gray-500">Class Teacher:</span>{' '}
                        <span className="font-extrabold text-amber-900">{studentDetails.classTeacherName}</span>
                      </p>
                    )}
                    {studentDetails.schoolName && (
                      <p className="text-xs text-gray-600">
                        <span className="font-bold text-gray-500">School:</span> {studentDetails.schoolName}
                      </p>
                    )}
                    {studentDetails.rollNo && (
                      <p className="text-xs font-mono text-gray-600">
                        <span className="font-bold text-gray-400">Roll No:</span> {studentDetails.rollNo}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Itemized Table */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100/80 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      <th className="py-2.5 px-4 print-table w-12 text-center">#</th>
                      <th className="py-2.5 px-4 print-table">Item Description</th>
                      <th className="py-2.5 px-4 print-table text-center">Qty</th>
                      <th className="py-2.5 px-4 print-table text-right">Unit Price</th>
                      <th className="py-2.5 px-4 print-table text-right">Tax (GST)</th>
                      <th className="py-2.5 px-4 print-table text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {items.map((item, index) => {
                      const lineTotal = item.lineTotalPaise ?? (Number(item.pricePaise || 0) * Number(item.quantity || 1));
                      return (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-4 print-table text-center text-gray-400 font-mono">{index + 1}</td>
                          <td className="py-2.5 px-4 print-table font-bold text-gray-900">
                            {item.name || 'Item'}
                            {item.sku && <span className="block text-[10px] font-mono text-gray-400 font-normal">SKU: {item.sku}</span>}
                          </td>
                          <td className="py-2.5 px-4 print-table text-center font-bold">{item.quantity || 1}</td>
                          <td className="py-2.5 px-4 print-table text-right">{formatCurrency(item.pricePaise)}</td>
                          <td className="py-2.5 px-4 print-table text-right text-gray-500">{formatCurrency(item.taxPaise || 0)}</td>
                          <td className="py-2.5 px-4 print-table text-right font-bold text-gray-900">{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Payment Info & Totals Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-cards-grid-2 items-start">
                <div className="p-4 print-compact-p bg-gray-50 rounded-2xl border border-gray-100 space-y-2 text-xs">
                  <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Payment Information</p>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Method:</span>
                    <span className="font-bold text-gray-900 uppercase">{invoiceData.paymentMethod || 'COD'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Status:</span>
                    <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                      invoiceData.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {invoiceData.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs font-medium">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold">{formatCurrency(invoiceData.subtotalPaise)}</span>
                  </div>
                  {Number(invoiceData.taxPaise) > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Total Tax (GST)</span>
                      <span>{formatCurrency(invoiceData.taxPaise)}</span>
                    </div>
                  )}
                  {Number(invoiceData.deliveryChargePaise) > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping / Delivery</span>
                      <span>{formatCurrency(invoiceData.deliveryChargePaise)}</span>
                    </div>
                  )}
                  {Number(invoiceData.platformFeePaise) > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Platform Fee</span>
                      <span>{formatCurrency(invoiceData.platformFeePaise)}</span>
                    </div>
                  )}
                  {Number(invoiceData.handlingChargePaise) > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Handling Charge</span>
                      <span>{formatCurrency(invoiceData.handlingChargePaise)}</span>
                    </div>
                  )}
                  {Number(invoiceData.walletAmountPaise) > 0 && (
                    <div className="flex justify-between text-indigo-600 font-semibold">
                      <span>Wallet Applied</span>
                      <span>-{formatCurrency(invoiceData.walletAmountPaise)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-black text-gray-900">
                    <span>Grand Total</span>
                    <span className="text-base text-amber-900">{formatCurrency(invoiceData.totalPaise)}</span>
                  </div>

                  {Number(invoiceData.discountPaise) > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-dashed border-emerald-200 bg-emerald-50/80 p-2 rounded-xl flex justify-between items-center text-xs text-emerald-800 font-bold">
                      <span>🎉 Total Savings (MRP Discount)</span>
                      <span>{formatCurrency(invoiceData.discountPaise)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Terms & Sign */}
              <div className="border-t border-gray-100 pt-4 print:pt-2 text-center text-[10px] text-gray-400 space-y-0.5">
                <p>This is a computer-generated tax invoice issued via School E-Mart Marketplace platform.</p>
                <p>Thank you for shopping with us!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
