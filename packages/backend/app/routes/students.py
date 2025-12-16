from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from ..database import get_connection
from ..auth import require_auth, require_student

router = APIRouter(prefix="/students", tags=["Students"])

class StudentProfileUpdate(BaseModel):
    phone_number: str
    comment: Optional[str] = None

@router.get("/me")
async def get_me(user: dict = Depends(require_student)):
    user_id = user["id"]
    
    pool = await get_connection()
    
    row = await pool.fetchrow(
        """
        SELECT id, user_id, phone_number, comment, trial_used, subscription_until 
        FROM students WHERE user_id = $1
        """,
        user_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    return {
        "student": {
            "id": row["id"],
            "user_id": row["user_id"],
            "phone_number": row["phone_number"],
            "comment": row["comment"],
            "trial_used": row["trial_used"],
            "subscription_until": str(row["subscription_until"]) if row["subscription_until"] else None
        }
    }

@router.post("/me")
async def update_me(data: StudentProfileUpdate, user: dict = Depends(require_student)):
    user_id = user["id"]
    
    if not data.phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")
    
    pool = await get_connection()
    
    row = await pool.fetchrow(
        """
        INSERT INTO students (user_id, phone_number, comment)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET 
            phone_number = EXCLUDED.phone_number, 
            comment = COALESCE(EXCLUDED.comment, students.comment)
        RETURNING id, user_id, phone_number, comment, trial_used, subscription_until
        """,
        user_id, data.phone_number, data.comment
    )
    
    return {
        "message": "Profile created/updated",
        "student": {
            "id": row["id"],
            "user_id": row["user_id"],
            "phone_number": row["phone_number"],
            "comment": row["comment"],
            "trial_used": row["trial_used"],
            "subscription_until": str(row["subscription_until"]) if row["subscription_until"] else None
        }
    }

async def resolve_student_id(pool, user_id: int) -> Optional[int]:
    row = await pool.fetchrow(
        "SELECT id FROM students WHERE user_id = $1",
        user_id
    )
    return row["id"] if row else None

@router.get("/my-groups")
async def get_my_groups(user: dict = Depends(require_student)):
    user_id = user["id"]
    
    pool = await get_connection()
    student_id = await resolve_student_id(pool, user_id)
    
    if not student_id:
        return {"groups": []}
    
    rows = await pool.fetch(
        """
        SELECT
            g.id,
            g.name,
            g.start_time,
            g.duration_minutes,
            h.name AS hall_name,
            u.name AS teacher_name,
            g.capacity,
            (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) AS enrolled,
            g.recurring_days
        FROM group_students gs
        JOIN groups g ON g.id = gs.group_id
        LEFT JOIN halls h ON h.id = g.hall_id
        LEFT JOIN teachers t ON t.id = g.main_teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        WHERE gs.student_id = $1
        ORDER BY g.start_time
        """,
        student_id
    )
    
    day_map = {
        "monday": "Пн", "tuesday": "Вт", "wednesday": "Ср",
        "thursday": "Чт", "friday": "Пт", "saturday": "Сб", "sunday": "Вс"
    }
    
    groups = []
    for r in rows:
        enrolled = int(r["enrolled"]) if r["enrolled"] else 0
        capacity = r["capacity"]
        
        recurring_days = r["recurring_days"]
        recurring_formatted = None
        if recurring_days:
            days = recurring_days.split(",")
            recurring_formatted = ", ".join(
                day_map.get(d.strip().lower(), d) for d in days
            )
        
        groups.append({
            "id": r["id"],
            "name": r["name"],
            "start_time": str(r["start_time"]) if r["start_time"] else None,
            "duration_minutes": r["duration_minutes"],
            "hall_name": r["hall_name"] or "Не указан",
            "teacher_name": r["teacher_name"] or "Не назначен",
            "capacity": capacity,
            "enrolled": enrolled,
            "free_slots": capacity - enrolled if capacity else None,
            "recurring_days": recurring_formatted
        })
    
    return {"groups": groups}

@router.get("/my-attendance")
async def get_my_attendance(user: dict = Depends(require_student)):
    user_id = user["id"]
    
    pool = await get_connection()
    student_id = await resolve_student_id(pool, user_id)
    
    if not student_id:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    rows = await pool.fetch(
        """
        SELECT
            g.id,
            g.name,
            ar.attended,
            ar.teacher_present,
            ar.recorded_at
        FROM attendance_records ar
        JOIN groups g ON g.id = ar.group_id
        WHERE ar.student_id = $1
        ORDER BY ar.recorded_at DESC
        """,
        student_id
    )
    
    attendance = [
        {
            "group_id": r["id"],
            "group_name": r["name"],
            "attended": r["attended"],
            "teacher_present": r["teacher_present"],
            "recorded_at": str(r["recorded_at"]) if r["recorded_at"] else None
        }
        for r in rows
    ]
    
    return {"attendance": attendance}

@router.get("/notifications")
async def get_notifications(user: dict = Depends(require_student)):
    user_id = user["id"]
    
    pool = await get_connection()
    student_id = await resolve_student_id(pool, user_id)
    
    if not student_id:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    rows = await pool.fetch(
        """
        SELECT id, type, group_id, title, message, is_read, created_at
        FROM notifications
        WHERE student_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        """,
        student_id
    )
    
    notifications = [
        {
            "id": r["id"],
            "type": r["type"],
            "group_id": r["group_id"],
            "title": r["title"],
            "message": r["message"],
            "is_read": r["is_read"],
            "created_at": str(r["created_at"]) if r["created_at"] else None
        }
        for r in rows
    ]
    
    return {"notifications": notifications}

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, user: dict = Depends(require_student)):
    pool = await get_connection()
    
    await pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1",
        notification_id
    )
    
    return {"message": "Notification marked as read"}
