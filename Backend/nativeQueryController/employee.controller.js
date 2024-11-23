const pool = require("../db");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

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
  const imagePath = path.join(
    __dirname,
    "../src/assets/images",
    req.params.imageName
  );
  res.sendFile(imagePath, (err) => {
    if (err) res.status(404).send("Image not found");
  });
};

const sendError = (
  res,
  error,
  message = "Some error occurred!",
  status = 500
) => {
  console.error(error);
  res.status(status).send({ message });
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-CA") : null;

const deleteImage = (imagePath) => {
  if (fs.existsSync(imagePath)) {
    fs.unlink(imagePath, (err) => {
      if (err) console.error("Error deleting image:", err);
    });
  }
};

exports.findAllEmployees = async (req, res) => {
  try {
    const { keyword } = req.query;
    const searchKeyword = keyword ? String(keyword).trim() : "";
    const condition = searchCondition(searchKeyword);

    const query = `
      SELECT 
        e.id AS id, e.employee_id, e.employee_name, e.gender, e.image, e.date_of_birth, 
        e.email, e.phone, e.address, e.department, e.skill,
        eb.diploma, eb.university_name, eb.year
      FROM employees e
      LEFT JOIN education_backgrounds eb ON e.id = eb.employee_id
      ${condition}
      ORDER BY e.employee_id ASC;
    `;

    const { rows } = await pool.query(query);
    if (rows.length === 0)
      return res.status(404).json({ message: "No employees found." });

    const employees = formatEmployeeData(rows);
    res.status(200).json(employees);
  } catch (error) {
    sendError(res, error, "Error fetching employees");
  }
};

exports.createNewEmployee = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return sendError(res, err, "File upload failed", 400);

    const image = req.file ? `/assets/images/${req.file.filename}` : null;
    const {
      employee_name,
      employee_id,
      gender,
      email,
      phone,
      address,
      department,
      education,
      skill,
    } = req.body;

    try {
      await validateUniqueEmployee(employee_id, email);

      const parsedSkill = parseSkills(skill);
      const date = req.body.date_of_birth || null;
      const cleanedEducation = parseEducationArray(education);

      const insertQuery = `
        INSERT INTO employees (
          employee_name, employee_id, image, date_of_birth, gender, email, phone, address, skill, department
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING id, employee_name, employee_id, email, phone, address, department;
      `;
      const values = [
        employee_name,
        employee_id,
        image,
        date,
        gender,
        email,
        phone,
        address,
        parsedSkill ? parsedSkill.join(",") : "",
        department,
      ];
      const {
        rows: [newEmployee],
      } = await pool.query(insertQuery, values);

      const educationRecord = await insertEducation(
        cleanedEducation,
        newEmployee.id
      );
      res
        .status(201)
        .send({ employee: newEmployee, education: educationRecord });
    } catch (error) {
      sendError(res, error);
    }
  });
};

exports.updateEmployee = async (req, res) => {
  const id = req.params.id;

  upload(req, res, async (err) => {
    if (err) return sendError(res, err, "File upload failed", 400);

    const {
      employee_name,
      employee_id,
      gender,
      email,
      phone,
      address,
      department,
      education,
      skill,
    } = req.body;

    try {
      const image = handleImageUpdate(req, res);
      const parsedSkill = parseSkills(skill);
      const cleanedEducation = parseEducationArray(education);

      let date = "";
      if (req.body.date_of_birth == "null" || req.body.date_of_birth == null) {
        date = null;
      } else {
        date = req.body.date_of_birth;
      }
      const updateQuery = `
        UPDATE employees 
        SET employee_name = $1, employee_id = $2, image = $3, date_of_birth = $4,
            gender = $5, email = $6, phone = $7, address = $8, skill = $9, department = $10
        WHERE id = $11 RETURNING *;
      `;
      const values = [
        employee_name,
        employee_id,
        image,
        date,
        gender,
        email,
        phone,
        address,
        parsedSkill ? parsedSkill.join(",") : "",
        department,
        id,
      ];
      const {
        rows: [updatedEmployee],
      } = await pool.query(updateQuery, values);

      if (!updatedEmployee)
        return res.status(404).send({ message: "Employee not found" });

      await deleteEducation(updatedEmployee.id);
      await insertEducation(cleanedEducation, updatedEmployee.id);

      const finalEmployee = await fetchUpdatedEmployee(id);
      res.send(finalEmployee);
    } catch (error) {
      sendError(res, error);
    }
  });
};

exports.deleteOneEmployee = async (req, res) => {
  const id = req.params.id;

  try {
    await pool.query("BEGIN");
    await deleteEducation(id);
    const imageQuery = "SELECT image FROM employees WHERE id = $1";
    const {
      rows: [employee],
    } = await pool.query(imageQuery, [id]);

    if (!employee) {
      await pool.query("ROLLBACK");
      return res.status(404).send({ message: "Employee not found" });
    }

    if (employee.image) {
      deleteImage(path.join(__dirname, "../", employee.image));
    }

    const deleteQuery = `DELETE FROM employees WHERE id = $1 RETURNING id;`;
    const { rowCount } = await pool.query(deleteQuery, [id]);

    if (rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).send({ message: "Employee not found" });
    }

    await pool.query("COMMIT");
    res.status(204).send();
  } catch (error) {
    await pool.query("ROLLBACK");
    sendError(res, error, "Error deleting employee");
  }
};

function searchCondition(searchKeyword) {
  if (!searchKeyword) return "";

  const parsedId = parseInt(searchKeyword, 10);
  const parsedDate = new Date(searchKeyword);

  return `
    WHERE 
      ${!isNaN(parsedId) ? `e.employee_id = ${parsedId}` : "FALSE"} OR
      ${
        !isNaN(parsedDate.getTime())
          ? `e.date_of_birth = '${formatDate(parsedDate)}'`
          : "FALSE"
      } OR
      e.employee_name ILIKE '%${searchKeyword}%' OR
      e.gender ILIKE '%${searchKeyword}%' OR
      e.email ILIKE '%${searchKeyword}%' OR
      e.phone ILIKE '%${searchKeyword}%' OR
      e.address ILIKE '%${searchKeyword}%' OR
      e.department ILIKE '%${searchKeyword}%' OR
      e.skill ILIKE '%${searchKeyword}%'
  `;
}

function formatEmployeeData(rows) {
  return rows.reduce((acc, row) => {
    const {
      id,
      employee_id,
      employee_name,
      gender,
      image,
      date_of_birth,
      email,
      phone,
      address,
      department,
      skill,
      diploma,
      university_name,
      year,
    } = row;

    let employee = acc.find((e) => e.employee_id === employee_id);
    if (!employee) {
      employee = {
        id,
        employee_id,
        employee_name,
        gender,
        image,
        date_of_birth: formatDate(date_of_birth),
        email,
        phone,
        address,
        department,
        skill,
        education_backgrounds: [],
      };
      acc.push(employee);
    }

    if (diploma || university_name || year) {
      employee.education_backgrounds.push({ diploma, university_name, year });
    }
    return acc;
  }, []);
}

async function validateUniqueEmployee(employee_id, email) {
  const emailCheckQuery = "SELECT 1 FROM employees WHERE email = $1";
  const idCheckQuery = "SELECT 1 FROM employees WHERE employee_id = $1";

  const emailExists = (await pool.query(emailCheckQuery, [email])).rowCount > 0;
  const idExists = (await pool.query(idCheckQuery, [employee_id])).rowCount > 0;

  if (emailExists) throw new Error("Email already exists.");
  if (idExists) throw new Error("Employee ID already exists.");
}

function parseSkills(skill) {
  try {
    return Array.isArray(skill) ? skill : JSON.parse(skill);
  } catch {
    return [];
  }
}

function parseEducationArray(education) {
  return Array.isArray(education) ? education : [];
}

function handleImageUpdate(req, res) {
  const imagePath = req.file ? `/assets/images/${req.file.filename}` : null;
  if (req.file && req.body.image) {
    deleteImage(path.join(__dirname, "../", req.body.image));
  }
  return imagePath;
}

async function insertEducation(educationArray, employeeId) {
  const insertQuery = `
    INSERT INTO education_backgrounds (employee_id, diploma, university_name, year)
    VALUES ($1, $2, $3, $4) RETURNING *;
  `;
  for (const { diploma, university_name, year } of educationArray) {
    await pool.query(insertQuery, [employeeId, diploma, university_name, year]);
  }
}

async function deleteEducation(employeeId) {
  const deleteQuery =
    "DELETE FROM education_backgrounds WHERE employee_id = $1";
  await pool.query(deleteQuery, [employeeId]);
}

async function fetchUpdatedEmployee(employeeId) {
  const query = `
    SELECT 
      e.id, e.employee_id, e.employee_name, e.gender, e.image, e.date_of_birth, 
      e.email, e.phone, e.address, e.department, e.skill,
      eb.diploma, eb.university_name, eb.year
    FROM employees e
    LEFT JOIN education_backgrounds eb ON e.id = eb.employee_id
    WHERE e.id = $1
  `;
  const { rows } = await pool.query(query, [employeeId]);
  return formatEmployeeData(rows)[0];
}