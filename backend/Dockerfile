FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY patch_pdf_report.py ./patch_pdf_report.py
COPY patch_daily_report_image.py ./patch_daily_report_image.py
RUN python patch_pdf_report.py
RUN python patch_daily_report_image.py
RUN sed -i 's/def passkey_register_options(body: dict, db=next):/def passkey_register_options(body: dict):/' /app/app/passkey_routes.py
RUN printf '\nfrom app.branch_routes import install_branch_routes\ninstall_branch_routes(app, Branch, BranchInput, get_db, create_audit)\nfrom app.passkey_routes import install_passkey_routes\ninstall_passkey_routes(app, Base, engine, AppUser, get_db)\n' >> /app/app/main.py

CMD ["uvicorn", "app.bootstrap:app", "--host", "0.0.0.0", "--port", "8000"]
