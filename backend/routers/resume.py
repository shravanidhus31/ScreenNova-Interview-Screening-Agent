from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from database import supabase
from groq_client import groq_client
from routers.auth import get_current_user
import fitz
import json
import re

router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    try:
        contents = await file.read()
        pdf = fitz.open(stream=contents, filetype="pdf")
        text = "".join(page.get_text() for page in pdf)
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
  "skills": ["skill1", "skill2"],
  "tools": ["tool1", "tool2"],
  "programming_languages": ["language1"],
  "education": "highest degree and field or empty string",
  "projects": ["brief project description 1"]
}}
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        raw = re.sub(r"```json|```", "", response.choices[0].message.content.strip()).strip()
        profile = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skill extraction failed: {str(e)}")

    try:
        supabase.table("users").upsert({
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.user_metadata.get("role", "candidate"),
            "resume_text": text[:5000],
            "skill_profile": json.dumps(profile)
        }).execute()
        return {"message": "Resume uploaded and parsed successfully", "profile": profile}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/profile")
def get_profile(current_user=Depends(get_current_user)):
    try:
        result = supabase.table("users").select("skill_profile").eq(
            "id", str(current_user.id)
        ).single().execute()
        if not result.data or not result.data.get("skill_profile"):
            raise HTTPException(status_code=404, detail="No resume uploaded yet")
        return {"profile": json.loads(result.data["skill_profile"])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))