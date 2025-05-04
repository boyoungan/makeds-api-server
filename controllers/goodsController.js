// controllers/goodsController.js
const { Goods, Supplier, sequelize } = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 상품 목록 조회
exports.getAllGoods = async (req, res) => {
  try {
    const { search, keyword, category, page = 1, limit = 10, year, month } = req.query;
    
    // 검색 조건
    const where = {};
    const nameSearch = search || keyword;
    if (nameSearch) {
      where.name = { [Op.iLike]: `%${nameSearch}%` };
    }
    if (category) {
      where.category = category;
    }

    // 연도/월 필터링
    if (year && month) {
      // 해당 연월의 1일부터 말일까지
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999); // 말일의 마지막 순간
      where.created_at = { [Op.between]: [start, end] };
    } else if (year) {
      // 해당 연도 전체
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      where.created_at = { [Op.between]: [start, end] };
    } else if (month) {
      // 모든 연도 중 해당 월 (예: 5월이면 5월 1일~5월 31일, 연도 무관)
      // 이 경우는 복잡하므로, created_at의 월만 비교
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        Sequelize.where(Sequelize.fn('EXTRACT', Sequelize.literal('MONTH FROM "created_at"')), month)
      );
    }
    
    // 페이지네이션
    const offset = (page - 1) * limit;
    
    // 상품 조회
    const { count, rows } = await Goods.findAndCountAll({
      where,
      include: [
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
    
    // 전체 합계 구하기 (페이지네이션 없이)
    const totalSum = await Goods.sum('totalconsideration', { where });
    
    // 페이지네이션 정보
    const totalItems = Array.isArray(count) ? count.length : count;
    const totalPages = Math.ceil(totalItems / limit);
    
    res.json({
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      items: rows,
      totalSum: totalSum || 0
    });
  } catch (error) {
    console.error('상품 목록 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 상세 조회
exports.getGoodsById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const goods = await Goods.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'business_number', 'contact_name', 'contact_phone', 'contact_email']
        }
      ]
    });
    
    if (!goods) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
    
    res.json(goods);
  } catch (error) {
    console.error('상품 상세 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 등록
exports.createGoods = async (req, res) => {
  try {
    const { 
      name, unitPrice, vatYn, supplierId, category, description, 
      department, vat, delivery, supplyvalue, totalconsideration 
    } = req.body;
    
    // req.file에서 이미지 URL 처리
    const imageUrl = req.file ? `/uploads/images/${req.file.filename}` : req.body.imageUrl;

    // 필수 필드 검증
    if (!name || !unitPrice) {
      return res.status(400).json({ message: '상품명과 단가는 필수 항목입니다.' });
    }
    
    // 상품 생성
    const newGoods = await Goods.create({
      name,
      unitPrice,
      vatYn: vatYn || 'Y',
      supplierId,
      category,
      description,
      imageUrl,
      department,
      vat,
      delivery,
      supplyvalue,
      totalconsideration
    });
    
    res.status(201).json({
      message: '상품이 성공적으로 등록되었습니다.',
      goods: newGoods
    });
  } catch (error) {
    console.error('상품 등록 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 수정
exports.updateGoods = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, unitPrice, vatYn, supplierId, category, description,
      department, vat, delivery, supplyvalue, totalconsideration,
      purchaseQuantity
    } = req.body;

    // 상품 조회
    const goods = await Goods.findByPk(id);

    if (!goods) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    // req.file에서 이미지 URL 처리
    let imageUrl = goods.imageUrl; // 기본값은 기존 이미지 URL
    if (req.file) {
      imageUrl = `/uploads/images/${req.file.filename}`; // 새 파일이 있으면 교체
    } else if (req.body.imageUrl === '') {
      imageUrl = null; // 이미지 삭제 요청
    }

    // 상품 수정
    await goods.update({
      name,
      unitPrice,
      vatYn,
      supplierId,
      category,
      description,
      imageUrl,
      department,
      vat,
      delivery,
      supplyvalue,
      totalconsideration,
      purchaseQuantity: purchaseQuantity !== undefined ? parseInt(purchaseQuantity) : goods.purchaseQuantity
    });

    res.json({
      message: '상품이 성공적으로 수정되었습니다.',
      goods
    });
  } catch (error) {
    console.error('상품 수정 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 삭제
exports.deleteGoods = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 상품 조회
    const goods = await Goods.findByPk(id);
    
    if (!goods) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
    
    // 상품 삭제
    await goods.destroy();
    
    res.json({ message: '상품이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('상품 삭제 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 카테고리 목록 조회
exports.getCategories = async (req, res) => {
  try {
    // 중복없이 카테고리 목록 조회
    const categories = await Goods.findAll({
      attributes: ['category'],
      where: {
        category: {
          [Op.ne]: null
        }
      },
      group: ['category']
    });
    
    const categoryList = categories.map(item => item.category);
    
    res.json(categoryList);
  } catch (error) {
    console.error('카테고리 목록 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 엑셀 파일로 상품 가져오기
exports.importGoodsFromExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '엑셀 파일이 필요합니다.' });
  }

  const filePath = req.file.path;
  const results = { success: 0, failed: 0, errors: [] };
  let goodsToCreate = [];
  let data = [];
  const t = await sequelize.transaction();

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    data = xlsx.utils.sheet_to_json(worksheet);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2;

      const excelDate = row['일시'];
      const department = row['부서'] || '';
      const name = row['내용'];
      const supplierName = row['구매처'];
      const unitPrice = parseFloat(row['단가']);
      const vatYnExcel = row['부가세여부'];
      const vat = parseFloat(row['부가세'] || 0);
      const purchaseQuantity = parseInt(row['수량'] || 0);
      const delivery = parseFloat(row['배송비'] || 0);
      const supplyvalue = parseFloat(row['공급가액']);
      const totalconsideration = parseFloat(row['공급대가']);

      let createdAt = new Date(); // 기본값 현재시간
      if (excelDate) {
         try {
           if (typeof excelDate === 'number') {
              const parsedDate = xlsx.SSF.parse_date_code(excelDate);
              if(parsedDate) createdAt = new Date(Date.UTC(parsedDate.y, parsedDate.m - 1, parsedDate.d, parsedDate.H, parsedDate.M, parsedDate.S));
           } else {
              createdAt = new Date(excelDate);
           }
           if (isNaN(createdAt.getTime())) createdAt = new Date();
         } catch (dateError) {
           console.warn(`Row ${rowIndex}: 날짜 변환 오류 (${excelDate})`, dateError);
         }
       }

      const vatYn = (vatYnExcel === '포함') ? 'Y' : 'N';
      const category = '기타';
      let description = row['상품설명'] || '';

      // --- 공급처 이름으로 ID 찾기 (특별 케이스 처리 추가) --- 
      let supplierId = null; // 기본값 null
      const specialSuppliers = ["인터넷최저가", "MRO", "기타"];

      // if (supplierName && !specialSuppliers.includes(supplierName.trim())) {
      if (supplierName) {
        if (supplierName.trim() === "인터넷최저가") {
          supplierId = 1;
        } else if (supplierName.trim() === "MRO") {
          supplierId = 2;
        } else if (supplierName.trim() === "기타") {
          supplierId = 3;
        } else {
        // 특별 케이스가 아닌 경우 기존 로직 (DB 조회)
          try {
            const supplier = await Supplier.findOne({
              where: { name: supplierName.trim() }, // 이름 앞뒤 공백 제거
              attributes: ['id'],
              transaction: t
            });

            if (supplier) {
              supplierId = supplier.id; // 찾았으면 ID 할당
            } else {
              // 등록되지 않은 공급처 오류 처리
              results.failed++;
              results.errors.push({ row: rowIndex, name: name, error: `등록되지 않은 공급처: ${supplierName}` });
              continue;
            }
          } catch (supplierError) {
            // 공급처 조회 오류 처리
            results.failed++;
            results.errors.push({ row: rowIndex, name: name, error: `공급처 조회 오류: ${supplierName}` });
            console.error(`Row ${rowIndex}: 공급처 조회 오류 (${supplierName})`, supplierError);
            continue;
          }
        }
      } else if (supplierName) {
        // 특별 케이스("인터넷 최저가", "MRO", "기타")인 경우
        // supplierId는 null 유지, description에 원본 이름 추가
        description += ` (구매처: ${supplierName.trim()})`; 
      }

      if (!name || isNaN(unitPrice) || isNaN(purchaseQuantity) || isNaN(vat) || isNaN(delivery) || isNaN(supplyvalue) || isNaN(totalconsideration)) {
        results.failed++;
        results.errors.push({ row: rowIndex, name: name || '이름 없음', error: '필수 컬럼(내용, 단가, 수량, 부가세, 배송비, 공급가액, 공급대가) 누락 또는 숫자 형식 오류' });
        continue;
      }

      goodsToCreate.push({
        department,
        name,
        supplierId, // <<< 찾은 ID (숫자) 또는 null (특별 케이스 포함)
        unitPrice,
        vatYn,
        vat,
        purchaseQuantity,
        delivery,
        supplyvalue,
        totalconsideration,
        category,
        description,
        created_at: createdAt
      });
    }

    if (goodsToCreate.length > 0) {
      const createdGoods = await Goods.bulkCreate(goodsToCreate, { transaction: t, validate: true });
      results.success = createdGoods.length;
    }

    await t.commit();

    res.json({
      message: `총 ${data.length}건 중 ${results.success}건 성공, ${results.failed}건 실패`,
      details: results
    });

  } catch (error) {
    await t.rollback();
    console.error('엑셀 가져오기 실패:', error);
    results.failed = data.length > 0 ? data.length - results.success : (data ? data.length : 1);
    results.errors.push({ row: 'N/A', name: 'N/A', error: error.message || '처리 중 오류 발생' });
    res.status(500).json({
      message: '엑셀 파일 처리 중 오류가 발생했습니다.',
      details: results
    });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error('임시 엑셀 파일 삭제 실패:', err);
    });
  }
};

// 엑셀 파일로 상품 내보내기
exports.exportGoodsToExcel = async (req, res) => {
  try {
    const { keyword, category, year, month } = req.query;

    const where = {};
    const nameSearch = keyword;
    if (nameSearch) {
      where.name = { [Op.iLike]: `%${nameSearch}%` };
    }
    if (category) {
      where.category = category;
    }
    if (year && month) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      where.created_at = { [Op.between]: [start, end] };
    } else if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      where.created_at = { [Op.between]: [start, end] };
    } else if (month) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        Sequelize.where(Sequelize.fn('EXTRACT', Sequelize.literal('MONTH FROM "created_at"')), month)
      );
    }

    const goodsList = await Goods.findAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['name']
        }
      ],
      order: [['id', 'DESC']],
      raw: true,
      nest: true
    });

    const excelData = goodsList.map(item => ({
      // 컬럼 순서 조정: '일시'를 첫 번째로
      '일시': item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : '',
      '부서': item.department || '',
      '내용': item.name,
      '구매처': item.supplier?.name || '',
      '단가': item.unitPrice,
      '부가세여부': item.vatYn === 'Y' ? '포함' : '미포함',
      '부가세': item.vat,
      '수량': item.purchaseQuantity,
      '배송비': item.delivery,
      '공급가액': item.supplyvalue,
      '공급대가': item.totalconsideration,
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(excelData);
    xlsx.utils.book_append_sheet(workbook, worksheet, '상품목록');

    const filename = `상품목록_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('엑셀 내보내기 에러:', error);
    res.status(500).json({ message: '엑셀 파일 생성 중 오류가 발생했습니다.' });
  }
};