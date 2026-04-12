from pydantic import BaseModel
from typing import Optional

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

class StartSessionModel(BaseModel):
    job_id: str

class SubmitResponseModel(BaseModel):
    session_id: str
    question_id: str
    text: str
    voice_flag: bool = False

class OverrideModel(BaseModel):
    new_decision: str
    reason: str