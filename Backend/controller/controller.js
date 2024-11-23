const { Employees, Education } = require("../models/index.js");
const { Op, where } = require("sequelize");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const ExcelJS = require("exceljs");

const storage = multer.diskStorage({
  destination: "./src/assets/images/",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).single("image_file");

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

exports.getImg = (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, "../src/assets/images", imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).send("Image not found");
    }
  });
};

exports.createNewEmployee = async (req, res) => {
  upload(req, res, async (err) => {
    console.log("Request body:", req.body);
    let image = req.file ? `/assets/images/${req.file.filename}` : null;

    if (err) {
      return res.status(400).send({ message: err });
    }

    if (req.file) {
      image = `/assets/images/${req.file.filename}`;
    }

    const {
      employee_name,
      employee_id,
      gender,
      email,
      phone,
      address,
      department,
      education,
    } = req.body;

    let parsedSkill = [];
    if (req.body.skill) {
      try {
        parsedSkill = Array.isArray(req.body.skill)
          ? req.body.skill
          : JSON.parse(req.body.skill);
      } catch (e) {
        parsedSkill = [];
      }
    }

    let date = "";
    if (req.body.date_of_birth == "") {
      date = null;
    } else {
      date = req.body.date_of_birth;
    }

    const educationArray = Array.isArray(education) ? education : [];

    const cleanedEducation = educationArray.map((entry) => ({
      diploma: entry.diploma || "",
      university_name: entry.university_name || "",
      year: entry.year || "",
    }));

    try {
      const isEmailExists = await Employees.findOne({ where: { email } });
      if (isEmailExists) {
        return res.status(409).json({
          status: 409,
          message: "Email already exists.",
        });
      }

      const isId = await Employees.findOne({ where: { employee_id } });
      if (isId) {
        return res.status(409).json({
          status: 409,
          message: "Employee ID already exists.",
        });
      }
      console.log(date);

      const employee = await Employees.create({
        employee_name,
        employee_id,
        image,
        date_of_birth: date,
        gender,
        email,
        phone,
        address,
        skill: parsedSkill ? parsedSkill.join(",") : "",
        department,
      });

      let educationRecord = [];
      if (cleanedEducation.length > 0) {
        const educationEntries = cleanedEducation.map((entry) => ({
          diploma: entry.diploma,
          university_name: entry.university_name,
          year: entry.year,
          employee_id: employee.id,
        }));

        educationRecord = await Education.bulkCreate(educationEntries);
      }

      res.send({ employee, education: educationRecord });
    } catch (err) {
      if (err.name === "SequelizeValidationError") {
        return res.status(400).json({
          status: 400,
          message: "Validation Error",
          errors: err.errors.map((e) => e.message),
        });
      }
      res.status(500).send({
        message: err.message || "Some error occurred!",
      });
    }
  });
};

exports.findAllEmployees = async (req, res) => {
  try {
    const { keyword } = req.query;
    let condition = {};

    const searchKeyword = keyword ? String(keyword).trim() : "";

    if (searchKeyword) {
      const columns = Object.keys(Employees.rawAttributes);

      condition = {
        [Op.or]: columns.map((column) => {
          if (["employee_id"].includes(column)) {
            const parsedId = parseInt(searchKeyword, 10);
            if (!isNaN(parsedId)) {
              return { [column]: parsedId };
            }
            return {};
          } else if (["date_of_birth"].includes(column)) {
            const parsedDate = new Date(searchKeyword);
            if (!isNaN(parsedDate.getTime())) {
              return { [column]: { [Op.eq]: parsedDate } };
            }
            return {};
          } else if (
            column === "employee_name" ||
            column === "gender" ||
            column === "email" ||
            column === "phone" ||
            column === "address" ||
            column === "department" ||
            column === "skill"
          ) {
            return { [column]: { [Op.iLike]: `%${searchKeyword}%` } };
          }
          return {};
        }),
      };
    }

    const employees = await Employees.findAll({
      where: condition,
      include: [
        {
          model: Education,
          as: "education_backgrounds",
          required: false,
        },
      ],
      order: [["employee_id", "ASC"]],
    });

    if (employees.length === 0) {
      return res.status(404).json({
        message: "No employees found.",
      });
    }

    res.status(200).json(employees);
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
};

exports.getImage = async (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, "../src/assets/images", imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).send("Image not found");
    }
  });
};

exports.updateEmployee = async (req, res) => {
  const id = req.params.id;

  upload(req, res, async (err) => {
    console.log("Request body:", req.body);
    let image = req.body.image;

    if (err) {
      return res.status(400).send({ message: err });
    }

    if (req.body.image) {
      const oldImagePath = path.join(__dirname, "..", "/src", req.body.image);

      if (oldImagePath && fs.existsSync(oldImagePath)) {
        fs.unlink(oldImagePath, (err) => {
          if (err) {
            console.error("Error deleting old image:", err);
          } else {
            console.log("Old image deleted successfully");
          }
        });
      }
    }

    if (req.file) {
      image = `/assets/images/${req.file.filename}`;
    } else if (req.body.image) {
      image = req.body.image;
    }

    const {
      employee_name,
      employee_id,
      gender,
      email,
      phone,
      address,
      department,
      education,
    } = req.body;

    let parsedSkill = [];
    if (req.body.skill) {
      try {
        parsedSkill = Array.isArray(req.body.skill)
          ? req.body.skill
          : JSON.parse(req.body.skill);
      } catch (e) {
        parsedSkill = [];
      }
    }

    let date_of_birth = '';
    if (req.body.date_of_birth == "null" || null) {
      date_of_birth = '';
    } else {
      date_of_birth = req.body.date_of_birth;
    }

    try {
      console.log(date_of_birth);
      await Employees.update(
        {
          employee_name,
          employee_id,
          image,
          date_of_birth,
          gender,
          email,
          phone,
          address,
          skill: parsedSkill ? parsedSkill.join(",") : "",
          department,
        },
        { where: { id } }
      );

      const employee = await Employees.findOne({
        where: { id },
        include: [{ model: Education, as: "education_backgrounds" }],
      });

      await Education.destroy({ where: { employee_id: employee.id } });

      const educationArray = Array.isArray(education) ? education : [];
      console.log(educationArray);

      const cleanedEducation = educationArray.map((entry) => ({
        diploma: entry.diploma || "",
        university_name: entry.university_name || "",
        year: entry.year || "",
      }));

      if (cleanedEducation.length > 0) {
        const educationEntries = cleanedEducation.map((entry) => ({
          diploma: entry.diploma,
          university_name: entry.university_name,
          year: entry.year,
          employee_id: employee.id,
        }));

        await Education.bulkCreate(educationEntries);
      }

      const updatedEmployee = await Employees.findOne({
        where: { id },
        include: [{ model: Education, as: "education_backgrounds" }],
      });

      res.send(updatedEmployee);
    } catch (err) {
      console.error("Error updating employee:", err);
      res.status(500).send({
        message: err.message || "Some error occurred!",
      });
    }
  });
};

exports.deleteOneEmployee = async (req, res) => {
  const id = req.params.id;

  try {
    await Education.destroy({ where: { employee_id: id } });
    const result = await Employees.destroy({ where: { id } });

    if (result === 0) {
      return res.status(404).send({ message: "Employee not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).send({
      message:
        error.message || "Some error occurred while deleting the employee.",
    });
  }
};

exports.exportFile = async (req, res) => {
  try {
    const employees = await Employees.findAll({
      include: [{ model: Education, as: "education_backgrounds" }],
      order: [["employee_id", "ASC"]],
      raw: true,
      nest: true,
    });

    const structuredData = employees.reduce((acc, current) => {
      let employee = acc.find((emp) => emp.id === current.id);

      if (current["education_backgrounds"]) {
        employee = {
          id: current.id,
          employee_name: current.employee_name,
          employee_id: current.employee_id,
          image: current.image,
          date_of_birth: current.date_of_birth,
          gender: current.gender,
          email: current.email,
          phone: current.phone,
          address: current.address,
          skill: current.skill,
          diploma: current["education_backgrounds"].diploma,
          university_name: current["education_backgrounds"].university_name,
          year: current["education_backgrounds"].year,
        };
        acc.push(employee);
      }

      return acc;
    }, []);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employees");

    worksheet.columns = [
      { header: "Employee ID", key: "employee_id", width: 15 },
      { header: "Name", key: "employee_name", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Date of Birth", key: "date_of_birth", width: 15 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Address", key: "address", width: 20 },
      { header: "Skill", key: "skill", width: 15 },
      { header: "Department", key: "department", width: 15 },
      { header: "Education - Diploma", key: "diploma", width: 20 },
      { header: "Education - University", key: "university_name", width: 20 },
      { header: "Education - Year", key: "year", width: 20 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "left" };
    });

    structuredData.forEach((employee) => {
      worksheet.addRow({
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        email: employee.email,
        date_of_birth: employee.date_of_birth,
        gender: employee.gender,
        phone: employee.phone,
        address: employee.address,
        skill: employee.skill,
        department: employee.department,
        diploma: employee.diploma,
        university_name: employee.university_name,
        year: employee.year,
      }).alignment = { horizontal: "left" };
    });

    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, "-");
    const fileName = `Employees_${formattedDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting data:", error);
    res
      .status(500)
      .send({ message: "Error exporting data.", error: error.message });
  }
};

exports.importFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const employeeData = [];
    const educationRecords = [];

    for (const worksheet of workbook.worksheets) {
      console.log(worksheet.rowCount);
      for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (
          rowNumber === 1 ||
          row.values
            .slice(1)
            .every((value) => value === null || value === undefined)
        )
          continue;
        console.log(row.values.slice(1));
        if (row.values.slice(1) == []) continue;
        const [
          employeeId,
          name,
          emailCell,
          dateOfBirth,
          gender,
          phone,
          address,
          skill,
          department,
          diploma,
          university,
          year,
        ] = row.values.slice(1);

        const email =
          typeof emailCell === "object" && emailCell.text
            ? emailCell.text
            : emailCell;

        console.log(employeeId, name, email);

        if (!employeeId || !name || !email) {
          return res.status(400).send({ message: "requirementsnotmet" });
        }

        const existingEmployee = employeeData.find(
          (emp) => emp.employee_id === employeeId
        );

        if (!existingEmployee) {
          const employee = {
            employee_id: employeeId,
            employee_name: name,
            email,
            date_of_birth: dateOfBirth,
            gender,
            phone,
            address,
            skill,
            department,
          };

          employeeData.push(employee);
        }

        if (diploma) {
          const educationEntry = {
            diploma,
            university_name: university,
            year,
            employee_id: employeeId,
          };
          educationRecords.push(educationEntry);
        }
      }
    }

    let employeeRecords;
    try {
      employeeRecords = await Employees.bulkCreate(employeeData, {
        returning: true,
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        const messages = error.errors.map(
          (err) => `${err.path} already exists.`
        );
        return res.status(409).send({ message: messages.join(", ") });
      }
      console.error("Error inserting employees:", error);
      if (!res.headersSent) {
        return res.status(500).send({
          message: "An error occurred while creating employee records.",
        });
      }
    }

    const employeeIdMap = {};
    employeeRecords.forEach((record) => {
      employeeIdMap[record.employee_id] = record.id;
    });

    const finalEducationData = educationRecords.map((edu) => ({
      diploma: edu.diploma,
      university_name: edu.university_name,
      year: edu.year,
      employee_id: employeeIdMap[edu.employee_id],
    }));

    const educationData = await Education.bulkCreate(finalEducationData);

    res.json({
      message: "File processed successfully",
      employeeData,
      educationData,
    });
  } catch (error) {
    console.error("Error processing file:", error);

    res.status(500).send({
      message: "An unexpected error occurred while processing the file.",
    });
  }
};
