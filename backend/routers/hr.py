import io
import csv
from fastapi import Response
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from fastapi import APIRouter, HTTPException, Depends
from database import supabase
from routers.auth import get_current_user
from models.schemas import OverrideModel

router = APIRouter(prefix="/hr", tags=["HR Dashboard"])

@router.get("/jobs/{job_id}/candidates")
def get_job_candidates(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can access this endpoint")

    try:
        # Fetch all interview sessions for the specific job
        sessions_res = supabase.table("sessions").select("*").eq("job_id", job_id).execute()
        sessions = sessions_res.data

        candidates_data = []
        for session in sessions:
            # Fetch candidate profile details
            user_res = supabase.table("users").select("id, email, skill_profile").eq("id", session["user_id"]).single().execute()
            
            # Fetch AI evaluation results if the session is complete
            result_res = supabase.table("results").select("*").eq("session_id", session["id"]).execute()
            
            candidate_info = {
                "session_id": session["id"],
                "user": user_res.data if user_res.data else None,
                "status": session["status"],
                "result": result_res.data[0] if result_res.data else None
            }
            candidates_data.append(candidate_info)

        return {"job_id": job_id, "candidates": candidates_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/results/{session_id}/override")
def override_decision(session_id: str, data: OverrideModel, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can override decisions")

    try:
        # Retrieve the existing AI evaluation result
        result_res = supabase.table("results").select("*").eq("session_id", session_id).single().execute()
        if not result_res.data:
            raise HTTPException(status_code=404, detail="Result not found for this session")
        
        old_result = result_res.data
        old_decision = old_result["decision"]

        if old_decision == data.new_decision:
            raise HTTPException(status_code=400, detail="New decision must be different from the current decision")

        # 1. Update the result table to reflect the manual override
        supabase.table("results").update({
            "decision": data.new_decision,
            "overridden": True
        }).eq("id", old_result["id"]).execute()

        # 2. Maintain an audit log in the overrides table
        supabase.table("overrides").insert({
            "result_id": old_result["id"],
            "hr_id": str(current_user.id),
            "old_decision": old_decision,
            "new_decision": data.new_decision,
            "reason": data.reason
        }).execute()

        return {
            "message": "Decision overridden successfully",
            "session_id": session_id,
            "old_decision": old_decision,
            "new_decision": data.new_decision
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.get("/jobs/{job_id}/export")
def export_candidates_csv(job_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can export data")
        
    try:
        sessions_res = supabase.table("sessions").select("*").eq("job_id", job_id).execute()
        
        output = io.StringIO()
        writer = csv.writer(output)
        # Write the CSV Header
        writer.writerow(["Session ID", "Candidate Email", "Status", "Final Score", "Decision", "Overridden"])
        
        for session in sessions_res.data:
            # Fetch user email
            user_res = supabase.table("users").select("email").eq("id", session["user_id"]).single().execute()
            email = user_res.data["email"] if user_res.data else "Unknown"
            
            # Fetch AI Result
            result_res = supabase.table("results").select("*").eq("session_id", session["id"]).execute()
            
            if result_res.data:
                score = result_res.data[0].get("final_score", "N/A")
                decision = result_res.data[0].get("decision", "Pending")
                overridden = result_res.data[0].get("overridden", False)
            else:
                score, decision, overridden = "N/A", "Pending", False
                
            writer.writerow([session["id"], email, session["status"], score, decision, overridden])
            
        return Response(
            content=output.getvalue(), 
            media_type="text/csv", 
            headers={"Content-Disposition": f"attachment; filename=job_{job_id}_candidates.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/results/{session_id}/report")
def download_candidate_report(session_id: str, current_user=Depends(get_current_user)):
    role = current_user.user_metadata.get("role", "candidate")
    if role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can download reports")
        
    try:
        # Fetch Result, Session, and User Data
        result_res = supabase.table("results").select("*").eq("session_id", session_id).single().execute()
        if not result_res.data:
            raise HTTPException(status_code=404, detail="Result not found for this session")
            
        session_res = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        user_res = supabase.table("users").select("email").eq("id", session_res.data["user_id"]).single().execute()
        
        # Generate the PDF in memory
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        # Header
        p.setFont("Helvetica-Bold", 16)
        p.drawString(100, 750, "ScreenNova Candidate Evaluation Report")
        
        # Candidate Info
        p.setFont("Helvetica", 12)
        p.drawString(100, 710, f"Candidate Email: {user_res.data['email']}")
        p.drawString(100, 690, f"Session ID: {session_id}")
        p.drawString(100, 670, f"Final Score: {result_res.data['final_score']}")
        p.drawString(100, 650, f"Screening Decision: {result_res.data['decision'].upper()}")
        p.drawString(100, 630, f"Manual HR Override: {'Yes' if result_res.data['overridden'] else 'No'}")
        
        # AI Reasoning Section
        p.setFont("Helvetica-Bold", 12)
        p.drawString(100, 590, "AI Evaluation Reasoning:")
        
        p.setFont("Helvetica", 11)
        textobject = p.beginText(100, 570)
        
        # Simple text wrapping for the LLM paragraph
        words = result_res.data['explanation'].split()
        line = ""
        for word in words:
            if len(line + word) > 80:
                textobject.textLine(line)
                line = word + " "
            else:
                line += word + " "
        textobject.textLine(line)
        
        p.drawText(textobject)
        p.showPage()
        p.save()
        
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(), 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"attachment; filename=candidate_report_{session_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))