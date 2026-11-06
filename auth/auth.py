
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from sqlalchemy.orm import Session

from jose import jwt, JWTError

from passlib.context import CryptContext

from .database import get_db
from .models import User
from .schemas import (
    RegisterRequest,
    LoginRequest,
    UserResponse
)


# =========================================================
# JWT CONFIGURATION
# =========================================================

SECRET_KEY = "CHANGE_THIS_SECRET_KEY_LATER"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# =========================================================
# PASSWORD HASHING
# =========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str):

    # bcrypt supports a maximum of 72 bytes.
    # Limit password before hashing to avoid bcrypt error.

    password = password.encode("utf-8")[:72].decode(
        "utf-8",
        errors="ignore"
    )

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):

    plain_password = plain_password.encode(
        "utf-8"
    )[:72].decode(
        "utf-8",
        errors="ignore"
    )

    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# =========================================================
# JWT TOKEN
# =========================================================

def create_access_token(
    data: dict
):

    to_encode = data.copy()

    expire = (
        datetime.utcnow()
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================================
# AUTH ROUTER
# =========================================================

router = APIRouter()


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # CHECK EMAIL
    # -----------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )


    # -----------------------------------------------------
    # HASH PASSWORD
    # -----------------------------------------------------

    hashed_password = hash_password(
        request.password
    )


    # -----------------------------------------------------
    # CREATE USER
    # -----------------------------------------------------

    new_user = User(

        name=request.name,

        email=request.email,

        password=hashed_password

    )


    # -----------------------------------------------------
    # SAVE USER
    # -----------------------------------------------------

    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    return new_user


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login"
)
def login_user(
    request: LoginRequest,
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )


    # -----------------------------------------------------
    # USER NOT FOUND
    # -----------------------------------------------------

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


    # -----------------------------------------------------
    # VERIFY PASSWORD
    # -----------------------------------------------------

    try:

        password_valid = verify_password(
            request.password,
            user.password
        )

    except Exception:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


    if not password_valid:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


    # -----------------------------------------------------
    # CREATE JWT
    # -----------------------------------------------------

    access_token = create_access_token({

        "sub": str(user.id),

        "email": user.email

    })


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "message":
            "Login successful",

        "access_token":
            access_token,

        "token_type":
            "bearer",

        "user": {

            "id":
                user.id,

            "name":
                user.name,

            "email":
                user.email

        }

    }


# =========================================================
# GET CURRENT USER
# =========================================================

def get_current_user(
    token: str,
    db: Session = Depends(get_db)
):

    credentials_exception = HTTPException(

        status_code=status.HTTP_401_UNAUTHORIZED,

        detail="Could not validate credentials",

        headers={
            "WWW-Authenticate": "Bearer"
        }

    )


    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:

            raise credentials_exception

    except JWTError:

        raise credentials_exception


    user = (
        db.query(User)
        .filter(
            User.id == int(user_id)
        )
        .first()
    )


    if user is None:

        raise credentials_exception


    return user

