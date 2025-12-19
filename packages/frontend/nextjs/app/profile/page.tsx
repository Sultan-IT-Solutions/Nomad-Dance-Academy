"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, User, SignOut } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Envelope, Phone, Calendar, TrendUp, MapPin, Clock, CheckCircle, Warning, CalendarBlank, XCircle } from "@phosphor-icons/react"
import { Toaster, toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { API, handleApiError, isAuthenticated, logout } from "@/lib/api"

interface StudentData {
  id: number
  user_id: number
  parent_phone: string | null
  comment: string | null
  trial_used: boolean
  subscription_until: string | null
}

interface UserData {
  id: number
  name: string
  email: string
  role: string
  created_at?: string
}

interface GroupData {
  id: number
  name: string
  capacity: number
  start_time: string | null
  duration_minutes: number
  hall_id: number | null
  hall_name: string | null
  teacher_name: string | null
  enrolled: number
  teacher_ids: number[]
  free_slots: number | null
  recurring_days: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [groups, setGroups] = useState<GroupData[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])

  const handleLogout = () => {
    logout()
    toast.success("Вы успешно вышли из системы")
    router.push("/login")
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!isAuthenticated()) {
          localStorage.setItem("loginMessage", "Ваша сессия истекла, войдите в систему заново")
          router.push("/login")
          return
        }

        const userData = await API.users.me()
        setUser(userData.user)

        if (userData.user.role === 'student') {
          try {
            const studentData = await API.students.me()
            setStudent(studentData.student)
          } catch (err) {
            console.log("Could not fetch student data:", err)
          }

          try {
            const groupsData = await API.students.getMyGroups()
            setGroups(groupsData.groups || [])
          } catch (err) {
            console.log("Could not fetch groups:", err)
          }

          try {
            const attendanceInfo = await API.students.getMyAttendance()
            setAttendanceData(attendanceInfo.attendance || [])
          } catch (err) {
            console.log("Could not fetch attendance:", err)
          }
        }

        setLoading(false)
      } catch (err) {
        logout()
        localStorage.setItem("loginMessage", "Ваша сессия истекла, войдите в систему заново")
        router.push("/login")
      }
    }

    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Ошибка: {error}</p>
          <p className="text-sm text-muted-foreground">Убедитесь, что вы авторизованы и сервер запущен.</p>
        </div>
      </div>
    )
  }

  const profile = {
    name: user?.name || "Не указано",
    initials: user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : "НИ",
    status: user?.role === 'student' ? 'Ученик' : user?.role === 'teacher' ? 'Преподаватель' : user?.role === 'admin' ? 'Администратор' : 'Пользователь',
    email: user?.email || "Не указано",
    phone: student?.parent_phone || "Не указано",
    registrationDate: user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : "Не указано",
    groupCount: groups.length
  }


  const myGroups = groups.map(group => {

    let schedule = "Не указано";
    let dayOfWeek = "Не указано";
    let time = "Не указано";

    if (group.start_time) {
      try {
        const dt = new Date(group.start_time);
        time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });


        if (group.recurring_days) {
          dayOfWeek = group.recurring_days;
          schedule = `${dayOfWeek} ${time}`;
        } else {
          const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
          dayOfWeek = days[dt.getDay()];
          schedule = `${dayOfWeek} ${time}`;
        }
      } catch (e) {
        console.error('Error formatting date:', e);
      }
    }

    return {
      id: group.id,
      title: group.name || "Без названия",
      category: "Нет",
      badge: "Активно",
      instructor: group.teacher_name || "Не назначен",
      participants: [],
      location: schedule,
      day: group.hall_name || "Не указан",
      time: time
    };
  })


  const subscriptions = groups.slice(0, 3).map(group => {
    const used = group.enrolled || 0
    const total = group.capacity || 0
    const remaining = group.free_slots || 0

    return {
      id: group.id,
      title: group.name || "Без названия",
      category: "Нет",
      badge: "Активно",
      used: used,
      total: total,
      remaining: remaining,
      startDate: student?.subscription_until ? new Date(student.subscription_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : "Не указано",
      endDate: student?.subscription_until || "Не указано"
    }
  })


  const attendance = attendanceData.map(data => ({
    id: data.id,
    title: data.groupName || "Без названия",
    category: "Нет",
    attended: data.present + data.excused,
    excused: data.excused,
    missed: data.absent,
    late: data.late,
    total: data.total,
    percentage: data.percentage,
    points: data.points,
    maxPoints: data.maxPoints
  }))

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
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
              <Button
                variant="ghost"
                className="text-foreground/70 hover:text-foreground text-sm"
                onClick={() => router.push("/schedule")}
              >
                Расписание групп
              </Button>
              <Button
                variant="ghost"
                className="text-foreground/70 hover:text-foreground text-sm"
                onClick={() => router.push("/my-groups")}
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
              <Button className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-sm rounded-lg px-6">
                Профиль
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B35] rounded-full"></span>
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
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">Мой профиль</h1>
          <p className="text-sm text-primary">Личная информация и статистика</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 lg:col-span-1 border-0 shadow-sm bg-card/80">
            <h2 className="text-base font-semibold mb-6 text-foreground">Личные данные</h2>

            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-28 w-28 mb-4">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-3xl font-bold">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{profile.name}</h3>
              <Badge className="bg-primary/10 text-primary border-0 font-medium">{profile.status}</Badge>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Envelope size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">Email</div>
                  <div className="text-sm text-foreground break-all">{profile.email}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-0.5">Телефон</div>
                  <div className="text-sm text-foreground">{profile.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-0.5">Дата регистрации</div>
                  <div className="text-sm text-foreground">{profile.registrationDate}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendUp size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-0.5">Групп</div>
                  <div className="text-sm text-foreground">{profile.groupCount}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2 border-0 shadow-sm bg-card/80">
            <h2 className="text-base font-semibold mb-6 text-foreground">Мои группы и преподаватели</h2>

            <div className="space-y-4">
              {myGroups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Нет доступных групп</p>
              ) : (
                myGroups.map((group) => (
                <div key={group.id} className="bg-primary/5 rounded-xl p-5 border border-primary/10 hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-base mb-1 text-foreground">{group.title}</h3>
                      <p className="text-sm text-primary">{group.category}</p>
                    </div>
                    <Badge className="bg-primary text-white border-0 text-xs font-medium px-3">{group.badge}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <User size={16} className="text-primary" weight="duotone" />
                        <span className="text-muted-foreground text-xs">Преподаватель:</span>
                      </div>
                      <div className="font-medium text-foreground">{group.instructor}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar size={16} className="text-primary" weight="duotone" />
                        <span className="text-muted-foreground text-xs">Расписание:</span>
                      </div>
                      <div className="font-medium text-foreground">Зал {group.day}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <MapPin size={16} className="text-primary" weight="duotone" />
                        <span className="text-muted-foreground text-xs">Дни:</span>
                      </div>
                      <div className="font-medium text-foreground">{group.location}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock size={16} className="text-primary" weight="duotone" />
                        <span className="text-muted-foreground text-xs">Время:</span>
                      </div>
                      <div className="font-medium text-foreground">{group.time}</div>
                    </div>
                  </div>

                  {group.participants.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-2">Участники:</div>
                      <div className="flex flex-wrap gap-2">
                        {group.participants.map((participant, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {participant}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8 border-0 shadow-sm bg-card/80">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar size={20} className="text-primary" weight="duotone" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Мои абонементы</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subscriptions.length === 0 ? (
              <div className="col-span-3 text-center text-muted-foreground py-8">Нет активных абонементов</div>
            ) : (
              subscriptions.map((sub) => (
              <div key={sub.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-1 text-foreground">{sub.title}</h3>
                    <p className="text-sm text-muted-foreground">{sub.category}</p>
                  </div>
                  <Badge className="bg-success/20 text-success border-0 text-xs font-medium">{sub.badge}</Badge>
                </div>

                <div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground">Использовано</span>
                    <span className="font-semibold text-foreground">{sub.used} из {sub.total}</span>
                  </div>
                  <Progress value={(sub.used / sub.total) * 100} className="h-2 bg-primary/10" />
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-xl p-5 text-center shadow-lg">
                  <div className="text-xs mb-1 opacity-90">Доступно занятий</div>
                  <div className="text-4xl font-bold">{sub.remaining}</div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Начало: {sub.startDate}</div>
                  <div>Окончание: {sub.endDate}</div>
                </div>
              </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm bg-card/80">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle size={20} className="text-primary" weight="duotone" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Моя посещаемость</h2>
          </div>

          <div className="space-y-8">
            {attendance.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Нет данных о посещаемости</div>
            ) : (
              attendance.map((item) => (
              <div key={item.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold mb-1 text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Посещаемость</div>
                    <div className="text-2xl font-bold text-primary">{item.percentage}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={18} weight="fill" className="text-green-600" />
                      <span className="text-xs font-medium text-green-700">Присутствовал (P)</span>
                    </div>
                    <div className="text-3xl font-bold text-green-700">{item.attended}</div>
                    <div className="text-xs text-green-600 mt-1">2/2 балла</div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Warning size={18} weight="fill" className="text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700">Опоздал (L)</span>
                    </div>
                    <div className="text-3xl font-bold text-yellow-700">{item.late || 0}</div>
                    <div className="text-xs text-yellow-600 mt-1">1/2 балла</div>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarBlank size={18} weight="fill" className="text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Уваж. причина (E)</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-700">{item.excused || 0}</div>
                    <div className="text-xs text-blue-600 mt-1">2/2 балла</div>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle size={18} weight="fill" className="text-red-600" />
                      <span className="text-xs font-medium text-red-700">Отсутствовал (A)</span>
                    </div>
                    <div className="text-3xl font-bold text-red-700">{item.missed || 0}</div>
                    <div className="text-xs text-red-600 mt-1">0/2 балла</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground">Набранные баллы</span>
                    <span className="font-bold text-primary">{item.points?.toFixed(1)} / {item.maxPoints?.toFixed(1)}</span>
                  </div>
                  <Progress value={(item.points / item.maxPoints) * 100} className="h-2.5 bg-primary/10" />
                </div>

                <div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground">Прогресс посещаемости</span>
                    <span className="font-semibold text-foreground">{item.attended} / {item.total} занятий</span>
                  </div>
                  <Progress value={item.percentage} className="h-2.5 bg-primary/10" />
                </div>
              </div>
              ))
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
