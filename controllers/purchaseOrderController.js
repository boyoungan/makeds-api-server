// controllers/purchaseOrderController.js
const { 
  PurchaseOrder, PurchaseOrderItem, PurchaseRequest, PurchaseRequestItem,
  Goods, User, Supplier, sequelize 
} = require('../models');
const { Op } = require('sequelize');

// 구매발주 목록 조회
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, supplierId, page = 1, limit = 10 } = req.query;
    
    // 검색 조건
    const where = {};
    if (status) {
      where.status = status;
    }
    if (startDate && endDate) {
      where.order_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      where.order_date = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      where.order_date = {
        [Op.lte]: new Date(endDate)
      };
    }
    if (supplierId) {
      // 특별 케이스 처리 (1: 인터넷최저가, 2: MRO, 3: 기타)
      if (["1", "2", "3"].includes(supplierId)) {
        where.supplier_id = parseInt(supplierId);
      } else {
        where.supplier_id = supplierId;
      }
    }
    
    // 페이지네이션
    const offset = (page - 1) * limit;
    
    // 구매발주 조회
    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where,
      include: [
        {
          model: PurchaseRequest,
          as: 'purchaseRequest'
        },
        {
          model: User,
          as: 'orderer',
          attributes: ['id', 'username', 'employee_number']
        },
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // 페이지네이션 정보
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      totalItems: count,
      totalPages,
      currentPage: parseInt(page),
      items: rows
    });
  } catch (error) {
    console.error('구매발주 목록 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매발주 상세 조회
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: PurchaseRequest,
          as: 'purchaseRequest',
          include: [
            {
              model: User,
              as: 'requester',
              attributes: ['id', 'username', 'employee_number']
            }
          ]
        },
        {
          model: User,
          as: 'orderer',
          attributes: ['id', 'username', 'employee_number']
        },
        {
          model: Supplier,
          as: 'supplier'
        },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [
            {
              model: Goods,
              as: 'goods'
            },
            {
              model: PurchaseRequestItem,
              as: 'purchaseRequestItem'
            }
          ]
        }
      ]
    });
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: '구매발주를 찾을 수 없습니다.' });
    }
    
    res.json(purchaseOrder);
  } catch (error) {
    console.error('구매발주 상세 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매발주 생성
exports.createPurchaseOrder = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { 
      purchase_request_id, supplier_id, orderer_id, expected_delivery_date,
      payment_terms, shipping_address, items, notes 
    } = req.body;
    
    // 필수 필드 검증 (supplier_id는 특별 케이스를 위해 제외)
    if (!purchase_request_id || !orderer_id || !items || !items.length) {
      return res.status(400).json({ message: '구매요청 ID, 발주자 ID, 상품 항목은 필수입니다.' });
    }
    
    // supplier_id가 없을 경우 특별 케이스 처리
    let supplierIdToUse = supplier_id;
    // 특별 구매처 이름으로 supplierId 매핑 (요청 데이터에 supplier_name이 있는 경우)
    if (!supplierIdToUse && req.body.supplier_name) {
      const supplierName = req.body.supplier_name.trim();
      if (supplierName === "인터넷최저가") {
        supplierIdToUse = 1;
      } else if (supplierName === "MRO") {
        supplierIdToUse = 2;
      } else if (supplierName === "기타") {
        supplierIdToUse = 3;
      }
    }
    
    // 구매요청 조회
    const purchaseRequest = await PurchaseRequest.findByPk(purchase_request_id);
    if (!purchaseRequest) {
      await t.rollback();
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 구매요청 상태 확인
    if (purchaseRequest.status !== 'approved') {
      await t.rollback();
      return res.status(400).json({ message: '승인된 구매요청만 발주할 수 있습니다.' });
    }
    
    // 발주번호 생성 (PO + 현재날짜 + 6자리 랜덤번호)
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `PO${dateString}${randomNumber}`;
    
    // 총액 계산
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
    
    // 구매발주 생성
    const newPurchaseOrder = await PurchaseOrder.create({
      order_number: orderNumber,
      purchase_request_id,
      supplier_id: supplierIdToUse,
      status: 'created',
      total_amount: totalAmount,
      order_date: today,
      expected_delivery_date: expected_delivery_date ? new Date(expected_delivery_date) : null,
      orderer_id,
      payment_terms,
      shipping_address,
      notes
    }, { transaction: t });
    
    // 구매발주 항목 생성
    const orderItems = [];
    for (const item of items) {
      // 상품 정보 조회
      const goods = await Goods.findByPk(item.goods_id);
      if (!goods) {
        await t.rollback();
        return res.status(404).json({ message: `상품 ID ${item.goods_id}를 찾을 수 없습니다.` });
      }
      
      // 상품의 supplierId 확인 및 처리
      if (!goods.supplierId && item.supplier_name) {
        const supplierName = item.supplier_name.trim();
        let supplierIdForGoods = null;
        
        if (supplierName === "인터넷최저가") {
          supplierIdForGoods = 1;
        } else if (supplierName === "MRO") {
          supplierIdForGoods = 2;
        } else if (supplierName === "기타") {
          supplierIdForGoods = 3;
        }
        
        // 특별 구매처에 해당하면 상품의 supplierId 업데이트
        if (supplierIdForGoods) {
          await goods.update({ supplierId: supplierIdForGoods }, { transaction: t });
        }
      }
      
      const purchaseRequestItem = item.purchase_request_item_id 
        ? await PurchaseRequestItem.findByPk(item.purchase_request_item_id)
        : null;
      
      const quantity = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price || goods.unitPrice) || 0;
      const price = unitPrice * quantity;
      const vat = goods.vatYn === 'Y' ? price * 0.1 : 0;
      const deliveryFee = parseFloat(item.delivery_fee || 0);
      const totalPrice = price + vat + deliveryFee;
      
      const orderItem = await PurchaseOrderItem.create({
        purchase_order_id: newPurchaseOrder.id,
        goods_id: goods.id,
        purchase_request_item_id: purchaseRequestItem ? purchaseRequestItem.id : null,
        quantity,
        unit_price: unitPrice,
        price,
        vat,
        delivery_fee: deliveryFee,
        total_price: totalPrice,
        received_quantity: 0,
        notes: item.notes
      }, { transaction: t });
      
      orderItems.push(orderItem);
    }
    
    // 구매요청 상태 업데이트 (발주중)
    await purchaseRequest.update({
      status: 'in_progress'
    }, { transaction: t });
    
    await t.commit();
    
    res.status(201).json({
      message: '구매발주가 성공적으로 생성되었습니다.',
      purchaseOrder: {
        ...newPurchaseOrder.toJSON(),
        items: orderItems
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('구매발주 생성 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매발주 상태 변경
exports.updatePurchaseOrderStatus = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { status, actual_delivery_date, received_items, notes } = req.body;
    
    // 상태 검증
    if (!['created', 'sent', 'delivered', 'completed', 'cancelled'].includes(status)) {
      await t.rollback();
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }
    
    // 구매발주 조회
    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        { model: PurchaseOrderItem, as: 'items' }
      ]
    });
    
    if (!purchaseOrder) {
      await t.rollback();
      return res.status(404).json({ message: '구매발주를 찾을 수 없습니다.' });
    }
    
    // 배송 완료인 경우 실제 배송일 필수
    if (status === 'delivered' && !actual_delivery_date) {
      await t.rollback();
      return res.status(400).json({ message: '실제 배송일은 필수입니다.' });
    }
    
    const updateData = {
      status,
      notes: notes || purchaseOrder.notes
    };
    
    // 실제 배송일 업데이트
    if (actual_delivery_date) {
      updateData.actual_delivery_date = new Date(actual_delivery_date);
    }
    
    // 수령 수량 업데이트
    if (status === 'delivered' && received_items && received_items.length) {
      for (const item of received_items) {
        const orderItem = await PurchaseOrderItem.findOne({
          where: {
            purchase_order_id: id,
            id: item.id
          }
        });
        
        if (orderItem) {
          await orderItem.update({
            received_quantity: item.received_quantity || 0
          }, { transaction: t });
        }
      }
    }
    
    // 구매요청 상태 업데이트
    if (status === 'completed') {
      const purchaseRequest = await PurchaseRequest.findByPk(purchaseOrder.purchase_request_id);
      if (purchaseRequest) {
        await purchaseRequest.update({
          status: 'completed'
        }, { transaction: t });
      }
    } else if (status === 'cancelled') {
      const purchaseRequest = await PurchaseRequest.findByPk(purchaseOrder.purchase_request_id);
      if (purchaseRequest) {
        await purchaseRequest.update({
          status: 'approved'
        }, { transaction: t });
      }
    }
    
    // 구매발주 업데이트
    await purchaseOrder.update(updateData, { transaction: t });
    
    await t.commit();
    
    res.json({
      message: `구매발주 상태가 '${status}'로 업데이트되었습니다.`,
      purchaseOrder
    });
  } catch (error) {
    await t.rollback();
    console.error('구매발주 상태 변경 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매발주 삭제
exports.deletePurchaseOrder = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // 구매발주 조회
    const purchaseOrder = await PurchaseOrder.findByPk(id);
    
    if (!purchaseOrder) {
      await t.rollback();
      return res.status(404).json({ message: '구매발주를 찾을 수 없습니다.' });
    }
    
    // 'created' 상태인 발주만 삭제 가능
    if (purchaseOrder.status !== 'created') {
      await t.rollback();
      return res.status(400).json({ message: '생성 상태의 구매발주만 삭제할 수 있습니다.' });
    }
    
    // 구매요청 상태 복원
    const purchaseRequest = await PurchaseRequest.findByPk(purchaseOrder.purchase_request_id);
    if (purchaseRequest) {
      await purchaseRequest.update({
        status: 'approved'
      }, { transaction: t });
    }
    
    // 구매발주 항목 삭제
    await PurchaseOrderItem.destroy({
      where: { purchase_order_id: id },
      transaction: t
    });
    
    // 구매발주 삭제
    await purchaseOrder.destroy({ transaction: t });
    
    await t.commit();
    
    res.json({ message: '구매발주가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    await t.rollback();
    console.error('구매발주 삭제 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};