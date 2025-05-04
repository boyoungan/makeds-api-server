// models/purchaseRequest.js
module.exports = (sequelize, DataTypes) => {
  const PurchaseRequest = sequelize.define('PurchaseRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    request_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '요청번호'
    },
    requester_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '요청자 ID'
    },
    department: {
      type: DataTypes.STRING(100),
      comment: '부서'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      comment: '상태 (pending, approved, rejected, completed)'
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '총 금액'
    },
    requested_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '요청일'
    },
    approval_date: {
      type: DataTypes.DATE,
      comment: '승인일'
    },
    approver_id: {
      type: DataTypes.INTEGER,
      comment: '승인자 ID'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: '비고'
    }
  }, {
    tableName: 'purchase_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PurchaseRequest.associate = function(models) {
    PurchaseRequest.belongsTo(models.User, {
      foreignKey: 'requester_id',
      as: 'requester'
    });

    PurchaseRequest.belongsTo(models.User, {
      foreignKey: 'approver_id',
      as: 'approver'
    });

    PurchaseRequest.hasMany(models.PurchaseRequestItem, {
      foreignKey: 'purchase_request_id',
      as: 'items'
    });
  };

  return PurchaseRequest;
};