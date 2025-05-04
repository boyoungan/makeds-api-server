'use strict';

const { Op } = require('sequelize'); // Op 임포트 필요

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const defaultSuppliers = [
      {
        name: "인터넷 최저가",
        is_active: true,
        // 다른 필수 컬럼이 있다면 기본값 추가
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: "MRO",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: "기타",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // 이미 존재하는지 확인하고 없는 것만 추가
    const existingNames = defaultSuppliers.map(s => s.name);
    let existingSuppliers = [];
    try {
        // 테이블이 없을 수도 있으므로 try-catch
        const result = await queryInterface.sequelize.query(
            `SELECT name FROM suppliers WHERE name IN (:names)`, 
            {
                replacements: { names: existingNames },
                type: queryInterface.sequelize.QueryTypes.SELECT,
                raw: true
            }
        );
        existingSuppliers = result || [];
    } catch (error) {
        // 테이블이 없거나 다른 오류 발생 시 빈 배열 유지
        console.warn('Could not check existing suppliers, proceeding with insert attempt:', error.message);
    }

    const existingSupplierNames = existingSuppliers.map(s => s.name);
    const suppliersToInsert = defaultSuppliers.filter(s => !existingSupplierNames.includes(s.name));

    if (suppliersToInsert.length > 0) {
      await queryInterface.bulkInsert('suppliers', suppliersToInsert, {});
      console.log(`Inserted ${suppliersToInsert.length} default suppliers.`);
    } else {
      console.log('Default suppliers already exist or table not found.');
    }
  },

  async down (queryInterface, Sequelize) {
    // 추가한 기본 공급처 삭제
    await queryInterface.bulkDelete('suppliers', {
      name: {
        [Op.in]: ["인터넷 최저가", "MRO", "기타"]
      }
    }, {});
    console.log('Deleted default suppliers.');
  }
}; 