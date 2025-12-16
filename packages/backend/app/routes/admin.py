from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import datetime
from ..database import get_connection
from ..auth import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

class CreateHallRequest(BaseModel):
    name: str
    capacity: int

class CreateStudentRequest(BaseModel):
    name: str
    email: str
    password: str
    phone_number: str

class CreateTeacherRequest(BaseModel):
    name: str
    email: str
    password: str
    hourly_rate: Optional[float] = None
    bio: Optional[str] = None

class CreateGroupRequest(BaseModel):
    name: str
    hall_id: Optional[int] = None
    main_teacher_id: Optional[int] = None
    start_time: Optional[Union[datetime, str]] = None
    duration_minutes: int = 90
    capacity: int = 12
    recurring_days: Optional[str] = None

    @field_validator('start_time')
    @classmethod
    def parse_start_time(cls, v):
        if v is None:
            return None
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

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    hall_id: Optional[int] = None
    main_teacher_id: Optional[int] = None
    start_time: Optional[Union[datetime, str]] = None
    duration_minutes: Optional[int] = None
    capacity: Optional[int] = None
    recurring_days: Optional[str] = None
    is_closed: Optional[bool] = None

    @field_validator('start_time')
    @classmethod
    def parse_start_time(cls, v):
        if v is None:
            return None
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

class GroupLimitRequest(BaseModel):
    capacity: int

class AddStudentToGroupRequest(BaseModel):
    student_id: int
    is_trial: bool = False

class AttendanceRecord(BaseModel):
    student_id: int
    attended: bool

class SaveAttendanceRequest(BaseModel):
    lesson_date: datetime
    records: List[AttendanceRecord]

class CreateLessonRequest(BaseModel):
    group_id: int
    class_name: str
    teacher_id: Optional[int] = None
    hall_id: Optional[int] = None
    start_time: Union[datetime, str]
    duration_minutes: int = 90

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

class UpdateLessonRequest(BaseModel):
    class_name: Optional[str] = None
    teacher_id: Optional[int] = None
    hall_id: Optional[int] = None
    start_time: Optional[Union[datetime, str]] = None
    duration_minutes: Optional[int] = None
    is_cancelled: Optional[bool] = None

    @field_validator('start_time')
    @classmethod
    def parse_start_time(cls, v):
        if v is None:
            return None
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

class SubstituteTeacherRequest(BaseModel):
    substitute_teacher_id: int
    lesson_date: Union[datetime, str]

    @field_validator('lesson_date')
    @classmethod
    def parse_lesson_date(cls, v):
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

class RescheduleLessonRequest(BaseModel):
    lesson_date: Union[datetime, str]
    new_start_time: Union[datetime, str]
    new_hall_id: Optional[int] = None

    @field_validator('lesson_date', 'new_start_time')
    @classmethod
    def parse_datetime_fields(cls, v):
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

class UpdateHallRequest(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None

class UpdateTeacherRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    hourly_rate: Optional[float] = None
    bio: Optional[str] = None

class UpdateStudentRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    comment: Optional[str] = None
    trial_used: Optional[bool] = None
    subscription_until: Optional[str] = None

@router.get("/analytics")
async def get_analytics(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    hall_rows = await pool.fetch(
        """
        SELECT
            h.id, h.name, h.capacity,
            COUNT(DISTINCT g.id) FILTER (WHERE g.is_additional = FALSE) AS regular_groups,
            COUNT(DISTINCT se.id) FILTER (WHERE se.additional = TRUE AND se.approved = TRUE) AS additional_lessons
        FROM halls h
        LEFT JOIN groups g ON g.hall_id = h.id
        LEFT JOIN schedule_exceptions se ON se.hall_id = h.id
        GROUP BY h.id, h.name, h.capacity
        ORDER BY h.id
        """
    )
    
    student_attendance_rows = await pool.fetch(
        """
        SELECT
            g.id, g.name,
            CASE WHEN COUNT(ar.id) = 0 THEN NULL
                 ELSE AVG(CASE WHEN ar.attended THEN 1 ELSE 0 END)
            END AS avg_attendance
        FROM groups g
        LEFT JOIN attendance_records ar ON ar.group_id = g.id
        GROUP BY g.id, g.name
        ORDER BY g.id
        """
    )
    
    teacher_attendance_rows = await pool.fetch(
        """
        SELECT
            t.id, u.name,
            CASE WHEN COUNT(ar.id) = 0 THEN NULL
                 ELSE AVG(CASE WHEN ar.teacher_present THEN 1 ELSE 0 END)
            END AS avg_presence
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN attendance_records ar ON ar.teacher_id = t.id
        GROUP BY t.id, u.name
        ORDER BY t.id
        """
    )
    
    return {
        "halls": [
            {
                "id": r["id"],
                "name": r["name"],
                "capacity": r["capacity"],
                "regular_groups": int(r["regular_groups"]) if r["regular_groups"] else 0,
                "additional_lessons": int(r["additional_lessons"]) if r["additional_lessons"] else 0
            }
            for r in hall_rows
        ],
        "student_attendance": [
            {
                "group_id": r["id"],
                "group_name": r["name"],
                "average_attendance": float(r["avg_attendance"]) if r["avg_attendance"] else None
            }
            for r in student_attendance_rows
        ],
        "teacher_attendance": [
            {
                "teacher_id": r["id"],
                "teacher_name": r["name"],
                "average_presence": float(r["avg_presence"]) if r["avg_presence"] else None
            }
            for r in teacher_attendance_rows
        ]
    }

@router.get("/analytics/halls")
async def get_hall_analytics(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT
            h.id, h.name,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 1 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS monday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 2 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS tuesday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 3 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS wednesday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 4 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS thursday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 5 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS friday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 6 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS saturday_hours,
            COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM g.start_time) = 0 THEN COALESCE(g.duration_minutes, 90) / 60.0 ELSE 0 END), 0) AS sunday_hours
        FROM halls h
        LEFT JOIN groups g ON g.hall_id = h.id AND g.is_closed = FALSE AND g.start_time IS NOT NULL
        GROUP BY h.id, h.name
        ORDER BY h.id
        """
    )
    
    halls = []
    for r in rows:
        monday = float(r["monday_hours"]) if r["monday_hours"] else 0
        tuesday = float(r["tuesday_hours"]) if r["tuesday_hours"] else 0
        wednesday = float(r["wednesday_hours"]) if r["wednesday_hours"] else 0
        thursday = float(r["thursday_hours"]) if r["thursday_hours"] else 0
        friday = float(r["friday_hours"]) if r["friday_hours"] else 0
        saturday = float(r["saturday_hours"]) if r["saturday_hours"] else 0
        sunday = float(r["sunday_hours"]) if r["sunday_hours"] else 0
        total = monday + tuesday + wednesday + thursday + friday + saturday + sunday
        
        halls.append({
            "hallId": r["id"],
            "hallName": r["name"],
            "monday": round(monday),
            "tuesday": round(tuesday),
            "wednesday": round(wednesday),
            "thursday": round(thursday),
            "friday": round(friday),
            "saturday": round(saturday),
            "sunday": round(sunday),
            "total": round(total)
        })
    
    return {"halls": halls}

@router.get("/analytics/teachers")
async def get_teacher_analytics(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT
            t.id, u.name,
            COALESCE(SUM(DISTINCT g.duration_minutes), 0) / 60.0 AS total_hours_per_week,
            COUNT(DISTINCT gs.student_id) AS student_count
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN groups g ON 
            (g.main_teacher_id = t.id OR EXISTS (
                SELECT 1 FROM group_teachers gt 
                WHERE gt.group_id = g.id AND gt.teacher_id = t.id
            ))
            AND g.is_closed = FALSE 
            AND g.start_time IS NOT NULL
        LEFT JOIN group_students gs ON gs.group_id = g.id AND gs.is_trial = FALSE
        GROUP BY t.id, u.name
        ORDER BY total_hours_per_week DESC
        """
    )
    
    teachers = [
        {
            "teacherId": r["id"],
            "teacherName": r["name"],
            "totalHours": round(float(r["total_hours_per_week"])) if r["total_hours_per_week"] else 0,
            "studentCount": int(r["student_count"]) if r["student_count"] else 0
        }
        for r in rows
    ]
    
    return {"teachers": teachers}

@router.get("/groups")
async def get_groups(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT
            g.id, g.name, g.capacity, g.start_time, g.duration_minutes,
            g.is_additional, g.is_closed, g.recurring_days, g.notes,
            h.id AS hall_id, h.name AS hall_name,
            u.name AS teacher_name,
            (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) AS enrolled
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        LEFT JOIN teachers t ON t.id = g.main_teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY g.id
        """
    )
    
    groups = []
    for r in rows:
        enrolled = int(r["enrolled"]) if r["enrolled"] else 0
        groups.append({
            "id": r["id"],
            "name": r["name"],
            "capacity": r["capacity"],
            "start_time": str(r["start_time"]) if r["start_time"] else None,
            "duration_minutes": r["duration_minutes"],
            "is_additional": r["is_additional"],
            "is_closed": r["is_closed"],
            "recurring_days": r["recurring_days"],
            "notes": r["notes"],
            "hall": {"id": r["hall_id"], "name": r["hall_name"]} if r["hall_id"] else None,
            "teacher_name": r["teacher_name"],
            "enrolled": enrolled,
            "free_slots": r["capacity"] - enrolled if r["capacity"] else None
        })
    
    return {"groups": groups}

@router.get("/groups/{group_id}")
async def get_group_details(group_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    row = await pool.fetchrow(
        """
        SELECT
            g.id, g.name, g.capacity, g.start_time, g.duration_minutes,
            g.is_additional, g.is_closed, g.recurring_days, g.notes,
            h.id AS hall_id, h.name AS hall_name,
            t.id AS teacher_id, u.name AS teacher_name
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        LEFT JOIN teachers t ON t.id = g.main_teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        WHERE g.id = $1
        """,
        group_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {
        "id": row["id"],
        "name": row["name"],
        "capacity": row["capacity"],
        "start_time": str(row["start_time"]) if row["start_time"] else None,
        "duration_minutes": row["duration_minutes"],
        "is_additional": row["is_additional"],
        "is_closed": row["is_closed"],
        "recurring_days": row["recurring_days"],
        "notes": row["notes"],
        "hall": {"id": row["hall_id"], "name": row["hall_name"]} if row["hall_id"] else None,
        "teacher": {"id": row["teacher_id"], "name": row["teacher_name"]} if row["teacher_id"] else None
    }

@router.post("/groups")
async def create_group(data: CreateGroupRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    result = await pool.fetchrow(
        """
        INSERT INTO groups (name, hall_id, main_teacher_id, start_time, duration_minutes, capacity, recurring_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """,
        data.name, data.hall_id, data.main_teacher_id, data.start_time,
        data.duration_minutes, data.capacity, data.recurring_days
    )
    
    return {"group_id": result["id"]}

@router.put("/groups/{group_id}")
async def update_group(group_id: int, data: UpdateGroupRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    updates = []
    values = []
    param_count = 1
    
    if data.name is not None:
        updates.append(f"name = ${param_count}")
        values.append(data.name)
        param_count += 1
    if data.hall_id is not None:
        updates.append(f"hall_id = ${param_count}")
        values.append(data.hall_id)
        param_count += 1
    if data.main_teacher_id is not None:
        updates.append(f"main_teacher_id = ${param_count}")
        values.append(data.main_teacher_id)
        param_count += 1
    if data.start_time is not None:
        updates.append(f"start_time = ${param_count}")
        values.append(data.start_time)
        param_count += 1
    if data.duration_minutes is not None:
        updates.append(f"duration_minutes = ${param_count}")
        values.append(data.duration_minutes)
        param_count += 1
    if data.capacity is not None:
        updates.append(f"capacity = ${param_count}")
        values.append(data.capacity)
        param_count += 1
    if data.recurring_days is not None:
        updates.append(f"recurring_days = ${param_count}")
        values.append(data.recurring_days)
        param_count += 1
    if data.is_closed is not None:
        updates.append(f"is_closed = ${param_count}")
        values.append(data.is_closed)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.append(group_id)
    
    await pool.execute(
        f"UPDATE groups SET {', '.join(updates)} WHERE id = ${param_count}",
        *values
    )
    
    return {"message": "Group updated"}

@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Check if group has any students enrolled
            student_count = await conn.fetchval(
                "SELECT COUNT(*) FROM group_students WHERE group_id = $1", group_id
            )
            
            if student_count > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete group - it has students enrolled. Please remove all students first."
                )
            
            # Check if group has any lessons
            lesson_count = await conn.fetchval(
                "SELECT COUNT(*) FROM lessons WHERE group_id = $1", group_id
            )
            
            if lesson_count > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete group - it has scheduled lessons. Please delete all lessons first."
                )
            
            # Delete the group
            result = await conn.execute("DELETE FROM groups WHERE id = $1", group_id)
            
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Group not found")
    
    return {"message": "Group deleted"}

@router.get("/halls")
async def get_halls(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch("SELECT id, name, capacity FROM halls ORDER BY id")
    
    return {
        "halls": [
            {"id": r["id"], "name": r["name"], "capacity": r["capacity"]}
            for r in rows
        ]
    }

@router.post("/halls")
async def create_hall(data: CreateHallRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    result = await pool.fetchrow(
        "INSERT INTO halls (name, capacity) VALUES ($1, $2) RETURNING id",
        data.name, data.capacity
    )
    
    return {"hall_id": result["id"]}

@router.put("/halls/{hall_id}")
async def update_hall(hall_id: int, data: UpdateHallRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    updates = []
    values = []
    param_count = 1
    
    if data.name is not None:
        updates.append(f"name = ${param_count}")
        values.append(data.name)
        param_count += 1
    if data.capacity is not None:
        updates.append(f"capacity = ${param_count}")
        values.append(data.capacity)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.append(hall_id)
    
    await pool.execute(
        f"UPDATE halls SET {', '.join(updates)} WHERE id = ${param_count}",
        *values
    )
    
    return {"message": "Hall updated"}

@router.delete("/halls/{hall_id}")
async def delete_hall(hall_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    # Check if hall is being used by any groups
    usage_check = await pool.fetchval(
        "SELECT COUNT(*) FROM groups WHERE hall_id = $1", hall_id
    )
    
    if usage_check > 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete hall - it is currently assigned to one or more groups"
        )
    
    result = await pool.execute("DELETE FROM halls WHERE id = $1", hall_id)
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Hall not found")
    
    return {"message": "Hall deleted"}

@router.get("/teachers")
async def get_teachers(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT t.id, u.id AS user_id, u.name, u.email, t.hourly_rate, t.bio
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        ORDER BY u.name
        """
    )
    
    return {
        "teachers": [
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "name": r["name"],
                "email": r["email"],
                "hourly_rate": float(r["hourly_rate"]) if r["hourly_rate"] else None,
                "bio": r["bio"]
            }
            for r in rows
        ]
    }

@router.post("/teachers")
async def create_teacher(data: CreateTeacherRequest, user: dict = Depends(require_admin)):
    from ..auth import get_password_hash
    
    pool = await get_connection()
    
    hashed_password = get_password_hash(data.password)
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            user_row = await conn.fetchrow(
                """
                INSERT INTO users (name, email, password, role)
                VALUES ($1, $2, $3, 'teacher')
                RETURNING id
                """,
                data.name, data.email, hashed_password
            )
            
            teacher_row = await conn.fetchrow(
                """
                INSERT INTO teachers (user_id, hourly_rate, bio)
                VALUES ($1, $2, $3)
                RETURNING id
                """,
                user_row["id"], data.hourly_rate, data.bio
            )
    
    return {"teacher_id": teacher_row["id"]}

@router.put("/teachers/{teacher_id}")
async def update_teacher(teacher_id: int, data: UpdateTeacherRequest, user: dict = Depends(require_admin)):
    from ..auth import get_password_hash
    
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get user_id for this teacher
            teacher_row = await conn.fetchrow(
                "SELECT user_id FROM teachers WHERE id = $1", teacher_id
            )
            
            if not teacher_row:
                raise HTTPException(status_code=404, detail="Teacher not found")
            
            user_id = teacher_row["user_id"]
            
            # Update users table if needed
            user_updates = []
            user_values = []
            param_count = 1
            
            if data.name is not None:
                user_updates.append(f"name = ${param_count}")
                user_values.append(data.name)
                param_count += 1
            if data.email is not None:
                user_updates.append(f"email = ${param_count}")
                user_values.append(data.email)
                param_count += 1
            if data.password is not None:
                user_updates.append(f"password = ${param_count}")
                user_values.append(get_password_hash(data.password))
                param_count += 1
            
            if user_updates:
                user_values.append(user_id)
                await conn.execute(
                    f"UPDATE users SET {', '.join(user_updates)} WHERE id = ${param_count}",
                    *user_values
                )
            
            # Update teachers table if needed
            teacher_updates = []
            teacher_values = []
            param_count = 1
            
            if data.hourly_rate is not None:
                teacher_updates.append(f"hourly_rate = ${param_count}")
                teacher_values.append(data.hourly_rate)
                param_count += 1
            if data.bio is not None:
                teacher_updates.append(f"bio = ${param_count}")
                teacher_values.append(data.bio)
                param_count += 1
            
            if teacher_updates:
                teacher_values.append(teacher_id)
                await conn.execute(
                    f"UPDATE teachers SET {', '.join(teacher_updates)} WHERE id = ${param_count}",
                    *teacher_values
                )
    
    return {"message": "Teacher updated"}

@router.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Check if teacher is assigned to any groups
            usage_check = await conn.fetchval(
                "SELECT COUNT(*) FROM groups WHERE main_teacher_id = $1", teacher_id
            )
            
            if usage_check > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete teacher - they are currently assigned to one or more groups"
                )
            
            # Get user_id before deletion
            teacher_row = await conn.fetchrow(
                "SELECT user_id FROM teachers WHERE id = $1", teacher_id
            )
            
            if not teacher_row:
                raise HTTPException(status_code=404, detail="Teacher not found")
            
            user_id = teacher_row["user_id"]
            
            # Delete teacher record (this will cascade to user due to foreign key)
            await conn.execute("DELETE FROM teachers WHERE id = $1", teacher_id)
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)
    
    return {"message": "Teacher deleted"}

@router.get("/students")
async def get_students(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT s.id, u.id AS user_id, u.name, u.email, s.phone_number, 
               s.trial_used, s.subscription_until
        FROM students s
        JOIN users u ON u.id = s.user_id
        ORDER BY u.name
        """
    )
    
    return {
        "students": [
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "name": r["name"],
                "email": r["email"],
                "phone_number": r["phone_number"],
                "trial_used": r["trial_used"],
                "subscription_until": str(r["subscription_until"]) if r["subscription_until"] else None
            }
            for r in rows
        ]
    }

@router.post("/students")
async def create_student(data: CreateStudentRequest, user: dict = Depends(require_admin)):
    from ..auth import get_password_hash
    
    pool = await get_connection()
    
    hashed_password = get_password_hash(data.password)
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            user_row = await conn.fetchrow(
                """
                INSERT INTO users (name, email, password, role)
                VALUES ($1, $2, $3, 'student')
                RETURNING id
                """,
                data.name, data.email, hashed_password
            )
            
            student_row = await conn.fetchrow(
                """
                INSERT INTO students (user_id, phone_number)
                VALUES ($1, $2)
                RETURNING id
                """,
                user_row["id"], data.phone_number
            )
    
    return {"student_id": student_row["id"]}

@router.put("/students/{student_id}")
async def update_student(student_id: int, data: UpdateStudentRequest, user: dict = Depends(require_admin)):
    from ..auth import get_password_hash
    from datetime import datetime
    
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get user_id for this student
            student_row = await conn.fetchrow(
                "SELECT user_id FROM students WHERE id = $1", student_id
            )
            
            if not student_row:
                raise HTTPException(status_code=404, detail="Student not found")
            
            user_id = student_row["user_id"]
            
            # Update users table if needed
            user_updates = []
            user_values = []
            param_count = 1
            
            if data.name is not None:
                user_updates.append(f"name = ${param_count}")
                user_values.append(data.name)
                param_count += 1
            if data.email is not None:
                user_updates.append(f"email = ${param_count}")
                user_values.append(data.email)
                param_count += 1
            if data.password is not None:
                user_updates.append(f"password = ${param_count}")
                user_values.append(get_password_hash(data.password))
                param_count += 1
            
            if user_updates:
                user_values.append(user_id)
                await conn.execute(
                    f"UPDATE users SET {', '.join(user_updates)} WHERE id = ${param_count}",
                    *user_values
                )
            
            # Update students table if needed
            student_updates = []
            student_values = []
            param_count = 1
            
            if data.phone_number is not None:
                student_updates.append(f"phone_number = ${param_count}")
                student_values.append(data.phone_number)
                param_count += 1
            if data.comment is not None:
                student_updates.append(f"comment = ${param_count}")
                student_values.append(data.comment)
                param_count += 1
            if data.trial_used is not None:
                student_updates.append(f"trial_used = ${param_count}")
                student_values.append(data.trial_used)
                param_count += 1
            if data.subscription_until is not None:
                # Parse subscription_until string to date
                try:
                    sub_date = datetime.strptime(data.subscription_until, "%Y-%m-%d").date()
                    student_updates.append(f"subscription_until = ${param_count}")
                    student_values.append(sub_date)
                    param_count += 1
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid subscription_until format. Use YYYY-MM-DD")
            
            if student_updates:
                student_values.append(student_id)
                await conn.execute(
                    f"UPDATE students SET {', '.join(student_updates)} WHERE id = ${param_count}",
                    *student_values
                )
    
    return {"message": "Student updated"}

@router.delete("/students/{student_id}")
async def delete_student(student_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Check if student is enrolled in any groups
            usage_check = await conn.fetchval(
                "SELECT COUNT(*) FROM group_students WHERE student_id = $1", student_id
            )
            
            if usage_check > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete student - they are currently enrolled in one or more groups"
                )
            
            # Get user_id before deletion
            student_row = await conn.fetchrow(
                "SELECT user_id FROM students WHERE id = $1", student_id
            )
            
            if not student_row:
                raise HTTPException(status_code=404, detail="Student not found")
            
            user_id = student_row["user_id"]
            
            # Delete student record (this will cascade to user due to foreign key)
            await conn.execute("DELETE FROM students WHERE id = $1", student_id)
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)
    
    return {"message": "Student deleted"}

@router.get("/groups/{group_id}/students")
async def get_group_students(group_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT s.id, u.name, u.email, s.phone_number, gs.is_trial, gs.joined_at
        FROM group_students gs
        JOIN students s ON s.id = gs.student_id
        JOIN users u ON u.id = s.user_id
        WHERE gs.group_id = $1
        ORDER BY u.name
        """,
        group_id
    )
    
    return {
        "students": [
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
    }

@router.post("/groups/{group_id}/students")
async def add_student_to_group(group_id: int, data: AddStudentToGroupRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute(
        """
        INSERT INTO group_students (group_id, student_id, is_trial)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        """,
        group_id, data.student_id, data.is_trial
    )
    
    return {"message": "Student added to group"}

@router.delete("/groups/{group_id}/students/{student_id}")
async def remove_student_from_group(group_id: int, student_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute(
        "DELETE FROM group_students WHERE group_id = $1 AND student_id = $2",
        group_id, student_id
    )
    
    return {"message": "Student removed from group"}

@router.post("/groups/{group_id}/limit")
async def update_group_limit(group_id: int, data: GroupLimitRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute(
        "UPDATE groups SET capacity = $1 WHERE id = $2",
        data.capacity, group_id
    )
    
    return {"message": "Group capacity updated"}

@router.post("/teachers/{teacher_id}/groups/{group_id}")
async def assign_teacher_to_group(teacher_id: int, group_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute(
        """
        INSERT INTO group_teachers (group_id, teacher_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        """,
        group_id, teacher_id
    )
    
    return {"message": "Teacher assigned to group"}

@router.post("/groups/{group_id}/attendance")
async def save_attendance(group_id: int, data: SaveAttendanceRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            for record in data.records:
                await conn.execute(
                    """
                    INSERT INTO attendance_records (group_id, student_id, attended, lesson_date)
                    VALUES ($1, $2, $3, $4)
                    """,
                    group_id, record.student_id, record.attended, data.lesson_date
                )
    
    return {"message": "Attendance saved"}

@router.get("/reschedule-requests")
async def get_reschedule_requests(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT
            rr.id, rr.lesson_id, rr.new_start_time, rr.new_hall_id, rr.reason, rr.status, rr.created_at,
            u.name AS teacher_name, l.class_name
        FROM reschedule_requests rr
        JOIN teachers t ON t.id = rr.teacher_id
        JOIN users u ON u.id = t.user_id
        LEFT JOIN lessons l ON l.id = rr.lesson_id
        ORDER BY rr.created_at DESC
        """
    )
    
    return {
        "requests": [
            {
                "id": r["id"],
                "lesson_id": r["lesson_id"],
                "new_start_time": str(r["new_start_time"]) if r["new_start_time"] else None,
                "new_hall_id": r["new_hall_id"],
                "reason": r["reason"],
                "status": r["status"],
                "created_at": str(r["created_at"]) if r["created_at"] else None,
                "teacher_name": r["teacher_name"],
                "class_name": r["class_name"]
            }
            for r in rows
        ]
    }

@router.post("/reschedule-requests/{request_id}/approve")
async def approve_reschedule_request(request_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    request = await pool.fetchrow(
        "SELECT lesson_id, new_start_time, new_hall_id FROM reschedule_requests WHERE id = $1",
        request_id
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE reschedule_requests SET status = 'approved' WHERE id = $1",
                request_id
            )
            
            updates = ["start_time = $1", "is_rescheduled = TRUE"]
            values = [request["new_start_time"]]
            
            if request["new_hall_id"]:
                updates.append(f"hall_id = ${len(values) + 1}")
                values.append(request["new_hall_id"])
            
            values.append(request["lesson_id"])
            
            await conn.execute(
                f"UPDATE lessons SET {', '.join(updates)} WHERE id = ${len(values)}",
                *values
            )
    
    return {"message": "Reschedule request approved"}

@router.post("/reschedule-requests/{request_id}/reject")
async def reject_reschedule_request(request_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute(
        "UPDATE reschedule_requests SET status = 'rejected' WHERE id = $1",
        request_id
    )
    
    return {"message": "Reschedule request rejected"}

@router.get("/lessons")
async def get_lessons(user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    rows = await pool.fetch(
        """
        SELECT
            l.id, l.group_id, l.class_name, l.start_time, l.duration_minutes,
            l.is_cancelled, l.is_rescheduled,
            g.name AS group_name,
            h.name AS hall_name,
            u.name AS teacher_name
        FROM lessons l
        LEFT JOIN groups g ON g.id = l.group_id
        LEFT JOIN halls h ON h.id = l.hall_id
        LEFT JOIN teachers t ON t.id = l.teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY l.start_time DESC
        """
    )
    
    return {
        "lessons": [
            {
                "id": r["id"],
                "group_id": r["group_id"],
                "group_name": r["group_name"],
                "class_name": r["class_name"],
                "start_time": str(r["start_time"]) if r["start_time"] else None,
                "duration_minutes": r["duration_minutes"],
                "is_cancelled": r["is_cancelled"],
                "is_rescheduled": r["is_rescheduled"],
                "hall_name": r["hall_name"],
                "teacher_name": r["teacher_name"]
            }
            for r in rows
        ]
    }

@router.post("/lessons")
async def create_lesson(data: CreateLessonRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    result = await pool.fetchrow(
        """
        INSERT INTO lessons (group_id, class_name, teacher_id, hall_id, start_time, duration_minutes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        data.group_id, data.class_name, data.teacher_id, data.hall_id,
        data.start_time, data.duration_minutes
    )
    
    return {"lesson_id": result["id"]}

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: int, data: UpdateLessonRequest, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    updates = []
    values = []
    param_count = 1
    
    if data.class_name is not None:
        updates.append(f"class_name = ${param_count}")
        values.append(data.class_name)
        param_count += 1
    if data.teacher_id is not None:
        updates.append(f"teacher_id = ${param_count}")
        values.append(data.teacher_id)
        param_count += 1
    if data.hall_id is not None:
        updates.append(f"hall_id = ${param_count}")
        values.append(data.hall_id)
        param_count += 1
    if data.start_time is not None:
        updates.append(f"start_time = ${param_count}")
        values.append(data.start_time)
        param_count += 1
    if data.duration_minutes is not None:
        updates.append(f"duration_minutes = ${param_count}")
        values.append(data.duration_minutes)
        param_count += 1
    if data.is_cancelled is not None:
        updates.append(f"is_cancelled = ${param_count}")
        values.append(data.is_cancelled)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.append(lesson_id)
    
    await pool.execute(
        f"UPDATE lessons SET {', '.join(updates)} WHERE id = ${param_count}",
        *values
    )
    
    return {"message": "Lesson updated"}

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: int, user: dict = Depends(require_admin)):
    pool = await get_connection()
    
    await pool.execute("DELETE FROM lessons WHERE id = $1", lesson_id)
    
    return {"message": "Lesson deleted"}
