from fastapi import APIRouter, HTTPException, Depends
from database import supabase
from routers.auth import get_current_user
from models.schemas import StartSessionModel
import json                                     # <-- ADD THIS
from groq_client import groq_client

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("/start")
def start_session(data: StartSessionModel, current_user=Depends(get_current_user)):
    try:
        # 1. Verify Resume/Profile exists 
        profile_res = supabase.table("users").select("skill_profile").eq(
            "id", str(current_user.id)
        ).single().execute()
        
        if not profile_res.data or not profile_res.data.get("skill_profile"):
            raise HTTPException(status_code=400, detail="Please upload your resume first")
        
        skill_profile = json.loads(profile_res.data["skill_profile"])

        # 2. Verify Job and Approved Question Bank 
        job = supabase.table("job_postings").select("*").eq(
            "id", data.job_id
        ).single().execute().data
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if not job.get("questions_approved"):
            raise HTTPException(status_code=400, detail="Questions not approved yet by HR")

        # 3. Fetch the HR-approved baseline questions 
        approved_qs = supabase.table("question_bank").select("*").eq(
            "job_id", data.job_id
        ).eq("approved", True).order("order_num").execute()

        # 4. Adaptive Logic: Tailor questions to the candidate 
        adaptive_prompt = f"""
        You are an expert technical interviewer. Tailor the following approved questions for a specific candidate.

        Job Description: {job['description']}
        Candidate Skills: {skill_profile.get('skills', [])}
        Candidate Projects: {skill_profile.get('projects', [])}

        Baseline Questions: {json.dumps([q['text'] for q in approved_qs.data])}

        Instructions:
        - Maintain the original question types (technical, behavioral, etc.).
        - Rewrite the questions to reference the candidate's specific skills or projects where relevant.
        - Ensure exactly 10 questions are returned.

        Return ONLY a valid JSON array:
        [
          {{"text": "personalized question", "type": "technical", "difficulty": "medium"}}
        ]
        """

        try:
            llm_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": adaptive_prompt}],
                temperature=0
            )
            personalized_qs = json.loads(llm_response.choices[0].message.content.strip())
        except Exception as e:
            # Fallback to standard questions if LLM fails 
            personalized_qs = approved_qs.data

        # 5. Create the Session 
        session = supabase.table("sessions").insert({
            "user_id": str(current_user.id),
            "job_id": data.job_id,
            "status": "in_progress"
        }).execute().data[0]

        # 6. Insert Personalized Questions into the session 
        rows = [
            {
                "session_id": session["id"],
                "text": q["text"],
                "type": q.get("type", "technical"),
                "difficulty": q.get("difficulty", "medium"),
                "order_num": i + 1
            }
            for i, q in enumerate(personalized_qs)
        ]
        supabase.table("questions").insert(rows).execute()

        # 7. Return session details for the Frontend 
        final_questions = supabase.table("questions").select("*").eq(
            "session_id", session["id"]
        ).order("order_num").execute()

        return {
            "message": "Adaptive session started",
            "session_id": session["id"],
            "job": job,
            "questions": final_questions.data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.get("/{session_id}")
def get_session(session_id: str, current_user=Depends(get_current_user)):
    try:
        session = supabase.table("sessions").select("*").eq(
            "id", session_id
        ).eq("user_id", str(current_user.id)).single().execute()
        if not session.data:
            raise HTTPException(status_code=404, detail="Session not found")
        questions = supabase.table("questions").select("*").eq(
            "session_id", session_id
        ).order("order_num").execute()
        return {"session": session.data, "questions": questions.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{session_id}/responses")
def get_responses(session_id: str, current_user=Depends(get_current_user)):
    try:
        session = supabase.table("sessions").select("*").eq(
            "id", session_id
        ).eq("user_id", str(current_user.id)).single().execute()
        if not session.data:
            raise HTTPException(status_code=403, detail="Unauthorized")
        responses = supabase.table("responses").select("*").eq(
            "session_id", session_id
        ).execute()
        return {"responses": responses.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))