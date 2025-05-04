// controllers/purchaseRequestController.js
const { PurchaseRequest, PurchaseRequestItem, Goods, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// 구매요청 목록 조회
exports.getAllPurchaseRequests = async (req, res) => {
  try {
    const { status, startDate, endDate, requesterId, page = 1, limit = 10 } = req.query;
    
    // 검색 조건
    const where = {};
    if (status) {
      where.status = status;
    }
    if (startDate && endDate) {
      where.requested_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      where.requested_date = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      where.requested_date = {
        [Op.lte]: new Date(endDate)
      };
    }
    if (requesterId) {
      where.requester_id = requesterId;
    }
    
    // 페이지네이션
    const offset = (page - 1) * limit;
    
    // 구매요청 조회
    const { count, rows } = await PurchaseRequest.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'employee_number']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'employee_number']
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
    console.error('구매요청 목록 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매요청 상세 조회
exports.getPurchaseRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const purchaseRequest = await PurchaseRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'employee_number']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'employee_number']
        },
        {
          model: PurchaseRequestItem,
          as: 'items',
          include: [
            {
              model: Goods,
              as: 'goods'
            }
          ]
        }
      ]
    });
    
    if (!purchaseRequest) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    res.json(purchaseRequest);
  } catch (error) {
    console.error('구매요청 상세 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매요청 생성
exports.createPurchaseRequest = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { 
      requester_id, department, items, notes 
    } = req.body;
    
    // 필수 필드 검증
    if (!requester_id || !items || !items.length) {
      return res.status(400).json({ message: '요청자와 상품 항목은 필수입니다.' });
    }
    
    // 요청번호 생성 (PR + 현재날짜 + 6자리 랜덤번호)
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const requestNumber = `PR${dateString}${randomNumber}`;
    
    // 총액 계산
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
    
    // 구매요청 생성
    const newPurchaseRequest = await PurchaseRequest.create({
      request_number: requestNumber,
      requester_id,
      department,
      status: 'pending',
      total_amount: totalAmount,
      requested_date: today,
      notes
    }, { transaction: t });
    
    // 구매요청 항목 생성
    const requestItems = [];
    for (const item of items) {
      // 상품 정보 조회
      const goods = await Goods.findByPk(item.goods_id);
      if (!goods) {
        await t.rollback();
        return res.status(404).json({ message: `상품 ID ${item.goods_id}를 찾을 수 없습니다.` });
      }
      
      const quantity = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(goods.unitPrice) || 0;
      const price = unitPrice * quantity;
      const vat = goods.vatYn === 'Y' ? price * 0.1 : 0;
      const deliveryFee = parseFloat(item.delivery_fee || 0);
      const totalPrice = price + vat + deliveryFee;
      
      const requestItem = await PurchaseRequestItem.create({
        purchase_request_id: newPurchaseRequest.id,
        goods_id: goods.id,
        quantity,
        unit_price: unitPrice,
        price,
        vat,
        delivery_fee: deliveryFee,
        total_price: totalPrice,
        notes: item.notes
      }, { transaction: t });
      
      requestItems.push(requestItem);
    }
    
    await t.commit();
    
    res.status(201).json({
      message: '구매요청이 성공적으로 생성되었습니다.',
      purchaseRequest: {
        ...newPurchaseRequest.toJSON(),
        items: requestItems
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('구매요청 생성 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매요청 상태 변경 (승인/거절)
exports.updatePurchaseRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver_id, notes } = req.body;
    
    // 상태 검증
    if (!['approved', 'rejected', 'pending', 'completed'].includes(status)) {
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }
    
    // 구매요청 조회
    const purchaseRequest = await PurchaseRequest.findByPk(id);
    
    if (!purchaseRequest) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 상태가 'approved' 또는 'rejected'인 경우 승인자 ID 필요
    if ((status === 'approved' || status === 'rejected') && !approver_id) {
      return res.status(400).json({ message: '승인자 정보가 필요합니다.' });
    }
    
    const updateData = {
      status,
      notes: notes || purchaseRequest.notes
    };
    
    // 승인자 및 승인일 업데이트
    if (status === 'approved' || status === 'rejected') {
      updateData.approver_id = approver_id;
      updateData.approval_date = new Date();
    }
    
    // 구매요청 업데이트
    await purchaseRequest.update(updateData);
    
    res.json({
      message: `구매요청이 ${status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '업데이트'}되었습니다.`,
      purchaseRequest
    });
  } catch (error) {
    console.error('구매요청 상태 변경 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매요청 삭제
exports.deletePurchaseRequest = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // 구매요청 조회
    const purchaseRequest = await PurchaseRequest.findByPk(id);
    
    if (!purchaseRequest) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 승인된 구매요청은 삭제 불가
    if (purchaseRequest.status === 'approved' || purchaseRequest.status === 'completed') {
      return res.status(400).json({ message: '승인되거나 완료된 구매요청은 삭제할 수 없습니다.' });
    }
    
    // 구매요청 항목 삭제
    await PurchaseRequestItem.destroy({
      where: { purchase_request_id: id },
      transaction: t
    });
    
    // 구매요청 삭제
    await purchaseRequest.destroy({ transaction: t });
    
    await t.commit();
    
    res.json({ message: '구매요청이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    await t.rollback();
    console.error('구매요청 삭제 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};