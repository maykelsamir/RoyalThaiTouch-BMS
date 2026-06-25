from fastapi import FastAPI

app = FastAPI(title='Royal Thai Touch Business Management System', version='1.0.0')

@app.get('/')
def root():
    return {
        'application':'Royal Thai Touch Business Management System',
        'status':'running',
        'version':'1.0.0'
    }
