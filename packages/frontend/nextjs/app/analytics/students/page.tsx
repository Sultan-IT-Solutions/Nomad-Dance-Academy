"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeWithGMT5 } from "@/lib/utils";
import { API, handleApiError } from "@/lib/api";
import { Bell, Users, TrendUp, Calendar } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StudentGroup {
  groupName: string;
  teacher: string;
  schedule: string;
  attendance: number;
  hall: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  parentPhone: string;
  groups: StudentGroup[];
  lessonsRemaining: number;
  subscriptionUntil: string | null;
  isActive: boolean;
  registeredAt: string;
}

interface Notification {
  id: number;
  type: "new_student" | "group_enrollment";
  studentName: string;
  email?: string;
  phone?: string;
  groupInfo?: string;
  timestamp: string;
  isRead: boolean;
}

interface Stats {
  totalStudents: number;
  activeStudents: number;
  newThisMonth: number;
  avgAttendance: number;
}

export default function StudentsAnalyticsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    activeStudents: 0,
    newThisMonth: 0,
    avgAttendance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userRes = await API.users.me();

      if (userRes.user.role !== "admin") {
        localStorage.setItem("loginMessage", "У вас нет доступа к этой странице")
        router.push("/login")
        return
      }

      const studentsData = await API.admin.getStudentsAnalytics();

      setStudents(studentsData.students || []);
      setStats(studentsData.stats || stats);
      setNotifications(studentsData.notifications || []);
      setUnreadCount(studentsData.notifications?.filter((n: Notification) => !n.isRead).length || 0);
    } catch (error) {
      console.error("Failed to fetch students data:", error);
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      console.log('Marking notification as read:', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      handleApiError(error);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };


  const sortedStudents = [...students].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "ru");
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
            onClick={() => window.location.href = '/analytics/halls'}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Аналитика залов
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/analytics/teachers'}
          >
            <Users className="w-5 h-5 mr-3" />
            Аналитика преподавателей
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/analytics/groups'}
          >
            <TrendUp className="w-5 h-5 mr-3" />
            Аналитика групп
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/analytics/schedule'}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Расписание
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/analytics/applications'}
          >
            <Bell className="w-5 h-5 mr-3" />
            Заявки
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-gray-800 bg-gray-800"
          >
            <Users className="w-5 h-5 mr-3" />
            Ученики
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/groups'}
          >
            <Users className="w-5 h-5 mr-3" />
            Группы
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => window.location.href = '/halls'}
          >
            <Users className="w-5 h-5 mr-3" />
            Залы
          </Button>
        </nav>
      </aside>

      {}
      <div className="ml-64">
        <main className="p-8">
          {}
          <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Ученики</h2>
            <p className="text-gray-500 mt-1">Информация обо всех учениках</p>
          </div>

          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Уведомления</SheetTitle>
                  <SheetDescription>
                    Новые ученики и записи на занятия
                  </SheetDescription>
                </SheetHeader>
                {notifications.length > 0 && unreadCount > 0 && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log('Marking all notifications as read');
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                        setUnreadCount(0);
                      }}
                    >
                      Отметить все как прочитанные
                    </Button>
                  </div>
                )}
                <ScrollArea className="h-[calc(100vh-180px)] mt-4">
                  <div className="space-y-4">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        Нет уведомлений
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 rounded-lg border relative ${
                            notification.isRead ? "bg-white" : "bg-blue-50 border-blue-200"
                          }`}
                        >
                          {notification.type === "new_student" ? (
                            <div>
                              <p className="font-semibold text-sm">
                                Новый зарегистрированный ученик
                              </p>
                              <p className="text-sm mt-1">{notification.studentName}</p>
                              {notification.email && (
                                <p className="text-xs text-gray-600 mt-1">
                                  📧 {notification.email}
                                </p>
                              )}
                              {notification.phone && (
                                <p className="text-xs text-gray-600">
                                  📱 {notification.phone}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-2">
                                {formatDateTimeWithGMT5(notification.timestamp)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-sm">
                                Новая запись на группу
                              </p>
                              <p className="text-sm mt-1">
                                {notification.studentName} записался на {notification.groupInfo}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {formatDateTimeWithGMT5(notification.timestamp)}
                              </p>
                            </div>
                          )}
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationAsRead(notification.id);
                              }}
                            >
                              Отметить как прочитанное
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Всего учеников
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Активных учеников
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendUp className="w-5 h-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Новых за месяц
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.newThisMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Средняя посещаемость
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgAttendance}%</div>
            </CardContent>
          </Card>
        </div>

        {}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">Загрузка...</p>
              </CardContent>
            </Card>
          ) : sortedStudents.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">Нет учеников</p>
              </CardContent>
            </Card>
          ) : (
            sortedStudents.map((student) => (
              <Card key={student.id} className={!student.isActive ? "opacity-60" : ""}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-purple-100 text-purple-700 text-lg">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{student.name}</h3>
                        {!student.isActive && (
                          <Badge variant="secondary">Не активен</Badge>
                        )}
                      </div>

                      {}
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 text-sm">
                        <div>
                          <span className="text-gray-500">Email:</span>{" "}
                          <span className="text-gray-900">{student.email}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Телефон:</span>{" "}
                          <span className="text-gray-900">{student.parentPhone}</span>
                        </div>
                      </div>

                      {}
                      {student.groups.length > 0 ? (
                        <div className="space-y-3 mb-4">
                          {student.groups.map((group, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{group.groupName}</p>
                                  <p className="text-sm text-gray-600">
                                    Преподаватель: {group.teacher}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {group.schedule} • {group.hall}
                                  </p>
                                </div>
                                <Badge variant="outline" className="ml-2">
                                  {group.attendance}% посещаемость
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-4">Не записан в группы</p>
                      )}

                      {}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">
                            Осталось занятий: <span className="font-semibold">{student.lessonsRemaining}</span>
                          </span>
                        </div>
                        {student.subscriptionUntil && (
                          <div>
                            <span className="text-gray-600">
                              Абонемент до: <span className="font-semibold">
                                {new Date(student.subscriptionUntil).toLocaleDateString("ru")}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
