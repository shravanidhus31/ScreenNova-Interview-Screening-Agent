from fastapi import APIRouter, HTTPException, Depends
from database import supabase
from groq_client import groq_client
from routers.auth import get_current_user
from sentence_transformers import SentenceTransformer, util
import json
import re

router = APIRouter(prefix="/sessions", tags=["Evaluation"])

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

@router.post("/{session_id}/evaluate")
def evaluate_session(session_id: str, current_user=Depends(get_current_user)):
    try:
        session = supabase.table("sessions").select("*").eq(
            "id", session_id
        ).single().execute().data
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session["status"] != "completed":
            raise HTTPException(status_code=400, detail="Session not completed yet")

        job = supabase.table("job_postings").select("*").eq(
            "id", session["job_id"]
        ).single().execute().data

        w1, w2, w3 = job["w1"], job["w2"], job["w3"]
        threshold = job["threshold"]

        responses = supabase.table("responses").select("*").eq(
            "session_id", session_id
        ).execute().data
        if not responses:
            raise HTTPException(status_code=400, detail="No responses found")

        total_tech = total_comm = total_conf = 0
        count = len(responses)

        for r in responses:
            question = supabase.table("questions").select("*").eq(
                "id", r["question_id"]
            ).single().execute().data

            prompt = f"""
You are an expert interview evaluator. Evaluate the candidate's answer.

Question: {question['text']}
Candidate Answer: {r['text']}

Score from 0 to 100 on:
1. Technical Accuracy - correctness and completeness
2. Communication Clarity - clarity and coherence
3. Confidence - assertiveness and structure

Return ONLY valid JSON, no extra text:
{{
  "tech_score": 75,
  "comm_score": 80,
  "conf_score": 70,
  "reasoning": "brief explanation",
  "reference_answer": "ideal answer to this question"
}}
"""
            try:
                raw = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0
                ).choices[0].message.content.strip()
                raw = re.sub(r"```json|```", "", raw).strip()
                scores = json.loads(raw)
            except Exception:
                scores = {
                    "tech_score": 50, "comm_score": 50,
                    "conf_score": 50, "reasoning": "Could not evaluate",
                    "reference_answer": question["text"]
                }

            sim = float(util.cos_sim(
                embedding_model.encode(r["text"], convert_to_tensor=True),
                embedding_model.encode(scores["reference_answer"], convert_to_tensor=True)
            ))
            final_tech = round((scores["tech_score"] * 0.6) + (sim * 100 * 0.4), 2)

            supabase.table("evaluations").insert({
                "response_id": r["id"],
                "tech_score": final_tech,
                "comm_score": scores["comm_score"],
                "conf_score": scores["conf_score"],
                "reasoning": scores["reasoning"]
            }).execute()

            total_tech += final_tech
            total_comm += scores["comm_score"]
            total_conf += scores["conf_score"]

        avg_tech = round(total_tech / count, 2)
        avg_comm = round(total_comm / count, 2)
        avg_conf = round(total_conf / count, 2)
        final_score = round((w1 * avg_tech) + (w2 * avg_comm) + (w3 * avg_conf), 2)
        decision = "shortlisted" if final_score >= threshold else "rejected"

        try:
            explanation = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": f"""
Write a professional 3-4 sentence screening decision explanation.

Job: {job['title']}
Technical: {avg_tech}/100
Communication: {avg_comm}/100
Confidence: {avg_conf}/100
Final Score: {final_score}/100
Threshold: {threshold}/100
Decision: {decision.upper()}

Mention what went well, what needs improvement, and why the decision was made.
No bullet points.
"""}],
                temperature=0.3
            ).choices[0].message.content.strip()
        except Exception:
            explanation = f"Final score {final_score}/100. Decision: {decision}."

        existing = supabase.table("results").select("*").eq(
            "session_id", session_id
        ).execute().data

        if existing:
            supabase.table("results").update({
                "final_score": final_score,
                "decision": decision,
                "explanation": explanation
            }).eq("session_id", session_id).execute()
        else:
            supabase.table("results").insert({
                "session_id": session_id,
                "final_score": final_score,
                "decision": decision,
                "explanation": explanation
            }).execute()

        return {
            "session_id": session_id,
            "scores": {
                "technical": avg_tech,
                "communication": avg_comm,
                "confidence": avg_conf,
                "final": final_score
            },
            "threshold": threshold,
            "decision": decision,
            "explanation": explanation
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{session_id}/result")
def get_result(session_id: str, current_user=Depends(get_current_user)):
    try:
        result = supabase.table("results").select("*").eq(
            "session_id", session_id
        ).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="No result found - run evaluation first")
        return {"result": result.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    