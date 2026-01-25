"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  MapPin,
  Plus,
  Tag
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { API, handleApiError, isAuthenticated } from "@/lib/api";
import CreateGroupModal from "@/components/create-group-modal";

interface Group {
  id: number;
  name: string;
  teacherName: string;
  schedule: string;
  hallName: string;
  hallId: number | null;
  studentLimit: number;
  studentCount: number;
  isActive: boolean;
  is_trial: boolean;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      const data = await API.groups.getAll();
      setGroups(data.groups || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Не удалось загрузить группы");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (groupData: any) => {
    try {
      await API.groups.create(groupData);
      toast.success("Группа успешно создана");
      setCreateGroupModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error("Error creating group:", error);
      handleApiError(error);
      toast.error("Не удалось создать группу");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
            <Calendar className="w-5 h-5 mr-3" />
            Аналитика залов
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/teachers")}
          >
            <Users className="w-5 h-5 mr-3" />
            Аналитика преподавателей
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/groups")}
          >
            <Users className="w-5 h-5 mr-3" />
            Аналитика групп
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/schedule")}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Расписание
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/applications")}
          >
            <Users className="w-5 h-5 mr-3" />
            Заявки
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/students")}
          >
            <Users className="w-5 h-5 mr-3" />
            Аналитика учеников
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-gray-800 bg-gray-800"
          >
            <Users className="w-5 h-5 mr-3" />
            Группы
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/categories")}
          >
            <Tag className="w-5 h-5 mr-3" />
            Категории
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/halls")}
          >
            <MapPin className="w-5 h-5 mr-3" />
            Залы
          </Button>
        </nav>
      </aside>

      {}
      <div className="ml-64">
        <main className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Группы</h2>
              <p className="text-gray-500 mt-1">Управление группами и списками</p>
            </div>
            <Button onClick={() => setCreateGroupModalOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Создать группу
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Загрузка групп...</p>
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-gray-500">Нет групп</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/groups/${group.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{group.name}</CardTitle>
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive ? "Группа открыта" : "Группа закрыта"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      <span>Преподаватель: {group.teacherName}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>Зал: {group.hallName}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Tag className="w-4 h-4 mr-2" />
                      <span>Тип:</span>
                      <Badge
                        variant={group.is_trial ? "default" : "secondary"}
                        className={`ml-2 ${group.is_trial ? "bg-purple-600" : ""}`}
                      >
                        {group.is_trial ? "Пробный" : "Обычный"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-gray-600">
                        Учеников: {group.studentCount}/{group.studentLimit}
                      </span>
                      <Badge variant="outline">
                        {Math.round((group.studentCount / group.studentLimit) * 100)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <CreateGroupModal
            isOpen={createGroupModalOpen}
            onCloseAction={() => setCreateGroupModalOpen(false)}
            onSubmitAction={handleCreateGroup}
          />
        </main>
      </div>
    </div>
  );
}