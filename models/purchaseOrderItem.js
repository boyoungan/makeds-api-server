// models/purchaseOrderItem.js
module.exports = (sequelize, DataTypes) => {
  const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    purchase_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '구매발주 ID'
    },
    goods_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '상품 ID'
    },
    purchase_request_item_id: {
      type: DataTypes.INTEGER,
      comment: '구매요청 아이템 ID'
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
    received_quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '수령 수량'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: '비고'
    }
  }, {
    tableName: 'purchase_order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PurchaseOrderItem.associate = function(models) {
    PurchaseOrderItem.belongsTo(models.PurchaseOrder, {
      foreignKey: 'purchase_order_id',
      as: 'purchaseOrder'
    });

    PurchaseOrderItem.belongsTo(models.Goods, {
      foreignKey: 'goods_id',
      as: 'goods'
    });

    PurchaseOrderItem.belongsTo(models.PurchaseRequestItem, {
      foreignKey: 'purchase_request_item_id',
      as: 'purchaseRequestItem'
    });
  };

  return PurchaseOrderItem;
};