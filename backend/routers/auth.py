from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.schemas import RegisterModel, LoginModel
from database import supabase

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/register")
def register(data: RegisterModel):
    try:
        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {"data": {"role": data.role}}
        })
        if response.user is None:
            raise HTTPException(status_code=400, detail="Registration failed")
        return {
            "message": "Registration successful",
            "user_id": str(response.user.id),
            "email": response.user.email
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(data: LoginModel):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "access_token": response.session.access_token,
            "user_id": str(response.user.id),
            "email": response.user.email,
            "role": response.user.user_metadata.get("role", "candidate")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.user_metadata.get("role", "candidate")
    }