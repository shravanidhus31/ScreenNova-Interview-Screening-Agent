from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, jobs, resume, sessions, responses, evaluation

app = FastAPI(title="ScreenNova Interview Screening API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(resume.router)
app.include_router(sessions.router)
app.include_router(responses.router)
app.include_router(evaluation.router)

@app.get("/health")
def health():
    return {"status": "ok", "message": "ScreenNova backend is running"}