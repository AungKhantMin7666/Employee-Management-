from flask import Flask
from dotenv import load_dotenv
from routes.routes import api
import os
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

app.register_blueprint(api, url_prefix="/api")

CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route("/", methods=["GET"])
def home():
    return {"message": "Welcome to the File Upload API"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
