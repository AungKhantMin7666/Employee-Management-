const pool = require("../db");
const ExcelJS = require("exceljs");
const fs = require("fs");

exports.exportFile = async (req, res) => {
  try {
    const query = `
      SELECT
        e.id AS id,
        e.employee_id AS employee_id,
        e.employee_name AS employee_name,
        e.image AS image,
        e.date_of_birth AS date_of_birth,
        e.gender AS gender,
        e.email AS email,
        e.phone AS phone,
        e.address AS address,
        e.skill AS skill,
        e.department AS department,
        eb.diploma AS diploma,
        eb.university_name AS university_name,
        eb.year AS year
      FROM employees e
      LEFT JOIN education_backgrounds eb
      ON e.id = eb.employee_id
      ORDER BY e.employee_id ASC;
    `;
    const { rows } = await pool.query(query);

    const structuredData = rows.reduce((acc, current) => {
      let employee = acc.find((emp) => emp.id === current.id);

      if (!employee) {
        employee = {
          id: current.id,
          employee_id: current.employee_id,
          employee_name: current.employee_name,
          image: current.image,
          date_of_birth: current.date_of_birth,
          gender: current.gender,
          email: current.email,
          phone: current.phone,
          address: current.address,
          skill: current.skill,
          department: current.department,
          education: [],
        };
        acc.push(employee);
      }

      if (current.diploma || current.university_name || current.year) {
        employee.education.push({
          diploma: current.diploma,
          university_name: current.university_name,
          year: current.year,
        });
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
      { header: "Education - Year", key: "year", width: 10 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "left" };
    });

    structuredData.forEach((employee) => {
      if (employee.education.length > 0) {
        employee.education.forEach((edu) => {
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
            diploma: edu.diploma,
            university_name: edu.university_name,
            year: edu.year,
          });
        });
      } else {
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
          diploma: "",
          university_name: "",
          year: "",
        });
      }
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
      for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (
          rowNumber === 1 ||
          row.values
            .slice(1)
            .every((value) => value === null || value === undefined)
        )
          continue;

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

        const date = new Date(dateOfBirth).toISOString();

        if (!employeeId || !name || !email) {
          return res.status(400).send({
            message: "requirementsnotmet",
          });
        }

        const existingEmployee = employeeData.find(
          (emp) => emp.employee_id === employeeId
        );

        if (!existingEmployee) {
          const employee = {
            employee_id: employeeId,
            employee_name: name,
            email,
            date_of_birth: date,
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

    const client = await pool.connect();
    console.log(employeeData);

    try {
      await client.query("BEGIN");

      const employeeIds = employeeData
        .map((emp) => `'${emp.employee_id}'`)
        .join(",");
      const existingIdQuery = `
        SELECT employee_id
        FROM employees
        WHERE employee_id IN (${employeeIds});
      `;
      const { rows: duplicateIds } = await client.query(existingIdQuery);

      const emails = employeeData.map((emp) => `'${emp.email}'`).join(",");
      const existingEmailQuery = `
        SELECT email
        FROM employees
        WHERE email IN (${emails});
      `;
      const { rows: duplicateEmails } = await client.query(existingEmailQuery);

      if (duplicateIds.length > 0) {
        return res.status(409).json({
          message: "employee_id already exists",
        });
      }

      if (duplicateEmails.length > 0) {
        return res.status(409).json({
          message: "email already exists",
        });
      }

      const employeeValues = employeeData
        .map(
          (emp) => `(
            '${emp.employee_id}',
            '${emp.employee_name.replace(/'/g, "''")}',
            '${emp.email}',
            ${emp.date_of_birth ? `'${emp.date_of_birth}'` : "NULL"},
            ${emp.gender ? `'${emp.gender}'` : "NULL"},
            ${emp.phone ? `'${emp.phone}'` : "NULL"},
            ${emp.address ? `'${emp.address.replace(/'/g, "''")}'` : "NULL"},
            ${emp.skill ? `'${emp.skill.replace(/'/g, "''")}'` : "NULL"},
            ${
              emp.department
                ? `'${emp.department.replace(/'/g, "''")}'`
                : "NULL"
            }
          )`
        )
        .join(",");

      const employeeInsertQuery = `
        INSERT INTO employees (
          employee_id, employee_name, email, date_of_birth, gender, phone, address, skill, department
        ) VALUES ${employeeValues}
        ON CONFLICT (employee_id) DO NOTHING
        RETURNING id, employee_id;
      `;

      const { rows: insertedEmployees } = await client.query(
        employeeInsertQuery
      );

      const employeeIdMap = {};
      insertedEmployees.forEach((record) => {
        employeeIdMap[record.employee_id] = record.id;
      });

      const educationValues = educationRecords
        .map((edu) => {
          const dbEmployeeId = employeeIdMap[edu.employee_id];
          if (!dbEmployeeId) return null;

          return `(
            '${edu.diploma.replace(/'/g, "''")}',
            '${edu.university_name.replace(/'/g, "''")}',
            ${edu.year ? `'${edu.year}'` : "NULL"},
            ${dbEmployeeId}
          )`;
        })
        .filter(Boolean)
        .join(",");

      if (educationValues) {
        const educationInsertQuery = `
          INSERT INTO education_backgrounds (diploma, university_name, year, employee_id)
          VALUES ${educationValues};
        `;

        await client.query(educationInsertQuery);
      }

      await client.query("COMMIT");

      res.json({
        message: "File processed successfully",
        employees: insertedEmployees,
        educationCount: educationRecords.length,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error processing file:", error);
      res.status(500).send({
        message: "An error occurred while processing the file.",
      });
    } finally {
      client.release();
    }

    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send({
      message: "An unexpected error occurred while processing the file.",
    });
  }
};
