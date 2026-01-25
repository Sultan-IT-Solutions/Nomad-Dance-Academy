"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { API, handleApiError } from "@/lib/api"
import { Bell, Calendar, AlertCircle, Zap, Clock, Loader } from "lucide-react"

interface Notification {
  id: number
  type: string
  group_id: number | null
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setError("Требуется аутентификация")
      setIsLoading(false)
      return
    }

    fetchNotifications(token)
  }, [])

  const fetchNotifications = async (token: string) => {
    try {
      setIsLoading(true);

      setNotifications([]);
    } catch (err) {
      console.error("[v0] Error fetching notifications:", err);
      handleApiError(err);
      setError(err instanceof Error ? err.message : "Ошибка при загрузке данных");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {

    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "group_rescheduled":
        return { icon: <Calendar className="w-6 h-6 text-orange-600" />, bg: "bg-orange-100" }
      case "group_cancelled":
        return { icon: <AlertCircle className="w-6 h-6 text-red-600" />, bg: "bg-red-100" }
      case "group_scheduled":
        return { icon: <Zap className="w-6 h-6 text-green-600" />, bg: "bg-green-100" }
      default:
        return { icon: <Bell className="w-6 h-6 text-blue-600" />, bg: "bg-blue-100" }
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return dateString
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {}
          <div className="flex gap-6 items-center">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Главная
            </Link>
            <Link href="/groups" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Расписание групп
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Профиль
            </Link>
          </div>

          {}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              АК
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Уведомления</h1>
          <p className="text-gray-600 text-sm">
            {unreadCount} непрочитанный сообщен{unreadCount === 1 ? "ие" : "ия"}
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm font-medium">Ошибка: {error}</p>
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Нет уведомлений</p>
          </div>
        )}

        {!isLoading && !error && notifications.length > 0 && (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const { icon, bg } = getNotificationIcon(notification.type)
              return (
                <div
                  key={notification.id}
                  className={`flex gap-4 p-6 rounded-xl border transition ${
                    notification.is_read ? "bg-white border-gray-200" : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className={`flex-shrink-0 w-12 h-12 ${bg} rounded-full flex items-center justify-center`}>
                    {icon}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-gray-700 leading-relaxed">{notification.title}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                            {notification.type}
                          </span>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                      </div>
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-purple-600 hover:text-purple-700 text-xs font-medium whitespace-nowrap ml-4"
                        >
                          ✓ Отметить как прочитанное
                        </button>
                      )}
                    </div>
                  </div>

                  {!notification.is_read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
