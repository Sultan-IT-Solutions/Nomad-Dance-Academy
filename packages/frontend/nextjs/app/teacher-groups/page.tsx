"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users, Clock, MapPin, Plus, Loader, Calendar, Edit3 } from "lucide-react"
import CreateLessonModal from "@/components/create-lesson-modal"
import RescheduleLessonModal from "@/components/reschedule-lesson-modal"
import CreateGroupModal from "@/components/create-group-modal"
import { Button } from "@/components/ui/button"
import { formatTimeWithGMT5, formatDateWithGMT5 } from "@/lib/utils"
import { API, handleApiError, isAuthenticated } from "@/lib/api"

interface Group {
  id: number
  name: string
  start_time: string
  end_time: string
  duration_minutes: number
  hall_name?: string
  student_count: number
  capacity: number
  is_closed: boolean
  schedule?: string
  recurring_days?: string
  recurring_until?: string
}

interface ScheduledLesson {
  groupId: number
  groupName: string
  lessonDate: string
  lessonTime: string
  lessonDateTime: string
  hallName: string
  students: {
    studentId: number
    studentName: string
    attendance?: boolean | null
  }[]
  isCompleted: boolean
}

interface UserData {
  id: number
  name: string
  email: string
  role: string
}

export default function TeacherGroupsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [scheduledLessons, setScheduledLessons] = useState<ScheduledLesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLessonsLoading, setIsLessonsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateLessonOpen, setIsCreateLessonOpen] = useState(false)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'groups' | 'schedule'>('groups')
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<number, string>>>({})

  useEffect(() => {
    const checkRoleAndFetch = async () => {
      if (!isAuthenticated()) {
        localStorage.setItem("loginMessage", "Ваша сессия истекла, войдите в систему заново")
        router.push("/login")
        return
      }

      try {
        const userData = await API.users.me()
        setUser(userData.user)

        if (userData.user.role === 'student') {
          router.push('/my-groups')
          return
        }

        if (userData.user.role !== 'teacher') {
          setError("У вас нет доступа к этой странице")
          setIsLoading(false)
          return
        }

        await fetchTeacherGroups()
      } catch (err) {
        console.error("Error checking role:", err)
        handleApiError(err)
        setError("Ошибка при проверке доступа")
        setIsLoading(false)
      }
    }

    checkRoleAndFetch()
  }, [])

  const fetchTeacherGroups = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const groupsData = await API.teachers.getMyGroups()

      setGroups(groupsData.groups || [])
    } catch (err) {
      console.error("[Teacher Groups] Error fetching groups:", err)
      handleApiError(err)
      setError(err instanceof Error ? err.message : "Ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchScheduledLessons = async () => {
    try {
      setIsLessonsLoading(true)
      const lessonsData = await API.teachers.getScheduledLessons()
      setScheduledLessons(lessonsData.lessons || [])
    } catch (err) {
      console.error("[Teacher Schedule] Error fetching lessons:", err)
      handleApiError(err)
    } finally {
      setIsLessonsLoading(false)
    }
  }

  const handleCreateLesson = (lessonData: any) => {
    }

  const handleRescheduleLesson = (rescheduleData: any) => {
    }

  const updateAttendance = (lessonKey: string, studentId: number, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [lessonKey]: {
        ...prev[lessonKey],
        [studentId]: status
      }
    }))
  }

  const saveAttendance = async (lesson: ScheduledLesson) => {
    const lessonKey = `${lesson.groupId}-${lesson.lessonDate}`
    const attendanceRecords = attendanceData[lessonKey] || {}

    try {
      const attendance_records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: parseInt(studentId),
        status: status
      }))

      await API.teachers.saveAttendance(lesson.groupId, {
        lesson_date: lesson.lessonDate,
        attendance_records
      })

      await fetchScheduledLessons()
      alert("Посещаемость сохранена!")
    } catch (err) {
      console.error("Error saving attendance:", err)
      alert("Ошибка при сохранении посещаемости")
    }
  }

  const openRescheduleModal = (group: Group) => {

    let date, time;

    if (!group.start_time || group.start_time === '') {

      const now = new Date();
      date = now.toISOString().split('T')[0];
      time = '09:00';

      alert('Внимание: У группы не указано расписание. Используется время по умолчанию: сегодня в 09:00. Вы можете изменить его в форме переноса.');
    } else {
      date = formatDateForInput(group.start_time);
      time = formatTimeForInput(group.start_time);
    }

    const mockLesson = {
      groupId: group.id,
      groupName: group.name,
      date: date,
      time: time,
      duration: group.duration_minutes || 60
    }
    setSelectedLesson(mockLesson)
    setIsRescheduleOpen(true)
  }

  const handleCreateGroup = (groupData: any) => {
    fetchTeacherGroups()
  }

  const handleManageGroup = (groupId: number, groupName: string) => {
    router.push(`/teacher-groups/manage-group/${groupId}`)
  }

  const formatTime = (startTime: string) => {
    return formatTimeWithGMT5(startTime)
  }

  const formatDate = (startTime: string) => {
    return formatDateWithGMT5(startTime)
  }

  const formatDateForInput = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  }

  const formatTimeForInput = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    } catch {
      return '09:00'
    }
  }

  const getAttendanceButtonClass = (baseClass: string, isSelected: boolean) => {
    return `${baseClass} ${isSelected ? 'ring-2 ring-offset-1' : 'hover:scale-105'} transition-all`
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                className="text-foreground/70 hover:text-foreground text-sm"
                onClick={() => router.push("/")}
              >
                Главная
              </Button>
              {user?.role === 'teacher' ? (
                <>
                  <Button
                    className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-sm rounded-lg px-6"
                    onClick={() => router.push("/teacher-groups")}
                  >
                    Мои группы
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-foreground/70 hover:text-foreground text-sm"
                    onClick={() => router.push("/profile")}
                  >
                    Профиль
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="text-foreground/70 hover:text-foreground text-sm"
                    onClick={() => router.push("/schedule")}
                  >
                    Расписание групп
                  </Button>
                  <Button
                    className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-sm rounded-lg px-6"
                    onClick={() => router.push("/teacher-groups")}
                  >
                    Мои группы
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-foreground/70 hover:text-foreground text-sm"
                    onClick={() => router.push("/trial")}
                  >
                    Пробный урок
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-foreground/70 hover:text-foreground text-sm"
                    onClick={() => router.push("/profile")}
                  >
                    Профиль
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Уведомления</span>
                <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  АК
                </div>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg ${
              activeTab === 'groups'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Мои группы
          </button>
          <button
            onClick={() => {
              setActiveTab('schedule')
              fetchScheduledLessons()
            }}
            className={`px-4 py-2 rounded-lg ${
              activeTab === 'schedule'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Расписание и посещаемость
          </button>
        </div>

        {}
        {activeTab === 'groups' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Мои группы</h1>
              <p className="text-gray-600 text-sm">Управляйте вашими группами и расписанием</p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader className="animate-spin w-8 h-8 mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Загрузка групп...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-600 text-sm">{error}</p>
                {error.includes("teachers may view") && (
                  <p className="text-red-500 text-xs mt-1">
                    Возможно, проблема с аутентификацией. Попробуйте войти заново.
                  </p>
                )}
              </div>
            )}

            {!isLoading && !error && groups.length === 0 && (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium mb-2">Нет назначенных групп</p>
                <p className="text-gray-500 text-sm mb-6">
                  К вам пока не назначены группы для преподавания. Обратитесь к администратору для назначения групп.
                </p>
              </div>
            )}

            {!isLoading && !error && groups.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-lg cursor-pointer ${
                      group.is_closed
                        ? 'border-gray-300 bg-gray-50 opacity-75'
                        : 'border-purple-200 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                      {group.is_closed && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                          Закрыта
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Расписание</p>
                          <p className="text-sm font-medium text-gray-900">
                            {group.schedule || "Не назначено"}
                          </p>
                        </div>
                      </div>

                      {group.hall_name && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Зал</p>
                            <p className="text-sm font-medium text-gray-900">{group.hall_name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Студенты</p>
                          <p className="text-sm font-medium text-gray-900">
                            {group.student_count} / {group.capacity}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 mb-4">Продолжительность: {group.duration_minutes} минут</div>

                    <div className="space-y-2">
                      <Button
                        onClick={() => handleManageGroup(group.id, group.name)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-2 rounded-lg transition"
                      >
                        Управлять группой
                      </Button>
                      <Button
                        onClick={() => openRescheduleModal(group)}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 rounded-lg transition"
                      >
                        <Edit3 className="w-4 h-4" />
                        Перенести занятие
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {}
        {activeTab === 'schedule' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Расписание и посещаемость</h1>
              <p className="text-gray-600 text-sm">Отмечайте посещаемость студентов по расписанию</p>
            </div>

            {isLessonsLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader className="animate-spin w-8 h-8 mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Загрузка расписания...</p>
                </div>
              </div>
            )}

            {!isLessonsLoading && scheduledLessons.length === 0 && (
              <div className="text-center py-16">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium mb-2">Нет запланированных занятий</p>
                <p className="text-gray-500 text-sm">
                  Убедитесь, что у ваших групп установлено расписание с датами начала и окончания.
                </p>
              </div>
            )}

            {!isLessonsLoading && scheduledLessons.length > 0 && (
              <div className="space-y-6">
                {scheduledLessons.map((lesson) => {
                  const lessonKey = `${lesson.groupId}-${lesson.lessonDate}`
                  const currentAttendance = attendanceData[lessonKey] || {}

                  return (
                    <div key={lessonKey} className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{lesson.groupName}</h3>
                          <p className="text-sm text-gray-600">
                            {lesson.lessonDate} в {lesson.lessonTime} • {lesson.hallName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {lesson.isCompleted && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Посещаемость отмечена
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-600 px-3">
                          <span>Студент</span>
                          <span className="text-center">P - Присутствовал</span>
                          <span className="text-center">E - Уважительная</span>
                          <span className="text-center">L - Опоздал</span>
                          <span className="text-center">A - Отсутствовал</span>
                        </div>

                        {lesson.students.map((student) => (
                          <div key={student.studentId} className="grid grid-cols-6 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                            <span className="col-span-2 font-medium text-sm">{student.studentName}</span>

                            {}
                            <button
                              onClick={() => updateAttendance(lessonKey, student.studentId, 'P')}
                              className={getAttendanceButtonClass(
                                'px-3 py-2 bg-green-500 text-white text-xs rounded font-bold',
                                currentAttendance[student.studentId] === 'P'
                              )}
                            >
                              P
                            </button>

                            {}
                            <button
                              onClick={() => updateAttendance(lessonKey, student.studentId, 'E')}
                              className={getAttendanceButtonClass(
                                'px-3 py-2 bg-blue-500 text-white text-xs rounded font-bold',
                                currentAttendance[student.studentId] === 'E'
                              )}
                            >
                              E
                            </button>

                            {}
                            <button
                              onClick={() => updateAttendance(lessonKey, student.studentId, 'L')}
                              className={getAttendanceButtonClass(
                                'px-3 py-2 bg-yellow-500 text-white text-xs rounded font-bold',
                                currentAttendance[student.studentId] === 'L'
                              )}
                            >
                              L
                            </button>

                            {}
                            <button
                              onClick={() => updateAttendance(lessonKey, student.studentId, 'A')}
                              className={getAttendanceButtonClass(
                                'px-3 py-2 bg-red-500 text-white text-xs rounded font-bold',
                                currentAttendance[student.studentId] === 'A'
                              )}
                            >
                              A
                            </button>
                          </div>
                        ))}
                      </div>

                      {Object.keys(currentAttendance).length > 0 && (
                        <button
                          onClick={() => saveAttendance(lesson)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                          Сохранить посещаемость
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {}
      <CreateLessonModal
        isOpen={isCreateLessonOpen}
        onCloseAction={() => setIsCreateLessonOpen(false)}
        onSubmitAction={handleCreateLesson}
      />

      <RescheduleLessonModal
        isOpen={isRescheduleOpen}
        onCloseAction={() => setIsRescheduleOpen(false)}
        onSubmitAction={handleRescheduleLesson}
        currentLesson={selectedLesson}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onCloseAction={() => setIsCreateGroupOpen(false)}
        onSubmitAction={handleCreateGroup}
      />
    </div>
  )
}
