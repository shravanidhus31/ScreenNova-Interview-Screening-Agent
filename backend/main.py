import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from groq import Groq
from supabase import create_client
from pydantic import BaseModel
from typing import Optional
import os
import fitz
import json

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

security = HTTPBearer()

# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────

class RegisterModel(BaseModel):
    email: str
    password: str
    role: str = "candidate"

class LoginModel(BaseModel):
    email: str
    password: str

class JobPostingModel(BaseModel):
    title: str
    description: str
    required_skills: str
    criteria: str
    w1: float = 0.5
    w2: float = 0.3
    w3: float = 0.2
    threshold: float = 60.0

class QuestionEditModel(BaseModel):
    text: Optional[str] = None
    type: Optional[str] = None
    difficulty: Optional[str] = None
    order_num: Optional[int] = None

class QuestionAddModel(BaseModel):
    text: str
    type: str
    difficulty: str
    order_num: int = 0

# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ─────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "message": "backend is running"}

# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

@app.post("/auth/register")
def register(data: RegisterModel):
    try:
        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {"role": data.role}
            }
        })
        if response.user is None:
            raise HTTPException(status_code=400, detail="Registration failed")
        return {
            "message": "Registration successful",
            "user_id": str(response.user.id),
            "email": response.user.email
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
def login(data: LoginModel):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "access_token": response.session.access_token,
            "user_id": str(response.user.id),
            "email": response.user.email,
            "role": response.user.user_metadata.get("role", "candidate")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/auth/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.user_metadata.get("role", "candidate")
    }

# ─────────────────────────────────────────
# JOB POSTINGS
# ─────────────────────────────────────────

@app.post("/jobs")
def create_job(data: JobPostingModel, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can create job postings")
    try:
        result = supabase.table("job_postings").insert({
            "hr_id": str(current_user.id),
            "title": data.title,
            "description": data.description,
            "required_skills": data.required_skills,
            "criteria": data.criteria,
            "w1": data.w1,
            "w2": data.w2,
            "w3": data.w3,
            "threshold": data.threshold,
            "active": True,
            "questions_approved": False
        }).execute()
        return {"message": "Job posting created", "job": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/jobs")
def get_jobs():
    try:
        result = supabase.table("job_postings").select("*").eq("active", True).execute()
        return {"jobs": result.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    try:
        result = supabase.table("job_postings").select("*").eq("id", job_id).single().execute()
        return {"job": result.data}
    except Exception as e:
        raise HTTPException(status_code=404, detail="Job not found")

@app.delete("/jobs/{job_id}")
def deactivate_job(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can deactivate job postings")
    try:
        supabase.table("job_postings").update(
            {"active": False}
        ).eq("id", job_id).eq("hr_id", str(current_user.id)).execute()
        return {"message": "Job posting deactivated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─────────────────────────────────────────
# QUESTION GENERATION
# ─────────────────────────────────────────

@app.post("/jobs/{job_id}/generate-questions")
def generate_questions(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can generate questions")
    try:
        job_result = supabase.table("job_postings").select("*").eq("id", job_id).single().execute()
        job = job_result.data
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    prompt = f"""
You are an expert technical interviewer. Based on the job posting below, generate exactly 10 interview questions.

Job Title: {job['title']}
Job Description: {job['description']}
Required Skills: {job['required_skills']}
Hiring Criteria: {job['criteria']}

Generate:
- 4 technical questions testing the required skills (label type as "technical")
- 3 behavioral questions about past experience (label type as "behavioral")  
- 2 scenario-based situational questions (label type as "scenario")
- 1 motivation question about why they want this role (label type as "motivation")

Assign difficulty as "easy", "medium", or "hard" based on complexity.

Return ONLY a valid JSON array, no extra text, no markdown, no explanation:
[
  {{"text": "question here", "type": "technical", "difficulty": "medium"}},
  {{"text": "question here", "type": "behavioral", "difficulty": "easy"}}
]
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        raw = response.choices[0].message.content.strip()
        questions = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")

    try:
        supabase.table("question_bank").delete().eq("job_id", job_id).execute()
        rows = []
        for i, q in enumerate(questions):
            rows.append({
                "job_id": job_id,
                "text": q["text"],
                "type": q["type"],
                "difficulty": q["difficulty"],
                "approved": False,
                "order_num": i + 1
            })
        supabase.table("question_bank").insert(rows).execute()
        return {"message": "Questions generated successfully", "questions": rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/jobs/{job_id}/questions")
def get_questions(job_id: str, current_user=Depends(get_current_user)):
    try:
        result = supabase.table("question_bank").select("*").eq(
            "job_id", job_id
        ).order("order_num").execute()
        return {"questions": result.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/questions/{question_id}")
def edit_question(question_id: str, data: QuestionEditModel, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can edit questions")
    try:
        updates = {k: v for k, v in data.dict().items() if v is not None}
        result = supabase.table("question_bank").update(updates).eq("id", question_id).execute()
        return {"message": "Question updated", "question": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/questions/{question_id}")
def delete_question(question_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can delete questions")
    try:
        supabase.table("question_bank").delete().eq("id", question_id).execute()
        return {"message": "Question deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/jobs/{job_id}/questions")
def add_question(job_id: str, data: QuestionAddModel, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can add questions")
    try:
        result = supabase.table("question_bank").insert({
            "job_id": job_id,
            "text": data.text,
            "type": data.type,
            "difficulty": data.difficulty,
            "approved": False,
            "order_num": data.order_num
        }).execute()
        return {"message": "Question added", "question": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/jobs/{job_id}/approve-questions")
def approve_questions(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can approve questions")
    try:
        supabase.table("question_bank").update(
            {"approved": True}
        ).eq("job_id", job_id).execute()
        supabase.table("job_postings").update(
            {"questions_approved": True}
        ).eq("id", job_id).execute()
        return {"message": "All questions approved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
# ─────────────────────────────────────────
# RESUME UPLOAD AND SKILL EXTRACTION
# ─────────────────────────────────────────

@app.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    try:
        contents = await file.read()
        pdf = fitz.open(stream=contents, filetype="pdf")
        text = ""
        for page in pdf:
            text += page.get_text()
        pdf.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF reading failed: {str(e)}")

    if len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    prompt = f"""
You are an expert resume parser. Extract structured information from the resume below.

Resume Text:
{text[:4000]}

Return ONLY a valid JSON object, no extra text, no markdown:
{{
  "full_name": "candidate full name or empty string",
  "email": "email address or empty string",
  "experience_level": "fresher or junior or mid or senior",
  "years_of_experience": "number as string or 0",
  "skills": ["skill1", "skill2", "skill3"],
  "tools": ["tool1", "tool2"],
  "programming_languages": ["language1", "language2"],
  "education": "highest degree and field or empty string",
  "projects": ["brief project description 1", "brief project description 2"]
}}
"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        profile = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skill extraction failed: {str(e)}")

    try:
        existing = supabase.table("users").select("*").eq(
            "id", str(current_user.id)
        ).execute()

        if existing.data:
            supabase.table("users").update({
                "resume_text": text[:5000],
                "skill_profile": json.dumps(profile)
            }).eq("id", str(current_user.id)).execute()
        
        return {
            "message": "Resume uploaded and parsed successfully",
            "profile": profile
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/resume/profile")
def get_profile(current_user=Depends(get_current_user)):
    try:
        result = supabase.table("users").select(
            "skill_profile"
        ).eq("id", str(current_user.id)).single().execute()

        if not result.data or not result.data.get("skill_profile"):
            raise HTTPException(status_code=404, detail="No resume uploaded yet")

        profile = json.loads(result.data["skill_profile"])
        return {"profile": profile}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))