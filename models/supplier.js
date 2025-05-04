// models/supplier.js
module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '공급사명'
    },
    business_number: {
      type: DataTypes.STRING(20),
      comment: '사업자번호'
    },
    contact_name: {
      type: DataTypes.STRING(50),
      comment: '담당자명'
    },
    contact_email: {
      type: DataTypes.STRING(100),
      comment: '담당자 이메일'
    },
    contact_phone: {
      type: DataTypes.STRING(20),
      comment: '담당자 연락처'
    },
    address: {
      type: DataTypes.TEXT,
      comment: '주소'
    },
    bank_name: {
      type: DataTypes.STRING(50),
      comment: '은행명'
    },
    account_number: {
      type: DataTypes.STRING(50),
      comment: '계좌번호'
    },
    account_holder: {
      type: DataTypes.STRING(50),
      comment: '예금주'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: '비고'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '활성화 여부'
    }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Supplier.associate = function(models) {
    Supplier.hasMany(models.Goods, {
      foreignKey: 'supplier_id',
      as: 'goods'
    });
  };

  return Supplier;
};