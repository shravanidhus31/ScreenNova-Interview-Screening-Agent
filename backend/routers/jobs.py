from fastapi import APIRouter, HTTPException, Depends
from models.schemas import JobPostingModel, QuestionEditModel, QuestionAddModel
from database import supabase
from groq_client import groq_client
from routers.auth import get_current_user
import json

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("")
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

@router.get("")
def get_jobs():
    try:
        result = supabase.table("job_postings").select("*").eq("active", True).execute()
        return {"jobs": result.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}")
def get_job(job_id: str):
    try:
        result = supabase.table("job_postings").select("*").eq(
            "id", job_id
        ).single().execute()
        return {"job": result.data}
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

@router.delete("/{job_id}")
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

@router.post("/{job_id}/generate-questions")
def generate_questions(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can generate questions")
    try:
        job = supabase.table("job_postings").select("*").eq(
            "id", job_id
        ).single().execute().data
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    prompt = f"""
You are an expert technical interviewer. Based on the job posting below, generate exactly 10 interview questions.

Job Title: {job['title']}
Job Description: {job['description']}
Required Skills: {job['required_skills']}
Hiring Criteria: {job['criteria']}

Generate:
- 4 technical questions testing the required skills (type: "technical")
- 3 behavioral questions about past experience (type: "behavioral")
- 2 scenario-based situational questions (type: "scenario")
- 1 motivation question (type: "motivation")

Assign difficulty as "easy", "medium", or "hard".

Return ONLY a valid JSON array, no extra text:
[
  {{"text": "question here", "type": "technical", "difficulty": "medium"}}
]
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        questions = json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")

    try:
        supabase.table("question_bank").delete().eq("job_id", job_id).execute()
        rows = [
            {
                "job_id": job_id,
                "text": q["text"],
                "type": q["type"],
                "difficulty": q["difficulty"],
                "approved": False,
                "order_num": i + 1
            }
            for i, q in enumerate(questions)
        ]
        supabase.table("question_bank").insert(rows).execute()
        return {"message": "Questions generated", "questions": rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}/questions")
def get_questions(job_id: str, current_user=Depends(get_current_user)):
    try:
        result = supabase.table("question_bank").select("*").eq(
            "job_id", job_id
        ).order("order_num").execute()
        return {"questions": result.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{job_id}/questions")
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

@router.put("/{job_id}/approve-questions")
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