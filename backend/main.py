from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
from supabase import create_client
import os
import fitz

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

@app.get("/health")
def health():
    return {"status": "ok", "message": "backend is running"}

@app.get("/test-groq")
def test_groq():
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": "Say hello in one sentence."}
        ]
    )
    return {"response": response.choices[0].message.content}

@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    contents = await file.read()
    pdf = fitz.open(stream=contents, filetype="pdf")
    text = ""
    for page in pdf:
        text += page.get_text()
    return {
        "filename": file.filename,
        "pages": len(pdf),
        "preview": text[:500]
    }
    
