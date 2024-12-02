from flask import Flask
from dotenv import load_dotenv
from routes.routes import api
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Register file upload routes
app.register_blueprint(api, url_prefix="/api")

@app.route("/", methods=["GET"])
def home():
    return {"message": "Welcome to the File Upload API"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
