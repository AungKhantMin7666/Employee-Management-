from flask import Flask, Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import psycopg2
from db import get_db_connection
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def get_img(image_name):
    
    if(image_name):
        return send_from_directory(UPLOAD_FOLDER, image_name)
    
    return jsonify({"error": "File not found"}), 404

def format_date(date):
    try:
        date = date.strftime('%Y-%m-%d') if date else None
    except:
        date = None
    return date

def search_condition(search_keyword):
    if not search_keyword:
        return ""
    
    try:
        parsed_id = int(search_keyword)
        parsed_date = None
    except ValueError:
        try:
            parsed_date = datetime.strptime(search_keyword, '%Y-%m-%d')
            parsed_id = None
        except ValueError:
            parsed_date = None
            parsed_id = None

    condition = "WHERE "
    
    if parsed_id:
        condition += f"e.employee_id = {parsed_id} OR "
    if parsed_date:
        condition += f"e.date_of_birth = '{format_date(parsed_date)}' OR "
    
    condition += f"e.employee_name ILIKE '%{search_keyword}%' OR " \
                 f"e.gender ILIKE '%{search_keyword}%' OR " \
                 f"e.email ILIKE '%{search_keyword}%' OR " \
                 f"e.phone ILIKE '%{search_keyword}%' OR " \
                 f"e.address ILIKE '%{search_keyword}%' OR " \
                 f"e.department ILIKE '%{search_keyword}%' OR " \
                 f"e.skill ILIKE '%{search_keyword}%'"
    
    return condition

def format_employee_data(rows):
    employees = []
    for row in rows:
        employee = next((e for e in employees if e['employee_id'] == row['employee_id']), None)
        if not employee:
            employee = {
                'id': row['id'],
                'employee_id': row['employee_id'],
                'employee_name': row['employee_name'],
                'gender': row['gender'],
                'image': row['image'],
                'date_of_birth': format_date(row['date_of_birth']),
                'email': row['email'],
                'phone': row['phone'],
                'address': row['address'],
                'department': row['department'],
                'skill': row['skill'],
                'education_backgrounds': []
            }
            employees.append(employee)
        
        if row['diploma'] or row['university_name'] or row['year']:
            employee['education_backgrounds'].append({
                'diploma': row['diploma'],
                'university_name': row['university_name'],
                'year': row['year']
            })
    
    return employees

def validate_unique_employee(employee_id, email):
    conn = get_db_connection()
    cursor = conn.cursor()

    email_check_query = "SELECT 1 FROM employees WHERE email = %s"
    id_check_query = "SELECT 1 FROM employees WHERE employee_id = %s"

    cursor.execute(email_check_query, (email,))
    email_exists = cursor.fetchone()
    cursor.execute(id_check_query, (employee_id,))
    id_exists = cursor.fetchone()

    if email_exists:
        raise Exception("Email already exists.")
    if id_exists:
        raise Exception("Employee ID already exists.")

    cursor.close()
    conn.close()

def parse_education_array(form_data):
    education = []
    for key, value in form_data.items():
        if key.startswith('education['):
            parts = key.split('[')
            index = int(parts[1][:-1])
            field = parts[2][:-1]
            
            while len(education) <= index:
                education.append({})
            
            education[index][field] = value
    return education

def insert_education(education_array, employee_id, cursor):
    education_record = []
    insert_query = """
        INSERT INTO education_backgrounds (employee_id, diploma, university_name, year)
        VALUES (%s, %s, %s, %s) RETURNING *;
    """
    for edu in education_array:
        diploma = edu.get('diploma')
        university_name = edu.get('university_name')
        year = edu.get('year')
        cursor.execute(insert_query, (employee_id, diploma, university_name, year))
        education_record.append(cursor.fetchone())
    return education_record

def delete_education(employee_id, cursor):
    delete_query = "DELETE FROM education_backgrounds WHERE employee_id = %s"
    cursor.execute(delete_query, [employee_id])


def fetch_updated_employee(employee_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    fetch_query = "SELECT * FROM employees WHERE id = %s"
    cursor.execute(fetch_query, [employee_id])
    employee = cursor.fetchone()
    cursor.close()
    conn.close()
    return {"employee": employee} if employee else None

def delete_image(image_path):
    
    image_filename = image_path.replace('/assets/images/', '')

    full_image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
    
    if os.path.exists(full_image_path):
        os.remove(full_image_path)

def find_all_employees():
    try:
        keyword = request.args.get('keyword', '')
        search_keyword = keyword.strip() if keyword else ''
        condition = search_condition(search_keyword)

        conn = get_db_connection()
        if not conn:
            return jsonify({'message': 'Database connection error'}), 500
        
        query = f"""
            SELECT 
                e.id, e.employee_id, e.employee_name, e.gender, e.image, e.date_of_birth,
                e.email, e.phone, e.address, e.department, e.skill,
                eb.diploma, eb.university_name, eb.year
            FROM employees e
            LEFT JOIN education_backgrounds eb ON e.id = eb.employee_id
            {condition}
            ORDER BY e.employee_id ASC;
        """
        
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if not rows:
            return jsonify({'message': 'No employees found.'}), 404
        
        columns = [desc[0] for desc in cursor.description]
        rows_dict = [dict(zip(columns, row)) for row in rows]
        
        employees = format_employee_data(rows_dict)
        
        cursor.close()
        conn.close()

        return jsonify(employees), 200
    except Exception as e:
        return send_error(e, "Error fetching employee", 500)

def create_new_employee():
    image_url = None

    if 'file' in request.files and request.files['file'].filename != '':
        file = request.files['file']
        if allowed_file(file.filename):
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            
            original_filename = secure_filename(file.filename)
            filename, extension = os.path.splitext(original_filename)
            new_filename = f"{filename}_{timestamp}{extension}"
            
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
            file.save(file_path)
            image_url = f"/assets/images/{new_filename}"

    employee_name = request.form.get('employee_name')
    employee_id = request.form.get('employee_id')
    gender = request.form.get('gender')
    email = request.form.get('email')
    phone = request.form.get('phone')
    address = request.form.get('address')
    department = request.form.get('department')
    skill = request.form.getlist('skill[]')
    date_of_birth = request.form.get('date_of_birth')
    date = None if date_of_birth in ["null", "", None] else date_of_birth
    
    print(request.form)
    
    try:
        validate_unique_employee(employee_id, email)

        cleaned_education = parse_education_array(request.form)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        insert_query = """
            INSERT INTO employees (
                employee_name, employee_id, image, date_of_birth, gender, email, phone, address, skill, department
            ) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
            RETURNING id, employee_name, employee_id, email, phone, address, department;
        """
        values = [
            employee_name,
            employee_id,
            image_url,
            date,
            gender,
            email,
            phone,
            address,
            ','.join(skill) if skill else "",
            department
        ]
        cursor.execute(insert_query, values)
        new_employee = cursor.fetchone()

        education_record = insert_education(cleaned_education, new_employee[0], cursor)

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"employee": new_employee, "education": education_record}), 201

    except Exception as e:
        error_message = str(e)
        
        if "already exists" in error_message:
            return send_error(e, error_message, 409)
        else:
            return send_error(e, "Error creating employee", 500)
    
    
def send_error(error, message="Some error occurred!", status=500):
    print(f"Error: {str(error)}")
    return jsonify({"message": message}), status

def update_employee(employee_id):
    image_url = request.form.get('image')

    if 'file' in request.files and request.files['file'].filename != '':
        delete_image(image_url)
        file = request.files['file']
        if allowed_file(file.filename):
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            original_filename = secure_filename(file.filename)
            filename, extension = os.path.splitext(original_filename)
            new_filename = f"{filename}_{timestamp}{extension}"

            file_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
            file.save(file_path)
            image_url = f"/assets/images/{new_filename}"

    employee_name = request.form.get('employee_name')
    employee_id_form = request.form.get('employee_id')
    gender = request.form.get('gender')
    email = request.form.get('email')
    phone = request.form.get('phone')
    address = request.form.get('address')
    department = request.form.get('department')
    skill = request.form.getlist('skill[]')
    date_of_birth = request.form.get('date_of_birth')
    date = None if date_of_birth in ["null", None] else date_of_birth

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        update_query = """
            UPDATE employees 
            SET employee_name = %s, employee_id = %s, image = %s, date_of_birth = %s, gender = %s, 
                email = %s, phone = %s, address = %s, skill = %s, department = %s
            WHERE id = %s RETURNING *;
        """
        values = [
            employee_name,
            employee_id_form,
            image_url,
            date,
            gender,
            email,
            phone,
            address,
            ','.join(skill) if skill else "",
            department,
            employee_id
        ]

        cursor.execute(update_query, values)
        updated_employee = cursor.fetchone()

        if not updated_employee:
            return jsonify({"message": "Employee not found"}), 404

        delete_education(employee_id, cursor)
        cleaned_education = parse_education_array(request.form)
        insert_education(cleaned_education, employee_id, cursor)

        conn.commit()
        cursor.close()
        conn.close()

        final_employee = fetch_updated_employee(employee_id)
        return jsonify(final_employee), 200

    except Exception as e:
        error_message = str(e)
        if "already exists" in error_message:
            return send_error(e, error_message, 409)
        else:
            return send_error(e, "Error updating employee", 500)

def delete_employee(employee_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("BEGIN")
        
        delete_education(employee_id, cursor)
        
        image_query = "SELECT image FROM employees WHERE id = %s"
        cursor.execute(image_query, (employee_id,))
        employee = cursor.fetchone()
        
        if not employee:
            cursor.execute("ROLLBACK")
            return jsonify({"message": "Employee not found"}), 404
        
        if employee[0]:
            delete_image(os.path.join(app.config['UPLOAD_FOLDER'], employee[0]))
        
        delete_query = "DELETE FROM employees WHERE id = %s RETURNING id"
        cursor.execute(delete_query, (employee_id,))
        
        if cursor.rowcount == 0:
            cursor.execute("ROLLBACK")
            return jsonify({"message": "Employee not found"}), 404
        
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return '', 204

    except Exception as error:
        conn.rollback()
        cursor.close()
        conn.close()
        
        return send_error(error, "Error deleting employee")