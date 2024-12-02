from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import psycopg2
from db import get_db_connection
from psycopg2.extras import RealDictCursor

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_img(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404


def find_all_employees():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT * FROM employees;")
            rows = cursor.fetchall()
        return jsonify(rows), 200
    except Exception as e:
        print("Error fetching employees:", e)
        return jsonify({"error": "Error fetching employees"}), 500
    finally:
        conn.close()


def create_new_employee():
    if "image_file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["image_file"]
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
    else:
        return jsonify({"error": "Invalid file format"}), 400

    employee_data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        INSERT INTO employees (employee_name, email, image, gender)
        VALUES (%s, %s, %s, %s) RETURNING id;
    """
    values = (
        employee_data["employee_name"],
        employee_data["email"],
        filename,
        employee_data["gender"],
    )
    cursor.execute(query, values)
    conn.commit()
    employee_id = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    return jsonify({"message": "Employee created", "id": employee_id}), 201
