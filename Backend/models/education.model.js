module.exports = (sequelize, Sequelize) => {
  const Education = sequelize.define(
    "education_backgrounds",
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "employees",
          key: "employee_id",
        },
      },
      diploma: {
        type: Sequelize.STRING,
      },
      university_name: {
        type: Sequelize.STRING,
      },
      year: {
        type: Sequelize.INTEGER,
      },
    },
    { timestamps: false }
  );

  Education.associate = (models) => {
    Education.belongsTo(models.Employees, {
      as: "education_backgrounds",
      foreignKey: "employee_id",
      onDelete: "CASCADE",
    });
  };

  return Education;
};
