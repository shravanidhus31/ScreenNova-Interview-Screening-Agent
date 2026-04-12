from fastapi import APIRouter, HTTPException, Depends
from database import supabase
from routers.auth import get_current_user
from models.schemas import SubmitResponseModel

router = APIRouter(prefix="/responses", tags=["Responses"])

@router.post("/submit")
def submit_response(data: SubmitResponseModel, current_user=Depends(get_current_user)):
    try:
        session = supabase.table("sessions").select("*").eq(
            "id", data.session_id
        ).eq("user_id", str(current_user.id)).single().execute()
        if not session.data:
            raise HTTPException(status_code=403, detail="Session not found or unauthorized")
        if session.data["status"] == "completed":
            raise HTTPException(status_code=400, detail="Session already completed")

        existing = supabase.table("responses").select("*").eq(
            "question_id", data.question_id
        ).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Question already answered")

        response = supabase.table("responses").insert({
            "question_id": data.question_id,
            "session_id": data.session_id,
            "text": data.text,
            "voice_flag": data.voice_flag
        }).execute().data[0]

        total_q = len(supabase.table("questions").select("id").eq(
            "session_id", data.session_id
        ).execute().data)

        total_r = len(supabase.table("responses").select("id").eq(
            "session_id", data.session_id
        ).execute().data)

        if total_r >= total_q:
            supabase.table("sessions").update(
                {"status": "completed"}
            ).eq("id", data.session_id).execute()
            return {
                "message": "Response submitted",
                "response": response,
                "session_status": "completed",
                "all_answered": True
            }

        return {
            "message": "Response submitted",
            "response": response,
            "session_status": "in_progress",
            "answered": total_r,
            "total": total_q,
            "all_answered": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))