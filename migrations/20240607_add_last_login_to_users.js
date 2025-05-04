// 20240607_add_last_login_to_users.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'last_login', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '마지막 로그인 시간'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'last_login');
  }
};
