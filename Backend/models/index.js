const config = require("../config/config.js");
const Sequelize = require("sequelize");
const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
});

const models = {
    Employees: require("./employee.model.js")(sequelize, Sequelize),
    Education: require("./education.model.js")(sequelize, Sequelize),
  };

Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });
  
  models.sequelize = sequelize;
  models.Sequelize = Sequelize;
  
  module.exports = models;