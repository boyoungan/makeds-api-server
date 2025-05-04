// models/purchaseRequestItem.js
module.exports = (sequelize, DataTypes) => {
  const PurchaseRequestItem = sequelize.define('PurchaseRequestItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    purchase_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '구매요청 ID'
    },
    goods_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '상품 ID'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '수량'
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: '단가'
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: '금액 (단가 x 수량)'
    },
    vat: {
      type: DataTypes.DECIMAL(10, 2),
      comment: '부가세'
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: '배송비'
    },
    total_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: '총 금액 (금액 + 부가세 + 배송비)'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: '비고'
    }
  }, {
    tableName: 'purchase_request_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PurchaseRequestItem.associate = function(models) {
    PurchaseRequestItem.belongsTo(models.PurchaseRequest, {
      foreignKey: 'purchase_request_id',
      as: 'purchaseRequest'
    });

    PurchaseRequestItem.belongsTo(models.Goods, {
      foreignKey: 'goods_id',
      as: 'goods'
    });
  };

  return PurchaseRequestItem;
};