from flask import Flask, send_file, jsonify, request
from openpyxl import Workbook
import pandas as pd
from psycopg2 import sql
from werkzeug.utils import secure_filename
from io import BytesIO
import os
from datetime import datetime
from db import get_db_connection

app = Flask(__name__)

def export_file():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
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
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        structured_data = {}
        for row in rows:
            employee_id = row[1]
            if employee_id not in structured_data:
                structured_data[employee_id] = {
                    'id': row[0],
                    'employee_id': row[1],
                    'employee_name': row[2],
                    'image': row[3],
                    'date_of_birth': row[4],
                    'gender': row[5],
                    'email': row[6],
                    'phone': row[7],
                    'address': row[8],
                    'skill': row[9],
                    'department': row[10],
                    'education': []
                }
            if row[11] or row[12] or row[13]:
                structured_data[employee_id]['education'].append({
                    'diploma': row[11],
                    'university_name': row[12],
                    'year': row[13]
                })

        wb = Workbook()
        ws = wb.active
        ws.title = "Employees"

        headers = [
            "Employee ID", "Name", "Email", "Date of Birth", "Gender",
            "Phone", "Address", "Skill", "Department", "Education - Diploma",
            "Education - University", "Education - Year"
        ]
        ws.append(headers)
        
        column_widths = {
            "A": 15,
            "B": 20,
            "C": 25,
            "D": 15,
            "E": 10,
            "F": 15,
            "G": 20,
            "H": 15, 
            "I": 15,
            "J": 20,
            "K": 25,
            "L": 10
        }
        
        for col, width in column_widths.items():
            ws.column_dimensions[col].width = width

        for employee in structured_data.values():
            if employee['education']:
                for edu in employee['education']:
                    row = [
                        employee['employee_id'],
                        employee['employee_name'],
                        employee['email'],
                        employee['date_of_birth'],
                        employee['gender'],
                        employee['phone'],
                        employee['address'],
                        employee['skill'],
                        employee['department'],
                        edu['diploma'],
                        edu['university_name'],
                        edu['year']
                    ]
                    ws.append(row)
            else:
                row = [
                    employee['employee_id'],
                    employee['employee_name'],
                    employee['email'],
                    employee['date_of_birth'],
                    employee['gender'],
                    employee['phone'],
                    employee['address'],
                    employee['skill'],
                    employee['department'],
                    '',
                    '',
                    ''
                ]
                ws.append(row)

        now = datetime.now()
        formatted_date = now.strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"Employees_{formatted_date}.xlsx"

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as error:
        print("Error exporting data:", error)
        return jsonify({"message": "Error exporting data.", "error": str(error)}), 
    
def sanitize_input(input_string):
    if isinstance(input_string, str):
        return input_string.replace("'", "''")
    return input_string

def import_file():
    try:
        if 'file' not in request.files:
            return jsonify({"message": "No file uploaded"}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({"message": "No file selected"}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join("uploads", filename)
        file.save(file_path)

        df = pd.read_excel(file_path)

        employee_data = []
        education_records = []
        inserted_employees = []

        for index, row in df.iterrows():
            employee_id = row['Employee ID']
            name = row['Name']
            email = row['Email']
            date_of_birth = row['Date of Birth']
            gender = row['Gender']
            phone = row['Phone']
            address = row['Address']
            skill = row['Skill']
            department = row['Department']
            diploma = row['Education - Diploma']
            university = row['Education - University']
            year = row['Education - Year']

            if pd.isna(employee_id) or pd.isna(name) or pd.isna(email):
                return jsonify({"message": "Employee ID, Name, and Email are required."}), 400

            if not any(emp['employee_id'] == employee_id for emp in employee_data):
                employee_data.append({
                    'employee_id': employee_id,
                    'employee_name': name,
                    'email': email,
                    'date_of_birth': date_of_birth,
                    'gender': gender,
                    'phone': phone,
                    'address': address,
                    'skill': skill,
                    'department': department
                })

            if pd.notna(diploma):
                education_records.append({
                    'diploma': diploma,
                    'university_name': university,
                    'year': year,
                    'employee_id': employee_id
                })

        conn = get_db_connection()
        cur = conn.cursor()

        try:
            cur.execute("BEGIN;")

            employee_ids = [emp['employee_id'] for emp in employee_data]
            emails = [emp['email'] for emp in employee_data]

            cur.execute(sql.SQL("SELECT employee_id FROM employees WHERE employee_id IN %s"), [tuple(employee_ids)])
            existing_ids = {row[0] for row in cur.fetchall()}

            cur.execute(sql.SQL("SELECT email FROM employees WHERE email IN %s"), [tuple(emails)])
            existing_emails = {row[0] for row in cur.fetchall()}

            if existing_ids:
                return jsonify({"message": "employee_id already exists"}), 409
            if existing_emails:
                return jsonify({"message": "email already exists"}), 409

            employee_values = [
                (
                    emp['employee_id'],
                    sanitize_input(emp['employee_name']),
                    sanitize_input(emp['email']),
                    emp['date_of_birth'].strftime('%Y-%m-%d') if isinstance(emp['date_of_birth'], datetime) else emp['date_of_birth'],
                    sanitize_input(emp['gender']),
                    sanitize_input(emp['phone']),
                    sanitize_input(emp['address']),
                    sanitize_input(emp['skill']),
                    sanitize_input(emp['department'])
                ) for emp in employee_data
            ]
            
            print(employee_values)
            
            
            for emp in employee_values:
                try:
                    cur.execute("""
                        INSERT INTO employees (
                            employee_id, employee_name, email, date_of_birth, gender, phone, address, skill, department
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (employee_id) DO NOTHING
                        RETURNING id, employee_id;
                    """, emp)

                    inserted_employee = cur.fetchone()
                    print(inserted_employee)
                    if inserted_employee:
                        inserted_employees.append(inserted_employee)
                except Exception as e:
                    print(f"Error inserting employee {emp[0]}: {e}")
                    conn.rollback()
                    continue 

            employee_id_map = {emp[1]: emp[0] for emp in inserted_employees}

            education_values = [
                (
                    sanitize_input(edu['diploma']),
                    sanitize_input(edu['university_name']),
                    edu['year'],
                    employee_id_map.get(edu['employee_id'])
                ) for edu in education_records if edu['employee_id'] in employee_id_map
            ]

            if education_values:
                cur.executemany("""
                    INSERT INTO education_backgrounds (diploma, university_name, year, employee_id)
                    VALUES (%s, %s, %s, %s);
                """, education_values)

            conn.commit()

            return jsonify({
                "message": "File processed successfully",
                "employees": inserted_employees,
                "educationCount": len(education_records)
            })

        except Exception as error:
            conn.rollback()
            print("Error processing file:", error)
            return jsonify({"message": "An error occurred while processing the file."}), 500

        finally:
            cur.close()
            conn.close()
            os.remove(file_path)

    except Exception as error:
        print("Unexpected error:", error)
        return jsonify({"message": "An unexpected error occurred while processing the file."}), 500