// models/user.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    employee_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '사번'
    },
    company_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '회사 ID'
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '사용자명'
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '비밀번호 해시'
    },
    password_salt: {
      type: DataTypes.STRING(255),
      comment: '비밀번호 솔트'
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '로그인 실패 횟수'
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '계정 잠금 여부'
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'user',
      comment: '역할 (admin, user 등)'
    },
    last_login: {
      type: DataTypes.DATE,
      comment: '마지막 로그인 시간'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return User;
};