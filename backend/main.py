"""
Main entry point for the backend API.

Run with: uvicorn backend.main:app --reload
"""

from backend.api import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
