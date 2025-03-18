import os
from functools import wraps

from flask import jsonify, request


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if os.getenv("FLASK_ENV") == "testing":
            return f(*args, **kwargs)

        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return jsonify({"error": "No API key provided"}), 401

        if api_key != os.getenv("API_KEY"):
            return jsonify({"error": "Invalid API key"}), 401

        return f(*args, **kwargs)

    return decorated
