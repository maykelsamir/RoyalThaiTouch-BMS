FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN printf '\nfrom app.branch_routes import install_branch_routes\ninstall_branch_routes(app, Branch, BranchInput, get_db, create_audit)\n' >> /app/app/main.py

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
