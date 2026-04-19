from transformers import pipeline, AutoTokenizer, BertConfig, BertForTokenClassification
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from database import supabase
from routers.auth import get_current_user
import fitz
import json
import re
import os

# Define the path to your new local model
# Define the path to your new local model
# Define your Hugging Face repository ID
HF_MODEL_ID = "shravanidhus/jobbert-ner-model" # <-- CHANGE THIS!

print("Loading JobBERT NER model from Hugging Face...")
try:
    # 1. Grab the official bug-free tokenizer
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
    
    # 2. Build the config in memory (Bypassing the broken config.json file completely!)
    config = BertConfig.from_pretrained(
        "bert-base-uncased",
        num_labels=3,
        id2label={0: "O", 1: "B-ENTITY", 2: "I-ENTITY"}, 
        label2id={"O": 0, "B-ENTITY": 1, "I-ENTITY": 2}
    )
    
    # 3. Load the model directly from Hugging Face
    model = BertForTokenClassification.from_pretrained(
        HF_MODEL_ID, 
        config=config
    )
    
    # 4. Wire up the pipeline
    ner_pipeline = pipeline(
        "ner", 
        model=model, 
        tokenizer=tokenizer, 
        aggregation_strategy="simple"
    )
    print("JobBERT loaded successfully from Hugging Face!")
except Exception as e:
    print(f"Failed to load JobBERT: {e}")
    ner_pipeline = None

# KEEP THIS LINE EXACTLY AS IT IS:
router = APIRouter(prefix="/resume", tags=["Resume"])
router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    # 2. PARSE THE PDF
    try:
        contents = await file.read()
        pdf = fitz.open(stream=contents, filetype="pdf")
        text = "".join(page.get_text() for page in pdf)
        pdf.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF reading failed: {str(e)}")

    if len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    # 3. SETUP DEFAULT PROFILE SCHEMA
    profile = {
        "full_name": "Unknown",
        "email": "Unknown",
        "experience_level": "Unknown",
        "years_of_experience": "0",
        "skills": [],
        "tools": [],
        "programming_languages": [],
        "education": "Unknown",
        "projects": []
    }

    # 4. EXTRACT EMAIL (Simple Regex Fallback)
    email_match = re.search(r'[\w\.-]+@[\w\.-]+', text)
    if email_match:
        profile["email"] = email_match.group(0)

    # 5. EXTRACT SKILLS USING YOUR LOCAL AI MODEL
# 5. EXTRACT SKILLS, TOOLS, AND LANGUAGES
    if ner_pipeline:
        try:
            analyzed_text = text[:5000] 
            results = ner_pipeline(analyzed_text)
            
            # --- THE BUCKETS ---
            # You can add more to these lists over time!
            KNOWN_LANGUAGES = {"python", "java", "c++", "c", "javascript", "typescript", "ruby", "golang", "rust", "php", "sql", "html", "css"}
            KNOWN_TOOLS = {"django", "fastapi", "react", "node", "docker", "kubernetes", "aws", "git", "mysql", "mongodb", "powerbi", "github", "numpy", "opencv"}
            
            IGNORE_WORDS = {"email", "phone", "education", "projects", "tools", "skills", "experience", "internship", "college", "us", "com", "gmail", "linkedin", "support", "ensure", "focus", "safe", "facts", "outputs", "post", "context", "risk"}
            
            extracted_skills = set()
            extracted_tools = set()
            extracted_languages = set()
            
            for entity in results:
                label = entity.get('entity_group', entity.get('entity', ''))
                
                if label in ['ENTITY', 'LABEL_1', 'LABEL_2', 'B-ENTITY', 'I-ENTITY']:
                    clean_word = entity['word'].replace("##", "").strip().lower()
                    
                    if len(clean_word) > 2 and clean_word not in IGNORE_WORDS:
                        # SORT INTO THE CORRECT BUCKET
                        if clean_word in KNOWN_LANGUAGES:
                            extracted_languages.add(clean_word)
                        elif clean_word in KNOWN_TOOLS:
                            extracted_tools.add(clean_word)
                        else:
                            extracted_skills.add(clean_word)
            
            profile["skills"] = list(extracted_skills)
            profile["tools"] = list(extracted_tools)
            profile["programming_languages"] = list(extracted_languages)
            
        except Exception as e:
            print(f"JobBERT Extraction Error: {e}")

    # 6. EXTRACT EDUCATION (Smart Regex Fallback)
    # This looks for common degree and university keywords
    edu_match = re.search(r'(bachelor|b\.?tech|m\.?tech|master|b\.?s\.?|ph\.?d|university|college|institute)[^\n]*', text, re.IGNORECASE)
    if edu_match:
        profile["education"] = edu_match.group(0).strip()
        
    # Note on Projects: Extracting whole project descriptions requires full NLP comprehension. 
    # For a screening agent, extracting the core skills is usually enough to generate interview questions!
    # 7. EXTRACT PROJECTS (Smart Block Parsing)
    try:
        # We uppercase everything to make finding headers easier
        upper_text = text.upper()
        
        # Look for common variations of the Projects header
        project_match = re.search(r'\n(?:PERSONAL |ACADEMIC |SIDE )?PROJECTS\b', upper_text)
        
        if project_match:
            start_idx = project_match.end()
            
            # These are the headers that tell our parser to STOP reading
            stop_headers = ['EXPERIENCE', 'EDUCATION', 'SKILLS', 'TECHNICAL' 'CERTIFICATIONS', 'ACHIEVEMENTS', 'LANGUAGES', 'WORK HISTORY']
            
            end_idx = len(upper_text)
            for header in stop_headers:
                match = re.search(rf'\n{header}\b', upper_text[start_idx:])
                if match:
                    match_pos = start_idx + match.start()
                    # We want the closest stopping header
                    if match_pos < end_idx:
                        end_idx = match_pos
                        
            # We now have the exact block of text that contains their projects!
            raw_project_block = text[start_idx:end_idx].strip()
            
            # Split the block by common bullet points (•, -, *) or double newlines
            project_lines = re.split(r'\n(?=[\u2022\-\*])|\n\n', raw_project_block)
            
            extracted_projects = []
            for line in project_lines:
                # Clean off the bullet point symbols
                clean_line = re.sub(r'^[\u2022\-\*\s]+', '', line).strip()
                # Only keep lines that look like actual descriptions (longer than 30 characters)
                if len(clean_line) > 30:
                    # Truncate to 250 characters so we don't overwhelm the database or Groq later
                    if len(clean_line) > 250:
                        clean_line = clean_line[:247] + "..."
                    extracted_projects.append(clean_line)
            
            profile["projects"] = extracted_projects
    except Exception as e:
        print(f"Project Extraction Error: {e}")
    # 6. SAVE TO DATABASE
    try:
        supabase.table("users").upsert({
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.user_metadata.get("role", "candidate"),
            "resume_text": text[:5000],
            "skill_profile": json.dumps(profile)
        }).execute()
        
        return {
            "message": "Resume uploaded and processed locally by JobBERT", 
            "profile": profile
        }
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