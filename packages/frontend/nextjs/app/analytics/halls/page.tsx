"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  SignOut,
  Clock,
  CalendarBlank,
  ChartBar,
  Download
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster, toast } from 'sonner'
import { API, handleApiError, isAuthenticated, logout } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface UserData {
  id: number
  name: string
  email: string
  role: string
  created_at?: string
}

interface HallAnalytics {
  id: number
  hallId: number
  hallName: string
  name: string
  capacity: number
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
  total: number
}

export default function HallAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [hallsData, setHallsData] = useState<HallAnalytics[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [activeHalls, setActiveHalls] = useState(0)
  const [avgLoad, setAvgLoad] = useState(0)
  const [peakDay, setPeakDay] = useState("")

  const handleLogout = () => {
    localStorage.removeItem("token")
    toast.success("Вы успешно вышли из системы")
    router.push("/login")
  }

  const downloadExcel = () => {
    toast.success("Загрузка Excel файла...")

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

        if (userData.user.role !== "admin") {
          setError("Доступ запрещен. Только для администраторов.")
          router.push("/")
          return
        }

        const data = await API.halls.getAnalytics()

        const halls: HallAnalytics[] = (data.halls || []).map((hall: any) => ({
          id: hall.hallId,
          hallId: hall.hallId,
          hallName: hall.hallName,
          name: hall.hallName,
          capacity: hall.capacity || 0,
          monday: hall.monday || 0,
          tuesday: hall.tuesday || 0,
          wednesday: hall.wednesday || 0,
          thursday: hall.thursday || 0,
          friday: hall.friday || 0,
          saturday: hall.saturday || 0,
          sunday: hall.sunday || 0,
          total: hall.total || 0,
        }))
        setHallsData(halls)

        const total = halls.reduce((sum, hall) => sum + hall.total, 0)
        setTotalHours(total)
        setActiveHalls(halls.length)

        const avg = halls.length > 0 ? total / halls.length : 0
        setAvgLoad(parseFloat(avg.toFixed(1)))

        const dayTotals = {
          Понедельник: halls.reduce((sum, h) => sum + h.monday, 0),
          Вторник: halls.reduce((sum, h) => sum + h.tuesday, 0),
          Среда: halls.reduce((sum, h) => sum + h.wednesday, 0),
          Четверг: halls.reduce((sum, h) => sum + h.thursday, 0),
          Пятница: halls.reduce((sum, h) => sum + h.friday, 0),
          Суббота: halls.reduce((sum, h) => sum + h.saturday, 0),
          Воскресенье: halls.reduce((sum, h) => sum + h.sunday, 0),
        }

        const peak = Object.entries(dayTotals).reduce((max, [day, hours]) =>
          hours > max.hours ? { day, hours } : max,
          { day: "", hours: 0 }
        )

        setPeakDay(peak.day)

        setLoading(false)
      } catch (err) {
        console.error("Ошибка загрузки данных:", err)
        handleApiError(err)
        setError(err instanceof Error ? err.message : "Произошла ошибка")
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Ошибка: {error}</p>
          <Button onClick={() => router.push("/")}>Вернуться на главную</Button>
        </div>
      </div>
    )
  }

  const profile = {
    name: user?.name || "Администратор",
    initials: user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : "АД",
    email: user?.email || "Не указано",
  }

  const dayColors = [
    "bg-orange-500",
    "bg-purple-500",
    "bg-blue-500",
  ]

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-6 z-50">
        <div className="mb-8">
          <h1 className="text-xl font-bold">Nomad Dance Academy</h1>
          <p className="text-sm text-gray-400">Админ панель</p>
        </div>

        <nav className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-gray-800 bg-gray-800"
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
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/schedule")}
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
            <Clock size={20} className="mr-3" />
            Ученики
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/groups")}
          >
            <Clock size={20} className="mr-3" />
            Группы
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/halls")}
          >
            <Clock size={20} className="mr-3" />
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Аналитика залов</h1>
              <p className="text-sm text-muted-foreground mt-1">Загрузка залов по дням недели</p>
            </div>
            <Button onClick={downloadExcel} variant="outline" className="gap-2">
              <Download size={16} />
              Экспорт в Excel
            </Button>
          </div>

          {}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-50">
                    <Clock size={22} className="text-blue-600" weight="duotone" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Всего часов</p>
                    <p className="text-2xl font-semibold mt-0.5">{totalHours}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-50">
                    <ChartBar size={22} className="text-green-600" weight="duotone" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Залов активно</p>
                    <p className="text-2xl font-semibold mt-0.5">{activeHalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-50">
                    <ChartBar size={22} className="text-purple-600" weight="duotone" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Средняя загрузка</p>
                    <p className="text-2xl font-semibold mt-0.5">{avgLoad}<span className="text-base font-normal text-muted-foreground ml-0.5">ч</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-orange-50">
                    <CalendarBlank size={22} className="text-orange-600" weight="duotone" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Пик загрузки</p>
                    <p className="text-2xl font-semibold mt-0.5">{peakDay || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {}
          <Card className="mb-6 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Загрузка залов по дням</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[140px]">Зал</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Пн</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Вт</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Ср</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Чт</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Пт</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Сб</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Вс</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Итого</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hallsData.map((hall, index) => (
                    <TableRow key={`table-${hall.id}`} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dayColors[index % dayColors.length]}`} />
                          {hall.hallName}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{hall.monday > 0 ? `${hall.monday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.tuesday > 0 ? `${hall.tuesday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.wednesday > 0 ? `${hall.wednesday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.thursday > 0 ? `${hall.thursday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.friday > 0 ? `${hall.friday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.saturday > 0 ? `${hall.saturday}ч` : "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{hall.sunday > 0 ? `${hall.sunday}ч` : "—"}</TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">{hall.total}ч</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Визуализация загрузки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {}
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-8 text-xs font-medium text-muted-foreground">{day}</div>
                    <div className="flex-1 flex gap-1 h-7 bg-muted/30 rounded-md overflow-hidden">
                      {hallsData.map((hall, hallIndex) => {
                        const hours = [
                          hall.monday,
                          hall.tuesday,
                          hall.wednesday,
                          hall.thursday,
                          hall.friday,
                          hall.saturday,
                          hall.sunday,
                        ][dayIndex] || 0

                        const maxHours = 12
                        const widthPercent = Math.min((hours / maxHours) * 100, 100)

                        if (hours === 0) return null

                        return (
                          <div
                            key={`${day}-${hall.id}`}
                            className={`h-full rounded-md ${dayColors[hallIndex % dayColors.length]} flex items-center justify-center transition-all`}
                            style={{ width: `${widthPercent}%`, minWidth: hours > 0 ? '32px' : '0' }}
                            title={`${hall.hallName}: ${hours}ч`}
                          >
                            {hours > 0 && (
                              <span className="text-xs font-medium text-white">{hours}ч</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {}
                <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
                  {hallsData.map((hall, index) => (
                    <div key={`legend-${hall.id}`} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${dayColors[index % dayColors.length]}`} />
                      <span className="text-sm font-medium text-muted-foreground">{hall.hallName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
