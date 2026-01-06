"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { API, handleApiError } from "@/lib/api"
import { Bell, SignOut, CaretLeft, CaretRight, CalendarBlank, ChartBar, Clock, User, Users, UserSwitch, X, Copy, PencilSimple, Trash, Calendar as CalendarIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Toaster, toast } from 'sonner'
import { formatTimeWithGMT5 } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, parse } from "date-fns"
import { ru } from "date-fns/locale"

interface UserData {
  id: number
  name: string
  email: string
  role: string
}

interface ScheduleLesson {
  lesson_id?: number
  group_id: number
  group_name: string
  class_name?: string
  start_time: string | null
  duration_minutes: number
  is_additional: boolean
  hall: { id: number; name: string } | null
  teacher_name?: string
  is_cancelled?: boolean
  is_rescheduled?: boolean
  substitute_teacher_name?: string
  recurring_days?: string
  status?: string
}

interface LessonDetails {
  group_id: number
  group_name: string
  direction: string
  time: string
  hall: string
  teacher: string
  is_additional: boolean
  students: { id: number; name: string; attendance?: 'P' | 'E' | 'L' | 'A' | null }[]
  attendance: { present: number; absent: number }
}

export default function AnalyticsSchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [lessons, setLessons] = useState<ScheduleLesson[]>([])
  const [halls, setHalls] = useState<{ id: number; name: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([])
  const [selectedHall, setSelectedHall] = useState<string>("all")
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all")
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [selectedLesson, setSelectedLesson] = useState<LessonDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [studentAttendance, setStudentAttendance] = useState<Record<number, 'P' | 'E' | 'L' | 'A' | null>>({})

  const [substituteDialogOpen, setSubstituteDialogOpen] = useState(false)
  const [selectedLessonForAction, setSelectedLessonForAction] = useState<ScheduleLesson | null>(null)
  const [selectedSubstituteTeacher, setSelectedSubstituteTeacher] = useState<string>("")

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editClassName, setEditClassName] = useState<string>("")
  const [editTeacherId, setEditTeacherId] = useState<string>("")
  const [editHallId, setEditHallId] = useState<string>("")
  const [editStartTime, setEditStartTime] = useState<string>("")
  const [editDuration, setEditDuration] = useState<number>(60)
  const [editDirection, setEditDirection] = useState<string>("")

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {})
  const [confirmTitle, setConfirmTitle] = useState("")
  const [confirmMessage, setConfirmMessage] = useState("")

  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [newLessonDate, setNewLessonDate] = useState<string>("")
  const [newLessonTime, setNewLessonTime] = useState<string>("")

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title)
    setConfirmMessage(message)
    setConfirmAction(() => onConfirm)
    setConfirmDialogOpen(true)
  }

  const refetchScheduleData = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setLoading(true);

      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      const weekStart = monday.toISOString().split('T')[0];

      const scheduleData = await API.schedule.getWeekly(weekStart);

      const transformedLessons: ScheduleLesson[] = scheduleData.entries.map((entry: any) => ({
        lesson_id: entry.lessonId,
        group_id: entry.groupId,
        group_name: entry.groupName,
        class_name: entry.className,
        start_time: `${entry.date}T${entry.startTime}:00`,
        duration_minutes: entry.duration,
        is_additional: false,
        hall: entry.hallId ? { id: entry.hallId, name: entry.hallName } : null,
        teacher_name: entry.teacherName,
        is_cancelled: entry.isCancelled || false,
        is_rescheduled: entry.isRescheduled || false,
        substitute_teacher_name: entry.substituteTeacherName,
        recurring_days: entry.dayIndex.toString(),
        status: entry.status
      }));

      setLessons(transformedLessons);
      setLoading(false);
    } catch (error) {
      console.error('Error refetching schedule data:', error);
      setLoading(false);
    }
  }

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  function getWeekDays(startDate: Date): Date[] {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      days.push(date)
    }
    return days
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    toast.success("Вы успешно вышли из системы")
    router.push("/login")
  }

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeekStart(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeekStart(newDate)
  }

  const handleLessonClick = async (lesson: ScheduleLesson) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const studentsData = await API.groups.getById(lesson.group_id);
      const students = studentsData.students?.map((s: any) => ({
        id: s.id,
        name: s.name,
        attendance: s.attendance as 'P' | 'E' | 'L' | 'A' | null
      })) || [];

      const formatTimeWithTimezone = (dateStr: string) => {
        return formatTimeWithGMT5(dateStr)
      }

      setSelectedLesson({
        group_id: lesson.group_id,
        group_name: lesson.group_name,
        direction: "Нет",
        time: lesson.start_time ? `${formatTimeWithTimezone(lesson.start_time)} - ${formatTimeWithTimezone(new Date(new Date(lesson.start_time).getTime() + lesson.duration_minutes * 60000).toISOString())}` : "Не указано",
        hall: lesson.hall ? `Зал ${lesson.hall.name}` : "Не указан",
        teacher: lesson.teacher_name || "Не назначен",
        is_additional: lesson.is_additional,
        students: students,
        attendance: { present: 0, absent: students.length }
      })

      const initialAttendance: Record<number, 'P' | 'E' | 'L' | 'A' | null> = {}
      students.forEach((student: any) => {
        initialAttendance[student.id] = student.attendance || null
      })
      setStudentAttendance(initialAttendance)

      setDialogOpen(true)
    } catch (error) {
      console.error("Error fetching students:", error)
      toast.error("Ошибка при загрузке студентов")
    }
  }

  const handleAttendanceChange = (studentId: number, status: 'P' | 'E' | 'L' | 'A') => {
    setStudentAttendance(prev => ({
      ...prev,

      [studentId]: prev[studentId] === status ? null : status
    }))
  }

  const getAttendancePoints = (status: 'P' | 'E' | 'L' | 'A' | null) => {
    switch (status) {
      case 'P': return '2/2'
      case 'E': return '2/2'
      case 'L': return '1/2'
      case 'A': return '0/2'
      default: return '-'
    }
  }

  const handleSaveAttendance = async () => {
    if (!selectedLesson) return

    try {
      const attendanceRecords = Object.entries(studentAttendance)
        .filter(([_, status]) => status !== null)
        .map(([studentId, status]) => ({
          studentId: parseInt(studentId),
          status: status
        }));

      if (attendanceRecords.length === 0) {
        toast.error("Отметьте посещаемость хотя бы для одного ученика");
        return;
      }

      toast.success("Посещаемость успешно сохранена");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
      handleApiError(error);
      toast.error("Произошла ошибка при сохранении посещаемости");
    }
  };

  const handleSubstituteLesson = (lesson: ScheduleLesson) => {
    setSelectedLessonForAction(lesson)
    setSubstituteDialogOpen(true)
  }

  const handleSaveSubstitute = async () => {
    if (!selectedLessonForAction || !selectedSubstituteTeacher) {
      toast.error("Выберите преподавателя для замены")
      return
    }

    try {
      if (selectedLessonForAction.lesson_id) {
        await API.lessons.substitute(
          selectedLessonForAction.lesson_id,
          parseInt(selectedSubstituteTeacher)
        )

        await refetchScheduleData()

        toast.success("Замена успешно назначена")
      } else {
        toast.error("Невозможно назначить замену для регулярного занятия. Пожалуйста, создайте индивидуальное занятие.")
      }

      setSubstituteDialogOpen(false)
      setSelectedSubstituteTeacher("")
      setSelectedLessonForAction(null)

    } catch (error) {
      console.error("Error setting substitute:", error)
      handleApiError(error);

      if (error instanceof Error && error.message.includes('не найден')) {
        toast.error("Занятие не найдено")
      } else {
        toast.error("Произошла ошибка при назначении замены")
      }
    }
  }

    const handleCancelLesson = async (lesson: ScheduleLesson) => {
    const performCancel = async () => {
      try {
        if (lesson.lesson_id) {
          await API.lessons.cancel(lesson.lesson_id)
        } else {

          console.warn('Cannot cancel recurring lesson without lesson_id')
          toast.error("Невозможно отменить регулярное занятие без ID урока")
          return
        }

        await refetchScheduleData()

        toast.success("Урок успешно отменён")
      } catch (error) {
        console.error("Error canceling lesson:", error)
        handleApiError(error);
        toast.error("Произошла ошибка при отмене урока")
      }
    }

    showConfirmDialog(
      "Отменить занятие",
      `Вы уверены, что хотите отменить урок "${lesson.class_name ? `${lesson.class_name} - ${lesson.group_name}` : lesson.group_name}"?`,
      performCancel
    )
  }

  const handleRescheduleLesson = (lesson: ScheduleLesson) => {
    setSelectedLessonForAction(lesson)
    setNewLessonDate(new Date().toISOString().split('T')[0])
    setNewLessonTime(lesson.start_time ? new Date(lesson.start_time).toTimeString().slice(0, 5) : "09:00")
    setRescheduleDialogOpen(true)
  }

  const handleSaveReschedule = async () => {
    if (!selectedLessonForAction || !newLessonDate || !newLessonTime) {
      toast.error("Заполните дату и время")
      return
    }

    try {
      if (selectedLessonForAction.lesson_id) {
        await API.lessons.reschedule(
          selectedLessonForAction.lesson_id,
          newLessonDate,
          newLessonTime
        )

        await refetchScheduleData()

        toast.success("Урок успешно перенесён")
      } else {
        console.warn('Cannot reschedule lesson without lesson_id')
        toast.error("Невозможно перенести регулярное занятие без ID урока")
      }

      setRescheduleDialogOpen(false)
      setNewLessonDate("")
      setNewLessonTime("")
      setSelectedLessonForAction(null)

    } catch (error) {
      console.error("Error rescheduling lesson:", error)
      handleApiError(error);
      toast.error("Произошла ошибка при переносе урока")
    }
  }

  const handleEditLesson = (lesson: ScheduleLesson) => {
    setSelectedLessonForAction(lesson)
    setEditClassName(lesson.class_name || "")
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedLessonForAction || !editClassName.trim()) {
      toast.error("Введите название предмета");
      return;
    }

    try {
      if (selectedLessonForAction.lesson_id) {
        await API.lessons.update(selectedLessonForAction.lesson_id, {
          class_name: editClassName.trim()
        })

        await refetchScheduleData()

        toast.success("Название урока успешно изменено");
      } else {

        await API.admin.updateGroup(selectedLessonForAction.group_id, {
          class_name: editClassName.trim()
        })

        await refetchScheduleData()

        toast.success("Название группы успешно изменено");
      }

      setEditDialogOpen(false);
      setEditClassName("");
      setSelectedLessonForAction(null);

    } catch (error) {
      console.error("Error editing lesson:", error);
      handleApiError(error);
      toast.error("Произошла ошибка при изменении");
    }
  };

  const handleDeleteLesson = async (lesson: ScheduleLesson) => {
    const performDelete = async () => {
      try {
        if (lesson.lesson_id) {
          await API.lessons.delete(lesson.lesson_id);
          await refetchScheduleData()
          toast.success("Урок успешно удален");
        } else {

          if (lesson.group_id) {
            const confirmGroupDeletion = confirm(
              "Это регулярное занятие группы. Удаление удалит всю группу и все связанные с ней данные. Продолжить?"
            );

            if (confirmGroupDeletion) {
              await API.groups.delete(lesson.group_id, false);
              await refetchScheduleData()
              toast.success("Группа успешно удалена");
            } else {
              return;
            }
          } else {
            toast.error("Невозможно удалить это занятие - отсутствует идентификатор");
            return;
          }
        }
      } catch (error) {
        console.error("Error deleting:", error);
        handleApiError(error);

        if (error instanceof Error && error.message.includes('не найден')) {
          toast.error("Занятие не найдено");
        } else if (lesson.lesson_id) {
          toast.error("Ошибка при удалении урока");
        } else {
          toast.error("Ошибка при удалении группы");
        }
      }
    }

    const itemType = lesson.lesson_id ? "урок" : "группу";
    const itemName = lesson.class_name
      ? `${lesson.class_name} - ${lesson.group_name}`
      : lesson.group_name;

    const warningText = lesson.lesson_id
      ? `Вы уверены, что хотите УДАЛИТЬ ${itemType} "${itemName}"? Это действие нельзя отменить.`
      : `Внимание! Это удалит всю группу "${itemName}" и все связанные данные. Это действие нельзя отменить.`;

    showConfirmDialog(
      `Удалить ${itemType}`,
      warningText,
      performDelete
    );
  };

  const handleOpenEditDialog = () => {
    if (!selectedLesson) return

    setEditDirection(selectedLesson.direction)
    setEditStartTime(selectedLesson.time.split(' - ')[0])
    setEditDuration(60)
    setEditHallId(halls.find(h => h.name === selectedLesson.hall)?.id.toString() || "")

    const teacher = teachers.find(t => t.name === selectedLesson.teacher)
    setEditTeacherId(teacher?.id.toString() || "")

    setEditDialogOpen(true)
  }

  const handleSaveLessonEdit = async () => {
    if (!selectedLesson) return

    if (!editDirection.trim() || !editStartTime || !editHallId || !editTeacherId) {

      toast.error("Заполните все обязательные поля");
      return;
    }

    let formattedTime = editStartTime;
    if (editStartTime.includes('AM') || editStartTime.includes('PM')) {
      const [timePart, period] = editStartTime.split(' ');
      const [hours, minutes] = timePart.split(':');
      let hour24 = parseInt(hours);

      if (period === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (period === 'AM' && hour24 === 12) {
        hour24 = 0;
      }

      formattedTime = `${hour24.toString().padStart(2, '0')}:${minutes}`;
    }

    try {
      const payload = {
        class_name: editDirection.trim(),
        startTime: formattedTime,
        durationMinutes: editDuration,
        hallId: parseInt(editHallId),
        teacherId: parseInt(editTeacherId)
      };

      toast.success("Занятие успешно обновлено");
      setEditDialogOpen(false);
      setDialogOpen(false);

      await refetchScheduleData();
    } catch (error) {
      console.error("💥 Error saving lesson edit:", error);
      handleApiError(error);
      toast.error("Произошла ошибка");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await API.users.me();
        setUser(userData.user);

        if (userData.user.role !== 'admin') {
          router.push("/");
          return;
        }

        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        const weekStart = monday.toISOString().split('T')[0];

        const scheduleData = await API.schedule.getWeekly(weekStart);

        const transformedLessons: ScheduleLesson[] = scheduleData.entries.map((entry: any) => ({
          lesson_id: entry.lessonId,
          group_id: entry.groupId,
          group_name: entry.groupName,
          class_name: entry.className,
          start_time: `${entry.date}T${entry.startTime}:00`,
          duration_minutes: entry.duration,
          is_additional: false,
          hall: entry.hallId ? { id: entry.hallId, name: entry.hallName } : null,
          teacher_name: entry.teacherName,
          is_cancelled: entry.isCancelled || false,
          is_rescheduled: entry.isRescheduled || false,
          substitute_teacher_name: entry.substituteTeacherName,
          recurring_days: entry.dayIndex.toString(),
          status: entry.status
        }));
        setLessons(transformedLessons);

        const hallsData = await API.halls.getAll();
        setHalls(hallsData.halls || []);

        const teachersData = await API.teachers.getAll();
        setTeachers(teachersData.teachers || []);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        handleApiError(error);
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка расписания...</p>
        </div>
      </div>
    )
  }

  const profile = {
    name: user?.name || "Не указано",
    initials: user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : "НИ",
    email: user?.email || "Не указано",
  }

  const weekDays = getWeekDays(currentWeekStart)
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const filteredLessons = lessons.filter(lesson => {
    if (selectedHall !== "all" && lesson.hall?.name !== selectedHall) return false
    if (selectedTeacher !== "all" && lesson.teacher_name !== selectedTeacher) return false
    if (selectedGroup !== "all" && lesson.group_name !== selectedGroup) return false
    return true
  })

  const uniqueGroups = Array.from(new Set(lessons.map(l => l.group_name)))

  const getLessonsForDay = (dayIndex: number) => {
    return filteredLessons.filter(lesson => {
      if (!lesson.start_time) return false

      if (lesson.recurring_days !== undefined && lesson.recurring_days !== null) {
        return lesson.recurring_days === dayIndex.toString()
      }

      const lessonDate = new Date(lesson.start_time)
      const lessonDay = lessonDate.getDay()
      const adjustedDay = lessonDay === 0 ? 6 : lessonDay - 1
      return adjustedDay === dayIndex
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster
        position="top-right"
        richColors
        visibleToasts={5}
        expand={true}
        gap={8}
      />

      {}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-6 z-50">
        <div className="mb-8">
          <h1 className="text-xl font-bold">Nomad Dance Academy</h1>
          <p className="text-sm text-gray-400">Админ панель</p>
        </div>

        <nav className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/halls")}
          >
            <ChartBar size={20} className="mr-3" />
            Аналитика залов
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/teachers")}
          >
            <ChartBar size={20} className="mr-3" />
            Аналитика преподавателей
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/groups")}
          >
            <ChartBar size={20} className="mr-3" />
            Аналитика групп
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-gray-800 bg-gray-800"
          >
            <CalendarBlank size={20} className="mr-3" />
            Расписание
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/applications")}
          >
            <Clock size={20} className="mr-3" />
            Заявки
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/students")}
          >
            <User size={20} className="mr-3" />
            Ученики
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/groups")}
          >
            <Users size={20} className="mr-3" />
            Группы
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/halls")}
          >
            <Users size={20} className="mr-3" />
            Залы
          </Button>
        </nav>
      </aside>

      {}
      <div className="ml-64">
        {}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="px-8 py-4">
            <div className="flex items-center justify-end gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Уведомления</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                      <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-semibold">
                          {profile.initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                      <SignOut size={16} className="mr-2" />
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {}
        <main className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Расписание</h1>
          <p className="text-gray-600">Отображается в окошке календаря</p>
        </div>

        {}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Зал</label>
            <Select value={selectedHall} onValueChange={setSelectedHall}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Все залы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все залы</SelectItem>
                {halls.map(hall => (
                  <SelectItem key={hall.id} value={hall.name}>Зал {hall.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Учитель</label>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Все учителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все учителя</SelectItem>
                {teachers.map(teacher => (
                  <SelectItem key={teacher.id} value={teacher.name}>{teacher.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Группа</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Все группы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {uniqueGroups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
            <CaretLeft size={20} />
          </Button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border">
            <CalendarBlank size={20} className="text-gray-600" />
            <span className="font-medium">
              {currentWeekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <CaretRight size={20} />
          </Button>
        </div>

        {}
        {(() => {
          const HOUR_HEIGHT = 80;
          const timeSlots = Array.from({ length: 15 }, (_, i) => {
            const hour = 8 + i;
            return {
              hour,
              label: `${hour.toString().padStart(2, '0')}:00`,
              endLabel: `${(hour + 1).toString().padStart(2, '0')}:00`
            };
          });

          const getLessonPosition = (lesson: ScheduleLesson) => {
            if (!lesson.start_time) return null;
            const date = new Date(lesson.start_time);
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const startMinutes = (hours - 8) * 60 + minutes;
            const duration = lesson.duration_minutes || 60;
            return {
              top: (startMinutes / 60) * HOUR_HEIGHT,
              height: (duration / 60) * HOUR_HEIGHT,
              startTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
              endTime: (() => {
                const endDate = new Date(date.getTime() + duration * 60000);
                return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
              })()
            };
          };

          return (
            <div className="bg-white rounded-lg border overflow-x-auto">
              {}
              <div className="grid grid-cols-[80px_repeat(7,minmax(180px,1fr))] border-b bg-gray-50">
                <div className="p-4 text-center border-r">
                  <div className="font-medium text-gray-500 text-sm">Время</div>
                </div>
                {dayNames.map((day, index) => (
                  <div key={day} className="p-4 text-center border-r last:border-r-0">
                    <div className="font-medium text-gray-900">{day}</div>
                    <div className="text-sm text-gray-500">{weekDays[index].getDate()}</div>
                  </div>
                ))}
              </div>

              {}
              <div className="grid grid-cols-[80px_repeat(7,minmax(180px,1fr))]">
                {}
                <div className="border-r">
                  {timeSlots.map((slot, index) => (
                    <div
                      key={slot.hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="border-b last:border-b-0 flex items-start justify-center pt-1"
                    >
                      <span className="text-xs text-gray-500 font-medium">
                        {slot.label}
                      </span>
                    </div>
                  ))}
                </div>

                {}
                {weekDays.map((day, dayIndex) => {
                  const dayLessons = getLessonsForDay(dayIndex);

                  return (
                    <div
                      key={dayIndex}
                      className="border-r last:border-r-0 relative"
                      style={{ height: `${timeSlots.length * HOUR_HEIGHT}px` }}
                    >
                      {}
                      {timeSlots.map((slot, slotIndex) => (
                        <div
                          key={slot.hour}
                          className="absolute w-full border-b border-gray-100"
                          style={{ top: `${slotIndex * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {}
                      {dayLessons.map((lesson, lessonIndex) => {
                        const pos = getLessonPosition(lesson);
                        if (!pos || pos.top < 0 || pos.top > timeSlots.length * HOUR_HEIGHT) return null;

                        const lessonKey = `${lesson.lesson_id || lesson.group_id}-${lessonIndex}-${lesson.is_cancelled}-${lesson.substitute_teacher_name}-${lesson.status}`;

                        return (
                          <div
                            key={lessonKey}
                            className="absolute left-1 right-1 z-10"
                            style={{
                              top: `${pos.top}px`,
                              height: `${Math.max(pos.height, 40)}px`
                            }}
                          >
                            <div
                              onClick={() => handleLessonClick(lesson)}
                              className={`h-full p-2 rounded-lg border cursor-pointer hover:shadow-md transition-all overflow-hidden ${
                                lesson.is_additional
                                  ? 'bg-gray-400 border-gray-500 text-white'
                                  : 'bg-purple-600 border-purple-700 text-white'
                              }`}
                            >
                              <div className="flex justify-between items-start h-full">
                                <div className="flex-1 overflow-hidden">
                                  <div className="text-[10px] font-bold truncate">
                                    {pos.startTime}-{pos.endTime}
                                  </div>
                                  <div className="text-xs font-semibold truncate">
                                    {lesson.class_name ? `${lesson.class_name}` : lesson.group_name}
                                  </div>
                                  <div className="text-[10px] opacity-90 truncate">{lesson.hall?.name || "Зал не указан"}</div>
                                  <div className="text-[10px] opacity-90 truncate">
                                    {(() => {

                                      if (lesson.is_cancelled === true || lesson.status === "Отменён") {
                                        return <span className="text-red-200 font-bold text-[11px]">ОТМЕНЁН</span>;
                                      }

                                      if (lesson.substitute_teacher_name || lesson.teacher_name?.includes("Замена:")) {
                                        const substituteTeacher = lesson.substitute_teacher_name || lesson.teacher_name?.replace("Замена: ", "");
                                        return <span className="text-yellow-200 font-bold text-[10px]">Замена: {substituteTeacher}</span>;
                                      }

                                      return lesson.teacher_name || "Преподаватель";
                                    })()
                                    }
                                  </div>
                                  {(lesson.is_rescheduled === true || lesson.status === "Перенесён") && (
                                    <div className="text-[9px] text-blue-200 font-bold">ПЕРЕНЕСЁН</div>
                                  )}
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-white hover:bg-white/20 flex-shrink-0"
                                    >
                                      <span className="text-sm">⋮</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-56" align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSubstituteLesson(lesson)
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <UserSwitch size={16} />
                                      Разово поставить замену
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCancelLesson(lesson)
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <X size={16} />
                                      Разово отменить занятие
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRescheduleLesson(lesson)
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <CalendarIcon size={16} />
                                      Разово перенести занятие
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditLesson(lesson)
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <PencilSimple size={16} />
                                      Редактировать занятие
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteLesson(lesson)
                                      }}
                                      className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                    >
                                      <Trash size={16} />
                                      Удалить занятие
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Карточка занятия
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEditDialog}
                className="flex items-center gap-2"
              >
                <PencilSimple className="w-4 h-4" />
                Редактировать
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedLesson?.group_name}
            </DialogDescription>
          </DialogHeader>

          {selectedLesson && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Направление:</div>
                  <div className="font-medium">{selectedLesson.direction}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Нач-кон:</div>
                  <div className="font-medium">{selectedLesson.time}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Время:</div>
                  <div className="font-medium">{selectedLesson.time.split(' - ')[0]}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Зал:</div>
                  <div className="font-medium">{selectedLesson.hall}</div>
                </div>
              </div>

              <div>
                <div className="text-gray-500 mb-1 text-sm">Учитель:</div>
                <div className="font-medium">{selectedLesson.teacher}</div>
              </div>

              <div>
                <div className="text-gray-500 mb-3 text-sm font-medium">Список учеников:</div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {selectedLesson.students.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>В этой группе нет студентов</p>
                      <p className="text-sm mt-1">Добавьте студентов в группу для отметки посещаемости</p>
                    </div>
                  ) : (
                    selectedLesson.students.map((student, idx) => (
                      <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{idx + 1}. {student.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Баллы: {getAttendancePoints(studentAttendance[student.id])}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={studentAttendance[student.id] === 'P' ? 'default' : 'outline'}
                            className={`w-10 h-10 rounded-full p-0 ${
                              studentAttendance[student.id] === 'P'
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'border-gray-300 hover:border-green-600'
                            }`}
                            onClick={() => handleAttendanceChange(student.id, 'P')}
                          >
                            P
                          </Button>
                          <Button
                            size="sm"
                            variant={studentAttendance[student.id] === 'E' ? 'default' : 'outline'}
                            className={`w-10 h-10 rounded-full p-0 ${
                              studentAttendance[student.id] === 'E'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'border-gray-300 hover:border-blue-600'
                            }`}
                            onClick={() => handleAttendanceChange(student.id, 'E')}
                          >
                            E
                          </Button>
                          <Button
                            size="sm"
                            variant={studentAttendance[student.id] === 'L' ? 'default' : 'outline'}
                            className={`w-10 h-10 rounded-full p-0 ${
                              studentAttendance[student.id] === 'L'
                                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                : 'border-gray-300 hover:border-yellow-600'
                            }`}
                            onClick={() => handleAttendanceChange(student.id, 'L')}
                          >
                            L
                          </Button>
                          <Button
                            size="sm"
                            variant={studentAttendance[student.id] === 'A' ? 'default' : 'outline'}
                            className={`w-10 h-10 rounded-full p-0 ${
                              studentAttendance[student.id] === 'A'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'border-gray-300 hover:border-red-600'
                            }`}
                            onClick={() => handleAttendanceChange(student.id, 'A')}
                          >
                            A
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                  onClick={handleSaveAttendance}
                >
                  Сохранить посещаемость
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
        </Dialog>

        {}
        <Dialog open={substituteDialogOpen} onOpenChange={setSubstituteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Назначить замену</DialogTitle>
              <DialogDescription>
                Группа: {selectedLessonForAction?.group_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Преподаватель-заместитель</label>
                <Select value={selectedSubstituteTeacher} onValueChange={setSelectedSubstituteTeacher}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Выберите преподавателя" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSubstituteDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                  onClick={handleSaveSubstitute}
                >
                  Назначить замену
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Редактировать урок</DialogTitle>
              <DialogDescription>
                Изменить название предмета для группы {selectedLessonForAction?.group_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Название предмета</label>
                <Input
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  placeholder="Введите название предмета (например: Математика)"
                  className="bg-white"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                  onClick={handleSaveEdit}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Перенести урок</DialogTitle>
              <DialogDescription>
                Группа: {selectedLessonForAction?.group_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Новая дата</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white"
                    >
                      <CalendarBlank className="mr-2 h-4 w-4" />
                      {newLessonDate ? format(parse(newLessonDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ru }) : "Выберите дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newLessonDate ? parse(newLessonDate, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          setNewLessonDate(format(date, 'yyyy-MM-dd'))
                        }
                      }}
                      disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Новое время</label>
                <Input
                  type="time"
                  value={newLessonTime}
                  onChange={(e) => setNewLessonTime(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRescheduleDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                  onClick={handleSaveReschedule}
                >
                  Перенести
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Редактировать занятие</DialogTitle>
              <DialogDescription>
                {selectedLesson?.group_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Направление <span className="text-red-500">*</span></label>
                <Input
                  value={editDirection}
                  onChange={(e) => setEditDirection(e.target.value)}
                  placeholder="Например: Современный танец"
                  className="bg-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Время начала <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Продолжительность (минуты)</label>
                <Input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 60)}
                  min="30"
                  max="180"
                  className="bg-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Зал <span className="text-red-500">*</span></label>
                <Select value={editHallId} onValueChange={setEditHallId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Выберите зал" />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map(hall => (
                      <SelectItem key={hall.id} value={hall.id.toString()}>
                        {hall.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Преподаватель <span className="text-red-500">*</span></label>
                <Select value={editTeacherId} onValueChange={setEditTeacherId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Выберите преподавателя" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSaveLessonEdit}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmTitle}</DialogTitle>
              <DialogDescription>
                {confirmMessage}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  confirmAction()
                  setConfirmDialogOpen(false)
                }}
              >
                Подтвердить
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        </main>
      </div>
    </div>
  )
}
