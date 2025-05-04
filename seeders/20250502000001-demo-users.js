'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    // 비밀번호 해시 생성 (비밀번호: admin123!@#)
    const passwordHash = await bcrypt.hash('admin123!@#', 10);
    
    return queryInterface.bulkInsert('users', [
      {
        employee_number: 'admin',
        company_id: 'mcp',
        username: '관리자',
        password_hash: passwordHash,
        password_salt: '',
        failed_attempts: 0,
        is_locked: false,
        role: 'admin',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        employee_number: 'test',
        company_id: 'mcp',
        username: '테스트 사용자',
        password_hash: passwordHash,
        password_salt: '',
        failed_attempts: 0,
        is_locked: false,
        role: 'user',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', null, {});
  }
};