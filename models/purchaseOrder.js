// models/purchaseOrder.js
module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '발주번호'
    },
    purchase_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '구매요청 ID'
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '공급사 ID'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'created',
      comment: '상태 (created, sent, delivered, completed)'
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '총 금액'
    },
    order_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '발주일'
    },
    expected_delivery_date: {
      type: DataTypes.DATE,
      comment: '예상 배송일'
    },
    actual_delivery_date: {
      type: DataTypes.DATE,
      comment: '실제 배송일'
    },
    orderer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '발주자 ID'
    },
    payment_terms: {
      type: DataTypes.STRING(100),
      comment: '결제 조건'
    },
    shipping_address: {
      type: DataTypes.TEXT,
      comment: '배송 주소'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: '비고'
    }
  }, {
    tableName: 'purchase_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PurchaseOrder.associate = function(models) {
    PurchaseOrder.belongsTo(models.PurchaseRequest, {
      foreignKey: 'purchase_request_id',
      as: 'purchaseRequest'
    });

    PurchaseOrder.belongsTo(models.User, {
      foreignKey: 'orderer_id',
      as: 'orderer'
    });

    PurchaseOrder.hasMany(models.PurchaseOrderItem, {
      foreignKey: 'purchase_order_id',
      as: 'items'
    });
  };

  return PurchaseOrder;
};