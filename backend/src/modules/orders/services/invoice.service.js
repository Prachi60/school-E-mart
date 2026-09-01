const mongoose = require('mongoose');
const orderService = require('./order.service');
const Order = require('../../../database/models/Order');
const VendorProfile = require('../../../database/models/VendorProfile');
const User = require('../../../database/models/User');

const invoiceService = {
  async buildInvoicePayload(order) {
    // 1. Fetch Customer Profile Info safely
    let customerUser = null;
    if (order.userId && mongoose.Types.ObjectId.isValid(String(order.userId))) {
      customerUser = await User.findById(order.userId).select('name phone email').lean();
    }

    // 2. Fetch Vendor / Seller Profiles safely
    const rawVendorIds = order.vendorIds || [];
    const itemVendorIds = (order.items || []).map((i) => i.vendorId).filter(Boolean);
    const validVendorIds = [...new Set([...rawVendorIds.map(String), ...itemVendorIds.map(String)])]
      .filter((vId) => mongoose.Types.ObjectId.isValid(vId));

    let vendorProfiles = [];
    if (validVendorIds.length > 0) {
      vendorProfiles = await VendorProfile.find({ _id: { $in: validVendorIds } })
        .populate('userId', 'name phone email')
        .lean();
    }

    const sellers = vendorProfiles.map((vp) => {
      const addrParts = vp.address
        ? [vp.address.line1, vp.address.line2, vp.address.city, vp.address.state, vp.address.pinCode]
            .filter(Boolean)
            .join(', ')
        : '';
      return {
        vendorId: vp._id,
        storeName: vp.storeName || 'Vendor Partner',
        gstin: vp.gstin || null,
        panCard: vp.panCard || null,
        address: addrParts,
        addressObj: vp.address || null,
        phone: vp.userId?.phone || '',
        email: vp.userId?.email || '',
      };
    });

    const primarySeller = sellers[0] || {
      storeName: 'School E-Mart Vendor Partner',
      gstin: order.gstin || null,
      address: 'Authorized Fulfillment Location',
      phone: '',
      email: '',
    };

    // 3. Resolve Academic & Student Info (Student, Class, Class Teacher)
    let studentDetails = null;
    try {
      const ParentProfile = require('../../../database/models/ParentProfile');
      const ChildProfile = require('../../../database/models/ChildProfile');
      const Student = require('../../../database/models/Student');
      const School = require('../../../database/models/School');
      const TeacherProfile = require('../../../database/models/TeacherProfile');
      const Kit = require('../../../database/models/Kit');

      let studentName = null;
      let classGrade = null;
      let section = null;
      let schoolId = null;
      let schoolRefNo = null;
      let rollNo = null;
      let admissionNo = null;

      if (order.userId && mongoose.Types.ObjectId.isValid(String(order.userId))) {
        const parentProfile = await ParentProfile.findOne({ userId: order.userId }).lean();
        if (parentProfile) {
          let childDoc = null;
          if (parentProfile.activeChildId) {
            childDoc = await ChildProfile.findById(parentProfile.activeChildId).lean();
          }
          if (!childDoc) {
            childDoc = await ChildProfile.findOne({ parentUserId: order.userId }).lean();
          }

          if (childDoc) {
            studentName = childDoc.name || null;
            classGrade = childDoc.grade || null;
            schoolId = childDoc.schoolId || null;
            schoolRefNo = childDoc.schoolRefNo || null;
            rollNo = childDoc.rollNo || null;

            if (childDoc.studentId) {
              const studentDoc = await Student.findById(childDoc.studentId).lean();
              if (studentDoc) {
                studentName = studentDoc.name || studentName;
                classGrade = studentDoc.classGrade || classGrade;
                section = studentDoc.section || null;
                schoolId = studentDoc.schoolId || schoolId;
                admissionNo = studentDoc.admissionNo || null;
                rollNo = studentDoc.rollNo || rollNo;
                schoolRefNo = studentDoc.schoolRefNo || schoolRefNo;
              }
            }
          }
        }
      }

      // If missing schoolId or classGrade, check order items (e.g. kit items)
      if (!classGrade || !schoolId) {
        for (const item of (order.items || [])) {
          if (item.schoolId && !schoolId) {
            schoolId = item.schoolId;
          }
          if (item.kitId) {
            const kit = await Kit.findById(item.kitId).lean();
            if (kit) {
              if (!classGrade && kit.classGrade) classGrade = kit.classGrade;
              if (!schoolId && kit.schoolId) schoolId = kit.schoolId;
            }
          }
        }
      }

      if (!schoolId && order.schoolIdForPickup) {
        schoolId = order.schoolIdForPickup;
      }

      let schoolName = null;
      if (schoolId) {
        const schoolDoc = await School.findById(schoolId).select('name').lean();
        schoolName = schoolDoc?.name || null;
      }

      let classTeacherName = null;
      if (schoolId && classGrade) {
        const teachers = await TeacherProfile.find({
          schoolId,
          approvalStatus: 'approved',
          'softDelete.isDeleted': { $ne: true },
        }).lean();

        let matchingTeacherProfile = null;

        for (const teacher of teachers) {
          const isClassTeacher = (teacher.classAssignments || []).some((assignment) => {
            // Strictly require isClassTeacher === true
            if (!assignment.isClassTeacher) return false;

            const classMatches =
              assignment.class &&
              String(assignment.class).trim().toLowerCase() === String(classGrade).trim().toLowerCase();

            if (!classMatches) return false;

            if (section && assignment.section) {
              return String(assignment.section).trim().toLowerCase() === String(section).trim().toLowerCase();
            }

            return true;
          });

          if (isClassTeacher) {
            matchingTeacherProfile = teacher;
            break;
          }
        }

        if (matchingTeacherProfile?.userId) {
          const teacherUser = await User.findById(matchingTeacherProfile.userId).select('name').lean();
          classTeacherName = teacherUser?.name || null;
        }
      }

      const rawGrade = classGrade ? String(classGrade).replace(/^(class|grade)\s+/i, '').trim() : null;
      const cleanSection = section ? String(section).replace(/^section\s+/i, '').trim() : null;
      const className = rawGrade
        ? cleanSection
          ? `Class ${rawGrade} - ${cleanSection}`
          : `Class ${rawGrade}`
        : null;

      if (studentName || className || schoolName || classTeacherName) {
        studentDetails = {
          studentName: studentName || null,
          className: className || null,
          classGrade: classGrade || null,
          section: section || null,
          schoolName: schoolName || null,
          classTeacherName: classTeacherName || null,
          rollNo: rollNo || null,
          admissionNo: admissionNo || null,
          schoolRefNo: schoolRefNo || null,
        };
      }
    } catch (err) {
      // Academic details resolution failure should not block invoice building
    }

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderId: order._id,
      orderNumber: order.orderNumber,
      issuedAt: order.placedAt || order.audit?.createdAt || new Date(),
      seller: primarySeller,
      sellers,
      customer: {
        userId: order.userId,
        name: customerUser?.name || order.address?.name || 'Customer',
        phone: customerUser?.phone || order.address?.phone || '',
        email: customerUser?.email || '',
      },
      studentDetails,
      billingAddress: order.address || {},
      shippingAddress: order.address || {},
      gstin: order.gstin || null,
      items: (order.items || []).map((item) => {
        const pricePaise = Number(item.pricePaise || 0);
        const quantity = Number(item.quantity || 1);
        const lineTotalPaise = item.lineTotalPaise ?? (pricePaise * quantity);
        return {
          name: item.name || 'Product',
          sku: item.sku || null,
          quantity,
          pricePaise,
          taxPaise: Number(item.taxPaise || 0),
          lineTotalPaise,
          vendorId: item.vendorId || null,
        };
      }),
      subtotalPaise: Number(order.subtotalPaise || 0),
      taxPaise: Number(order.taxPaise || 0),
      discountPaise: Number(order.discountPaise || 0),
      deliveryChargePaise: Number(order.deliveryChargePaise || 0),
      platformFeePaise: Number(order.platformFeePaise || 0),
      handlingChargePaise: Number(order.handlingChargePaise || 0),
      totalPaise: Number(order.totalPaise || 0),
      walletAmountPaise: Number(order.walletAmountPaise || 0),
      paymentMethod: order.paymentMethod || 'COD',
      paymentStatus: order.paymentStatus || 'pending',
      orderStatus: order.orderStatus || 'placed',
    };
  },

  async generateInvoice(orderId) {
    const order = await orderService.getOrder(orderId);
    const invoice = await this.buildInvoicePayload(order);
    const invoiceUrl = `/api/v1/orders/${orderId}/invoice`;

    await Order.findByIdAndUpdate(orderId, { $set: { invoiceUrl } });

    return { ...invoice, invoiceUrl, downloadMeta: { format: 'json', generatedAt: new Date() } };
  },

  async getInvoice(orderId) {
    const order = await orderService.getOrder(orderId);
    const invoice = await this.buildInvoicePayload(order);
    return {
      ...invoice,
      invoiceUrl: order.invoiceUrl || `/api/v1/orders/${orderId}/invoice`,
      downloadMeta: { format: 'json', available: true },
    };
  },
};

module.exports = invoiceService;
