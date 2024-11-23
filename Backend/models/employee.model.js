module.exports = (sequelize, Sequelize) => {
  const Employees = sequelize.define(
    "employees",
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      employee_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      image: {
        type: Sequelize.STRING,
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
      },
      gender: {
        type: Sequelize.STRING,
      },
      email: {
        type: Sequelize.STRING,
      },
      phone: {
        type: Sequelize.STRING,
      },
      address: {
        type: Sequelize.STRING,
      },
      skill: {
        type: Sequelize.STRING,
      },
      department: {
        type: Sequelize.STRING,
      },
    },
    { timestamps: false }
  );

  Employees.associate = (models) => {
    Employees.hasMany(models.Education, {
      as: "education_backgrounds",
      foreignKey: "employee_id",
      onDelete: "CASCADE",
    });
  };

  return Employees;
};
