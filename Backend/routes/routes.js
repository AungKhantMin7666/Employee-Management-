const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ dest: 'uploads/' });

module.exports = (app) => {
  const employee = require("../nativeQueryController/employee.controller");
  const importExport = require("../nativeQueryController/importExport.controller");

  const router = require("express").Router();

  router.get("/assets/images/:imageName", employee.getImg);
  router.post("/employee", employee.createNewEmployee);
  router.get("/employee", employee.findAllEmployees);
  router.put("/employee/:id", employee.updateEmployee);
  router.delete("/employee/:id", employee.deleteOneEmployee);
  router.get("/export", importExport.exportFile);
  router.post("/import", upload.single("file"), importExport.importFile);
  app.use("/api", router);
};