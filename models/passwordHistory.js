// models/passwordHistory.js
module.exports = (sequelize, DataTypes) => {
  const PasswordHistory = sequelize.define('PasswordHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '사용자 ID'
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '비밀번호 해시'
    },
    changed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '비밀번호 변경 시간'
    }
  }, {
    tableName: 'password_history',
    timestamps: false
  });

  PasswordHistory.associate = function(models) {
    PasswordHistory.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return PasswordHistory;
};