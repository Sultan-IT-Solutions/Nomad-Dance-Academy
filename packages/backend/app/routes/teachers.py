from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional, Union
from datetime import datetime
from ..database import get_connection
from ..auth import require_auth, require_teacher

router = APIRouter(prefix="/teachers", tags=["Teachers"])

class CreateGroupRequest(BaseModel):
    name: str
    hall_id: int
    start_time: Union[datetime, str]
    capacity: int = 12

    @field_validator('start_time')
    @classmethod
    def parse_start_time(cls, v):
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            formats = [
                "%Y-%m-%d %H:%M:%S",    # "2025-01-15 18:00:00"
                "%Y-%m-%d %H:%M",       # "2025-01-15 18:00"
                "%m/%d/%Y %H:%M",       # "01/15/2025 18:00"
                "%d.%m.%Y %H:%M",       # "15.01.2025 18:00"
                "%Y-%m-%dT%H:%M:%S",    # ISO format
                "%Y-%m-%dT%H:%M",       # ISO without seconds
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            
            raise ValueError(f"Invalid datetime format. Supported formats: YYYY-MM-DD HH:MM, MM/DD/YYYY HH:MM, DD.MM.YYYY HH:MM")
        
        return v

class AdditionalLessonRequest(BaseModel):
    start_time: Union[datetime, str]
    hall_id: Optional[int] = None
    reason: Optional[str] = None

    @field_validator('start_time')
    @classmethod
    def parse_start_time(cls, v):
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            formats = [
                "%Y-%m-%d %H:%M:%S",    # "2025-01-15 18:00:00"
                "%Y-%m-%d %H:%M",       # "2025-01-15 18:00"
                "%m/%d/%Y %H:%M",       # "01/15/2025 18:00"
                "%d.%m.%Y %H:%M",       # "15.01.2025 18:00"
                "%Y-%m-%dT%H:%M:%S",    # ISO format
                "%Y-%m-%dT%H:%M",       # ISO without seconds
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            
            raise ValueError(f"Invalid datetime format. Supported formats: YYYY-MM-DD HH:MM, MM/DD/YYYY HH:MM, DD.MM.YYYY HH:MM")
        
        return v

class AttendanceRequest(BaseModel):
    attended: bool

class GroupNotesRequest(BaseModel):
    notes: str

class RescheduleRequest(BaseModel):
    lesson_id: int
    new_start_time: Union[datetime, str]
    new_hall_id: Optional[int] = None
    reason: Optional[str] = None

    @field_validator('new_start_time')
    @classmethod
    def parse_new_start_time(cls, v):
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            formats = [
                "%Y-%m-%d %H:%M:%S",    # "2025-01-15 18:00:00"
                "%Y-%m-%d %H:%M",       # "2025-01-15 18:00"
                "%m/%d/%Y %H:%M",       # "01/15/2025 18:00"
                "%d.%m.%Y %H:%M",       # "15.01.2025 18:00"
                "%Y-%m-%dT%H:%M:%S",    # ISO format
                "%Y-%m-%dT%H:%M",       # ISO without seconds
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            
            raise ValueError(f"Invalid datetime format. Supported formats: YYYY-MM-DD HH:MM, MM/DD/YYYY HH:MM, DD.MM.YYYY HH:MM")
        
        return v

async def resolve_teacher_id(pool, user_id: int) -> Optional[int]:
    row = await pool.fetchrow(
        "SELECT id FROM teachers WHERE user_id = $1",
        user_id
    )
    return row["id"] if row else None

async def teacher_assigned_to_group(pool, teacher_id: int, group_id: int) -> bool:
    row = await pool.fetchrow(
        """
        SELECT 1 FROM groups WHERE id = $1 AND main_teacher_id = $2
        UNION
        SELECT 1 FROM group_teachers WHERE group_id = $1 AND teacher_id = $2
        """,
        group_id, teacher_id
    )
    return row is not None

@router.get("/groups")
async def get_teacher_groups(user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    rows = await pool.fetch(
        """
        SELECT
            g.id,
            g.name,
            g.start_time,
            g.duration_minutes,
            g.capacity,
            h.id AS hall_id,
            h.name AS hall_name,
            (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) AS enrolled,
            g.recurring_days,
            g.notes
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        WHERE g.main_teacher_id = $1 OR EXISTS (
            SELECT 1 FROM group_teachers gt WHERE gt.group_id = g.id AND gt.teacher_id = $1
        )
        ORDER BY g.start_time NULLS LAST
        """,
        teacher_id
    )
    
    groups = []
    for r in rows:
        enrolled = int(r["enrolled"]) if r["enrolled"] else 0
        groups.append({
            "id": r["id"],
            "name": r["name"],
            "start_time": str(r["start_time"]) if r["start_time"] else None,
            "duration_minutes": r["duration_minutes"],
            "capacity": r["capacity"],
            "hall": {"id": r["hall_id"], "name": r["hall_name"]} if r["hall_id"] else None,
            "enrolled": enrolled,
            "free_slots": r["capacity"] - enrolled if r["capacity"] else None,
            "recurring_days": r["recurring_days"],
            "notes": r["notes"]
        })
    
    return {"groups": groups}

@router.post("/groups")
async def create_group(data: CreateGroupRequest, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    duration = 90
    end_time = data.start_time + datetime.timedelta(minutes=duration) if hasattr(datetime, 'timedelta') else data.start_time
    
    hall_conflicts = await pool.fetch(
        """
        SELECT g.id FROM groups g
        WHERE g.hall_id = $1
          AND NOT (
            (g.start_time + (g.duration_minutes * INTERVAL '1 minute')) <= $2
            OR g.start_time >= $3
          )
        LIMIT 1
        """,
        data.hall_id, data.start_time, end_time
    )
    
    if hall_conflicts:
        raise HTTPException(status_code=409, detail="Hall not available at requested time")
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await conn.fetchrow(
                """
                INSERT INTO groups (name, hall_id, main_teacher_id, start_time, duration_minutes, capacity)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
                """,
                data.name, data.hall_id, teacher_id, data.start_time, duration, data.capacity
            )
            
            group_id = result["id"]
            
            await conn.execute(
                """
                INSERT INTO group_teachers (group_id, teacher_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                """,
                group_id, teacher_id
            )
    
    print(f"👨‍🏫 Teacher {teacher_id} created group {group_id}")
    return {"group_id": group_id}

@router.get("/groups/{group_id}")
async def get_group_details(group_id: int, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    if not await teacher_assigned_to_group(pool, teacher_id, group_id):
        raise HTTPException(status_code=403, detail="Not assigned to this group")
    
    row = await pool.fetchrow(
        """
        SELECT
            g.id, g.name, g.start_time, g.duration_minutes, g.capacity,
            g.recurring_days, g.notes, h.id AS hall_id, h.name AS hall_name
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        WHERE g.id = $1
        """,
        group_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {
        "id": row["id"],
        "name": row["name"],
        "start_time": str(row["start_time"]) if row["start_time"] else None,
        "duration_minutes": row["duration_minutes"],
        "capacity": row["capacity"],
        "recurring_days": row["recurring_days"],
        "notes": row["notes"],
        "hall": {"id": row["hall_id"], "name": row["hall_name"]} if row["hall_id"] else None
    }

@router.get("/groups/{group_id}/students")
async def get_group_students(group_id: int, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    if not await teacher_assigned_to_group(pool, teacher_id, group_id):
        raise HTTPException(status_code=403, detail="Not assigned to this group")
    
    rows = await pool.fetch(
        """
        SELECT
            s.id, u.name, u.email, s.phone_number, gs.is_trial, gs.joined_at
        FROM group_students gs
        JOIN students s ON s.id = gs.student_id
        JOIN users u ON u.id = s.user_id
        WHERE gs.group_id = $1
        ORDER BY u.name
        """,
        group_id
    )
    
    students = [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "phone_number": r["phone_number"],
            "is_trial": r["is_trial"],
            "joined_at": str(r["joined_at"]) if r["joined_at"] else None
        }
        for r in rows
    ]
    
    return {"students": students}

@router.post("/groups/{group_id}/extra-lessons")
async def create_additional_lesson(group_id: int, data: AdditionalLessonRequest, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    if not await teacher_assigned_to_group(pool, teacher_id, group_id):
        raise HTTPException(status_code=403, detail="Not assigned to this group")
    
    group_info = await pool.fetchrow(
        "SELECT hall_id, duration_minutes FROM groups WHERE id = $1",
        group_id
    )
    
    if not group_info:
        raise HTTPException(status_code=404, detail="Group not found")
    
    hall_id = data.hall_id or group_info["hall_id"]
    duration = 90
    
    result = await pool.fetchrow(
        """
        INSERT INTO schedule_exceptions (
            group_id, teacher_id, hall_id, start_time, duration_minutes,
            reason, additional, approved, requested_by_student
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, FALSE)
        RETURNING id
        """,
        group_id, teacher_id, hall_id, data.start_time, duration, data.reason
    )
    
    print(f"📅 Teacher {teacher_id} created additional lesson {result['id']} for group {group_id}")
    return {"additional_lesson_id": result["id"]}

@router.post("/groups/{group_id}/students/{student_id}/attendance")
async def mark_attendance(group_id: int, student_id: int, data: AttendanceRequest, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    if not await teacher_assigned_to_group(pool, teacher_id, group_id):
        raise HTTPException(status_code=403, detail="Not assigned to this group")
    
    await pool.execute(
        """
        INSERT INTO attendance_records (group_id, student_id, teacher_id, attended)
        VALUES ($1, $2, $3, $4)
        """,
        group_id, student_id, teacher_id, data.attended
    )
    
    return {"message": "Attendance recorded"}

@router.post("/groups/{group_id}/notes")
async def save_group_notes(group_id: int, data: GroupNotesRequest, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    if not await teacher_assigned_to_group(pool, teacher_id, group_id):
        raise HTTPException(status_code=403, detail="Not assigned to this group")
    
    await pool.execute(
        "UPDATE groups SET notes = $1 WHERE id = $2",
        data.notes, group_id
    )
    
    return {"message": "Notes saved"}

@router.get("/attendance/average")
async def get_attendance_summary(user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    rows = await pool.fetch(
        """
        SELECT
            g.id,
            g.name,
            COUNT(ar.id) AS total_records,
            SUM(CASE WHEN ar.attended THEN 1 ELSE 0 END) AS attended_count
        FROM groups g
        LEFT JOIN attendance_records ar ON ar.group_id = g.id
        WHERE g.main_teacher_id = $1 OR EXISTS (
            SELECT 1 FROM group_teachers gt WHERE gt.group_id = g.id AND gt.teacher_id = $1
        )
        GROUP BY g.id, g.name
        """,
        teacher_id
    )
    
    summary = []
    for r in rows:
        total = int(r["total_records"]) if r["total_records"] else 0
        attended = int(r["attended_count"]) if r["attended_count"] else 0
        avg = (attended / total * 100) if total > 0 else None
        
        summary.append({
            "group_id": r["id"],
            "group_name": r["name"],
            "total_lessons": total,
            "average_attendance": round(avg, 1) if avg else None
        })
    
    return {"summary": summary}

@router.post("/reschedule-request")
async def submit_reschedule_request(data: RescheduleRequest, user: dict = Depends(require_teacher)):
    pool = await get_connection()
    teacher_id = await resolve_teacher_id(pool, user["id"])
    
    if not teacher_id:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    result = await pool.fetchrow(
        """
        INSERT INTO reschedule_requests (
            lesson_id, teacher_id, new_start_time, new_hall_id, reason, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id
        """,
        data.lesson_id, teacher_id, data.new_start_time, data.new_hall_id, data.reason
    )
    
    return {"request_id": result["id"], "message": "Reschedule request submitted"}
