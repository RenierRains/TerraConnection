'use strict';
module.exports = (sequelize, DataTypes) => {
  const Guardian_Student = sequelize.define('Guardian_Student', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    }
  }, {
    tableName: 'Guardian_Students',
    underscored: true,
    timestamps: false 
  });

  Guardian_Student.associate = function(models) {
    Guardian_Student.belongsTo(models.User, { foreignKey: 'guardian_id', as: 'guardian' });
    Guardian_Student.belongsTo(models.User, { foreignKey: 'student_id', as: 'student' });
  };

  return Guardian_Student;
};
