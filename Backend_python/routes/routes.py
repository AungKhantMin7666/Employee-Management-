from flask import Blueprint, request
from controllers.employee_controller import (
    get_img,
    create_new_employee,
    find_all_employees,
    update_employee,
    delete_employee,
)
from controllers.import_export_controller import (
    export_file,
    import_file
)

api = Blueprint('api', __name__)

api.add_url_rule("/assets/images/<string:image_name>", "get_img", get_img, methods=["GET"])
api.add_url_rule("/employee", "create_new_employee", create_new_employee, methods=["POST"])
api.add_url_rule("/employee", "find_all_employees", find_all_employees, methods=["GET"])
api.add_url_rule("/employee/<int:employee_id>", "update_employee", update_employee, methods=["PUT"])
api.add_url_rule("/employee/<int:employee_id>", "delete_one_employee", delete_employee, methods=["DELETE"])

api.add_url_rule("/export", "export_file", export_file, methods=["GET"])
api.add_url_rule("/import", "import_file", import_file, methods=["POST"])
