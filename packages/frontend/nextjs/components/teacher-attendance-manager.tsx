"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pencil } from "@phosphor-icons/react"
import { Calendar, Clock } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format, parse } from "date-fns"
import { ru } from "date-fns/locale"

interface Lesson {
  id: number
  class_name: string
  start_time: string
  duration_minutes: number
  hall_name: string | null
  teacher_name: string | null
  total_students: number
  present_count: number
  excused_count: number
  late_count: number
  absent_count: number
}

interface Student {
  id: number
  name: string
  email: string
  status: string | null
  recorded_at: string | null
}

interface TeacherAttendanceManagerProps {
  groupId: number
}

export default function TeacherAttendanceManager({ groupId }: TeacherAttendanceManagerProps) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceData, setAttendanceData] = useState<{[key: number]: string}>({})
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [editForm, setEditForm] = useState({
    class_name: ''
  })
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: '',
    new_time: '',
    reason: ''
  })

  const fetchLessons = async () => {
    try {
      const response = await fetch(`http://localhost:8000/admin/groups/${groupId}/lessons-attendance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      setLessons(data.lessons || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching lessons:', err)
      setLoading(false)
    }
  }

  const fetchLessonAttendance = async (lessonId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/admin/groups/${groupId}/lessons/${lessonId}/attendance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      setStudents(data.students || [])

      const initialAttendance: {[key: number]: string} = {}
      data.students?.forEach((student: Student) => {
        initialAttendance[student.id] = student.status || ''
      })
      setAttendanceData(initialAttendance)
    } catch (err) {
      console.error('Error fetching lesson attendance:', err)
    }
  }

  const handleMarkAttendance = async (lesson: Lesson) => {
    setSelectedLesson(lesson)
    await fetchLessonAttendance(lesson.id)
    setShowAttendanceModal(true)
  }

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setEditForm({
      class_name: lesson.class_name
    })
    setShowEditModal(true)
  }

  const handleRescheduleLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setRescheduleForm({
      new_date: '',
      new_time: '',
      reason: ''
    })
    setShowRescheduleModal(true)
  }

  const handleSaveAttendance = async () => {
    try {
      const attendance = Object.entries(attendanceData)
        .filter(([, status]) => status)
        .map(([studentId, status]) => ({
          student_id: parseInt(studentId),
          status
        }))

      const response = await fetch(`http://localhost:8000/admin/groups/${groupId}/lessons/${selectedLesson?.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ attendance })
      })

      if (response.ok) {
        toast.success('Посещаемость сохранена')
        setShowAttendanceModal(false)
        fetchLessons()
      } else {
        toast.error('Ошибка при сохранении посещаемости')
      }
    } catch (err) {
      console.error('Error saving attendance:', err)
      toast.error('Ошибка при сохранении посещаемости')
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedLesson) return

    try {
      const response = await fetch(`http://localhost:8000/admin/lessons/${selectedLesson.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          class_name: editForm.class_name
        })
      })

      if (response.ok) {
        toast.success('Название занятия обновлено')
        setShowEditModal(false)
        fetchLessons()
      } else {
        toast.error('Ошибка при обновлении названия')
      }
    } catch (err) {
      console.error('Error updating lesson:', err)
      toast.error('Ошибка при обновлении названия')
    }
  }

  const handleSubmitReschedule = async () => {
    if (!selectedLesson || !rescheduleForm.new_date || !rescheduleForm.new_time || !rescheduleForm.reason.trim()) {
      toast.error('Пожалуйста, заполните все поля')
      return
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(rescheduleForm.new_time)) {
      toast.error('Пожалуйста, введите время в формате ЧЧ:ММ (например, 14:30)')
      return
    }

    try {

      const [day, month, year] = rescheduleForm.new_date.split('/')
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

      const response = await fetch(`http://localhost:8000/admin/lessons/${selectedLesson.id}/reschedule-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          new_date: formattedDate,
          new_time: rescheduleForm.new_time,
          reason: rescheduleForm.reason
        })
      })

      if (response.ok) {
        toast.success('Запрос на перенос отправлен администратору')
        setShowRescheduleModal(false)
        setRescheduleForm({ new_date: '', new_time: '', reason: '' })
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Ошибка при отправке запроса')
      }
    } catch (err) {
      console.error('Error submitting reschedule request:', err)
      toast.error('Ошибка при отправке запроса')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'P': return 'bg-green-100 text-green-800'
      case 'E': return 'bg-blue-100 text-blue-800'
      case 'L': return 'bg-yellow-100 text-yellow-800'
      case 'A': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'P': return 'Присутствовал'
      case 'E': return 'Уваж. причина'
      case 'L': return 'Опоздал'
      case 'A': return 'Отсутствовал'
      default: return 'Не отмечено'
    }
  }

  useEffect(() => {
    fetchLessons()
  }, [groupId])

  if (loading) {
    return <div>Загрузка занятий...</div>
  }

  return (
    <div className="space-y-6">
      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Play size={24} className="text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">Нет созданных занятий</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Занятия, созданные администраторами, будут отображаться здесь
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const startDate = new Date(lesson.start_time)
            const endDate = new Date(startDate.getTime() + lesson.duration_minutes * 60000)

            return (
              <div key={lesson.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">{lesson.class_name}</h3>
                      <button
                        onClick={() => handleEditLesson(lesson)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Редактировать название"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>
                          {startDate.toLocaleDateString('ru-RU', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                      onClick={() => handleMarkAttendance(lesson)}
                    >
                      <Play size={16} className="mr-2" />
                      Отметить посещаемость
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2"
                      onClick={() => handleRescheduleLesson(lesson)}
                    >
                      <Calendar size={16} className="mr-2" />
                      Перенести
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden">
          <DialogHeader className="pb-6 border-b">
            <DialogTitle className="text-xl font-semibold">
              Отметить посещаемость - {selectedLesson?.class_name}
            </DialogTitle>
            <div className="text-sm text-gray-600 mt-1">
              {selectedLesson && (
                <>
                  {new Date(selectedLesson.start_time).toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}, {new Date(selectedLesson.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
            </div>
          </DialogHeader>

          <div className="py-6">
            {}
            <div className="grid grid-cols-3 gap-6 pb-4 mb-6 border-b">
              <div className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                Студент
              </div>
              <div className="text-sm font-medium text-gray-700 uppercase tracking-wider text-center">
                Текущий статус
              </div>
              <div className="text-sm font-medium text-gray-700 uppercase tracking-wider text-center">
                Отметить посещаемость
              </div>
            </div>

            {}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {students.map((student) => (
                <div key={student.id} className="grid grid-cols-3 gap-6 items-center py-4 border-b border-gray-100 last:border-b-0">
                  {}
                  <div className="flex flex-col">
                    <div className="font-medium text-gray-900 text-base">{student.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{student.email}</div>
                  </div>

                  {}
                  <div className="flex justify-center">
                    <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium border ${
                      attendanceData[student.id] === 'P' ? 'bg-green-50 text-green-700 border-green-200' :
                      attendanceData[student.id] === 'E' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      attendanceData[student.id] === 'L' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      attendanceData[student.id] === 'A' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {attendanceData[student.id] === 'P' ? 'Присутствовал' :
                       attendanceData[student.id] === 'E' ? 'Уваж. причина' :
                       attendanceData[student.id] === 'L' ? 'Опоздал' :
                       attendanceData[student.id] === 'A' ? 'Отсутствовал' :
                       'Не отмечено'}
                    </span>
                  </div>

                  {}
                  <div className="flex justify-center gap-2">
                    {[
                      { status: 'P', label: 'Присутствовал' },
                      { status: 'E', label: 'Уваж. причина' },
                      { status: 'L', label: 'Опоздал' },
                      { status: 'A', label: 'Отсутствовал' }
                    ].map(({ status, label }) => (
                      <button
                        key={status}
                        className={`w-12 h-12 rounded-xl font-semibold text-base border-2 transition-all duration-200 ${
                          attendanceData[student.id] === status
                            ? status === 'P' ? 'bg-green-600 text-white border-green-600 shadow-md' :
                              status === 'E' ? 'bg-blue-600 text-white border-blue-600 shadow-md' :
                              status === 'L' ? 'bg-yellow-600 text-white border-yellow-600 shadow-md' :
                              'bg-red-600 text-white border-red-600 shadow-md'
                            : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                        }`}
                        onClick={() => setAttendanceData(prev => ({
                          ...prev,
                          [student.id]: attendanceData[student.id] === status ? '' : status
                        }))}
                        title={label}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t bg-white">
            <div className="text-sm text-gray-600">
              {Object.values(attendanceData).filter(status => status).length} из {students.length} студентов отмечено
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAttendanceModal(false)}
                className="px-8 py-2 text-base"
                size="lg"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSaveAttendance}
                className="px-8 py-2 text-base bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                Сохранить посещаемость
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">Редактировать название занятия</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Название занятия</Label>
              <Input
                value={editForm.class_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, class_name: e.target.value }))}
                className="w-full"
                placeholder="Введите название занятия"
              />
            </div>
            <div className="text-xs text-gray-500">
              Примечание: Преподаватели могут изменять только название занятия. Время и дата изменяются администратором.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="px-6"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="px-6 bg-blue-600 hover:bg-blue-700"
              disabled={!editForm.class_name.trim()}
            >
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              📅 Перенос урока
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {selectedLesson && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-xs">ℹ</span>
                  Текущее время:
                </div>
                <div className="text-gray-900 font-medium text-lg">
                  {new Date(selectedLesson.start_time).toLocaleDateString('en-GB')} -
                  {new Date(selectedLesson.start_time).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                  {selectedLesson.duration_minutes && (
                    <span className="text-gray-500 text-base ml-2">({selectedLesson.duration_minutes} мин)</span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Новая дата <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-11 justify-start text-left font-normal border-gray-300 hover:border-blue-500"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {rescheduleForm.new_date ? (
                      rescheduleForm.new_date
                    ) : (
                      <span className="text-gray-500">Выберите дату</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={rescheduleForm.new_date ? parse(rescheduleForm.new_date, "dd/MM/yyyy", new Date()) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const formattedDate = format(date, "dd/MM/yyyy")
                        setRescheduleForm(prev => ({ ...prev, new_date: formattedDate }))
                      }
                    }}
                    locale={ru}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Новое время начала <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={rescheduleForm.new_time.split(':')[0] || ''}
                    onValueChange={(hours) => {
                      const currentMinutes = rescheduleForm.new_time.split(':')[1] || '00'
                      setRescheduleForm(prev => ({ ...prev, new_time: `${hours}:${currentMinutes}` }))
                    }}
                  >
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500">
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Часы" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-center text-xl font-medium text-gray-500">
                  :
                </div>
                <div className="flex-1">
                  <Select
                    value={rescheduleForm.new_time.split(':')[1] || ''}
                    onValueChange={(minutes) => {
                      const currentHours = rescheduleForm.new_time.split(':')[0] || '00'
                      setRescheduleForm(prev => ({ ...prev, new_time: `${currentHours}:${minutes}` }))
                    }}
                  >
                    <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500">
                      <SelectValue placeholder="Мин" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 60 }, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>
                          {String(i).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {rescheduleForm.new_time && rescheduleForm.new_time.includes(':') && selectedLesson?.duration_minutes && (
                <div className="text-sm text-gray-600">
                  Урок закончится в {(() => {
                    const [hours, minutes] = rescheduleForm.new_time.split(':').map(Number)
                    if (isNaN(hours) || isNaN(minutes)) return '--:--'
                    const startMinutes = hours * 60 + minutes
                    const endMinutes = startMinutes + selectedLesson.duration_minutes
                    const endHours = Math.floor(endMinutes / 60) % 24
                    const endMins = endMinutes % 60
                    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900">
                Причина переноса <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={rescheduleForm.reason}
                onChange={(e) => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full h-24 resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Укажите причину переноса урока..."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <div className="text-sm text-blue-800">
                  Запрос будет отправлен администратору на рассмотрение. Вы получите уведомление о решении.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setShowRescheduleModal(false)}
              className="px-8 py-2 h-10 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmitReschedule}
              className="px-8 py-2 h-10 bg-black hover:bg-gray-800 text-white"
              disabled={!rescheduleForm.new_date || !rescheduleForm.new_time || !rescheduleForm.reason.trim()}
            >
              Отправить запрос
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}