'use strict';
module.exports = (sequelize, DataTypes) => {
  const RFID_Card = sequelize.define('RFID_Card', {
    card_uid: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        name: 'card_uid_unique',
        msg: 'This RFID card is already registered'
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    issued_at: DataTypes.DATE,
    deactivated_at: DataTypes.DATE
  }, {
    tableName: 'RFID_Cards',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['card_uid'],
        name: 'card_uid_unique'
      }
    ]
  });

  RFID_Card.associate = function(models) {
    // many cards -> 1 User
    RFID_Card.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
  };

  return RFID_Card;
};
