// models/goods.js
module.exports = (sequelize, DataTypes) => {
  const Goods = sequelize.define('Goods', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '상품명'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unit_price',
      comment: '단가'
    },
    vatYn: {
      type: DataTypes.CHAR(1),
      defaultValue: 'Y',
      field: 'vat_yn',
      comment: '과세여부 (Y: 과세, N: 면세)'
    },
    supplierId: {
      type: DataTypes.INTEGER,
      field: 'supplier_id',
      comment: '공급사 ID'
    },
    category: {
      type: DataTypes.STRING(50),
      comment: '카테고리'
    },
    purchaseQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'purchase_quantity',
      comment: '구매수량'
    },
    description: {
      type: DataTypes.TEXT,
      comment: '상품 설명'
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      field: 'image_url',
      comment: '상품 이미지 URL'
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '부서명'
    },
    vat: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '부가세'
    },
    delivery: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '배송비'
    },
    supplyvalue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '공급가액'
    },
    totalconsideration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '공급대가'
    }
  }, {
    tableName: 'goods_master',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Supplier와의 관계 선언
  Goods.associate = function(models) {
    Goods.belongsTo(models.Supplier, {
      foreignKey: 'supplier_id',
      as: 'supplier'
    });
  };

  return Goods;
};