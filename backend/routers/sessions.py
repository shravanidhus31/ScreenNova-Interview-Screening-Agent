from fastapi import APIRouter, HTTPException, Depends
from database import supabase
from routers.auth import get_current_user
from models.schemas import StartSessionModel

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("/start")
def start_session(data: StartSessionModel, current_user=Depends(get_current_user)):
    try:
        profile = supabase.table("users").select("skill_profile").eq(
            "id", str(current_user.id)
        ).single().execute()
        if not profile.data or not profile.data.get("skill_profile"):
            raise HTTPException(status_code=400, detail="Please upload your resume first")

        job = supabase.table("job_postings").select("*").eq(
            "id", data.job_id
        ).single().execute().data
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if not job.get("questions_approved"):
            raise HTTPException(status_code=400, detail="Questions not approved yet")

        session = supabase.table("sessions").insert({
            "user_id": str(current_user.id),
            "job_id": data.job_id,
            "status": "in_progress"
        }).execute().data[0]

        approved_qs = supabase.table("question_bank").select("*").eq(
            "job_id", data.job_id
        ).eq("approved", True).order("order_num").execute()

        rows = [
            {
                "session_id": session["id"],
                "bank_question_id": q["id"],
                "text": q["text"],
                "type": q["type"],
                "difficulty": q["difficulty"],
                "order_num": q["order_num"]
            }
            for q in approved_qs.data
        ]
        supabase.table("questions").insert(rows).execute()

        questions = supabase.table("questions").select("*").eq(
            "session_id", session["id"]
        ).order("order_num").execute()

        return {
            "message": "Session started",
            "session_id": session["id"],
            "job": job,
            "questions": questions.data
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