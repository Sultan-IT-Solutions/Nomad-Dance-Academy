"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { convertTimeToGMT5ISO } from "@/lib/utils";
import {
  Users,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash,
  X,
  LockOpen
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

interface GroupDetails {
  id: number;
  name: string;
  teacherId: number | null;
  teacherName: string;
  schedule: string;
  hallName: string;
  hallId: number | null;
  studentLimit: number;
  isActive: boolean;
  schedules?: Record<string, string>;
  startTime?: string;
  recurringUntil?: string;
  students: {
    id: number;
    name: string;
    email: string;
    phone: string;
    attendanceCount: number;
  }[];
}

interface Student {
  id: number;
  name: string;
  email: string;
}

interface Hall {
  id: number;
  name: string;
}

interface Teacher {
  id: number;
  name: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [editHallDialogOpen, setEditHallDialogOpen] = useState(false);
  const [editDetailsDialogOpen, setEditDetailsDialogOpen] = useState(false);
  const [closeGroupDialogOpen, setCloseGroupDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allHalls, setAllHalls] = useState<Hall[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(0);
  const [editScheduleDate, setEditScheduleDate] = useState<string>("");
  const [editScheduleTime, setEditScheduleTime] = useState<string>("");
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(false);
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [repeatUntilDate, setRepeatUntilDate] = useState<string>("");
  const [scheduleStartDate, setScheduleStartDate] = useState<string>("");
  const [multipleTimesEnabled, setMultipleTimesEnabled] = useState<boolean>(false);
  const [dayTimeSchedule, setDayTimeSchedule] = useState<Record<string, string>>({});
  const [tempTimeSelection, setTempTimeSelection] = useState<Record<string, { hour: string; minute: string }>>({});
  const [teacherSchedules, setTeacherSchedules] = useState<any[]>([]);
  const [loadingTeacherSchedules, setLoadingTeacherSchedules] = useState<boolean>(false);
  const [deleteScheduleDialog, setDeleteScheduleDialog] = useState<{
    open: boolean;
    groupId: number | null;
    teacherId: number | null;
    groupName: string;
  }>({ open: false, groupId: null, teacherId: null, groupName: "" });


  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

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

  const fetchGroupDetails = async (groupId: number) => {
    try {
      const data = await API.groups.getById(groupId);
      setSelectedGroup(data);
      setDialogOpen(true);
    } catch (error) {
      console.error("Error fetching group details:", error);
      toast.error("Не удалось загрузить детали группы");
    }
  };

  const removeStudent = async (groupId: number, studentId: number) => {
    try {
      await API.admin.removeStudentFromGroup(groupId, studentId);
      toast.success("Ученик удален из группы");
      fetchGroupDetails(groupId);
      fetchGroups();
    } catch (error) {
      console.error("Error removing student:", error);
      toast.error("Не удалось удалить ученика");
    }
  };

  const closeGroup = async (groupId: number) => {
    try {
      await API.groups.update(groupId, { is_closed: true });
      toast.success("Группа закрыта");
      setDialogOpen(false);
      setCloseGroupDialogOpen(false);
      fetchGroups();
    } catch (error) {
      console.error("Error closing group:", error);
      toast.error("Не удалось закрыть группу");
    }
  };

  const openGroup = async (groupId: number) => {
    try {
      await API.groups.update(groupId, { is_closed: false });
      toast.success("Группа открыта");
      setDialogOpen(false);
      setCloseGroupDialogOpen(false);
      fetchGroups();
    } catch (error) {
      console.error("Error opening group:", error);
      toast.error("Не удалось открыть группу");
    }
  };

  const deleteGroup = async (groupId: number) => {
    try {
      await API.groups.delete(groupId);
      toast.success("Группа удалена");
      setDialogOpen(false);
      setDeleteGroupDialogOpen(false);
      fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      handleApiError(error);
      toast.error("Не удалось удалить группу");
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

  const fetchAllStudents = async () => {
    try {
      const data = await API.students.getAll();
      setAllStudents(data.students || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Не удалось загрузить список учеников");
    }
  };

  const fetchAllHalls = async () => {
    try {
      const data = await API.halls.getAll();
      setAllHalls(data.halls || []);
    } catch (error) {
      console.error("Error fetching halls:", error);
      toast.error("Не удалось загрузить список залов");
    }
  };

  const openAddStudentDialog = () => {
    fetchAllStudents();
    setAddStudentDialogOpen(true);
  };

  const openEditHallDialog = () => {
    fetchAllHalls();
    setSelectedHallId(selectedGroup?.hallId || null);
    setEditHallDialogOpen(true);
  };

  const fetchAllTeachers = async () => {
    try {
      const data = await API.teachers.getAll();
      setAllTeachers(data.teachers || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("Не удалось загрузить список преподавателей");
    }
  };

  const fetchTeacherSchedules = async (teacherId: number) => {
    if (!teacherId) {
      setTeacherSchedules([]);
      return;
    }

    setLoadingTeacherSchedules(true);
    try {
      const data = await API.teachers.getGroups(teacherId);
      setTeacherSchedules(data.schedules || []);
    } catch (error) {
      console.error("Error fetching teacher schedules:", error);
      setTeacherSchedules([]);
    } finally {
      setLoadingTeacherSchedules(false);
    }
  };

  const deleteTeacherSchedule = async (groupId: number, teacherId: number) => {
    try {
      const updateData = {
        main_teacher_id: 0
      };
      console.log("Sending update:", updateData);
      await API.groups.update(groupId, updateData);

      toast.success("Преподаватель удален из группы");
      fetchTeacherSchedules(teacherId);
      fetchGroups();
    } catch (error) {
      console.error("Error removing teacher from group:", error);
      toast.error("Не удалось удалить преподавателя из группы");
    }
  };

  const openEditDetailsDialog = () => {
    if (!selectedGroup) return;

    fetchAllTeachers();
    setEditCapacity(selectedGroup.studentLimit);


    if (selectedGroup.teacherId) {
      setSelectedTeacherId(selectedGroup.teacherId);
      fetchTeacherSchedules(selectedGroup.teacherId);
    } else {
      setSelectedTeacherId(null);
      setTeacherSchedules([]);
    }

    if (selectedGroup.schedules && Object.keys(selectedGroup.schedules).length > 0) {
      console.log('Loading schedules from SQL:', selectedGroup.schedules);
      setDayTimeSchedule(selectedGroup.schedules);
      setMultipleTimesEnabled(true);
    } else {
      setMultipleTimesEnabled(false);
      setDayTimeSchedule({});
    }

    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];
    setEditScheduleDate(defaultDate);
    setScheduleStartDate(selectedGroup.startTime || '');
    setRepeatEnabled(false);
    setRepeatDays([]);
    setRepeatUntilDate(selectedGroup.recurringUntil || "");
    setEditScheduleTime("");

    setEditDetailsDialogOpen(true);
  };

  const saveGroupDetails = async () => {
    if (!selectedGroup) return;

    try {
      const updates: any = {
        capacity: editCapacity,
      };

      if (selectedTeacherId !== null) {
        updates.main_teacher_id = selectedTeacherId;
      }

      if (scheduleStartDate) {
        updates.start_time = scheduleStartDate;
      }
      if (repeatUntilDate) {
        updates.recurring_until = repeatUntilDate;
      }

      updates.schedules = dayTimeSchedule;

      await API.groups.update(selectedGroup.id, updates);

      toast.success("Данные группы обновлены");
      setEditDetailsDialogOpen(false);
      setSelectedTeacherId(null);
      setTeacherSchedules([]);
      setRepeatUntilDate("");
      setScheduleStartDate("");
      setDayTimeSchedule({});
      fetchGroupDetails(selectedGroup.id);
      fetchGroups();
    } catch (error) {
      console.error("Error updating group:", error);
      toast.error("Не удалось обновить данные группы");
    }
  };

  const addStudentToGroup = async () => {
    if (!selectedGroup || !selectedStudentId) return;

    try {
      await API.admin.addStudentToGroup(selectedGroup.id, selectedStudentId);
      toast.success("Ученик добавлен в группу");
      setAddStudentDialogOpen(false);
      setSelectedStudentId(null);
      fetchGroupDetails(selectedGroup.id);
      fetchGroups();
    } catch (error: any) {
      console.error("Error adding student:", error);
      toast.error(handleApiError(error));
    }
  };

  const assignHallToGroup = async () => {
    if (!selectedGroup || selectedHallId === null) return;

    try {
      await API.groups.update(selectedGroup.id, { hall_id: selectedHallId });
      toast.success("Зал назначен группе");
      setEditHallDialogOpen(false);
      fetchGroupDetails(selectedGroup.id);
      fetchGroups();
    } catch (error) {
      console.error("Error assigning hall:", error);
      toast.error("Не удалось назначить зал");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
            <Clock className="w-5 h-5 mr-3" />
            Заявки
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => router.push("/analytics/students")}
          >
            <Users className="w-5 h-5 mr-3" />
            Ученики
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
                  onClick={() => fetchGroupDetails(group.id)}
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
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Расписание: {group.schedule}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>Зал: {group.hallName}</span>
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

          {}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              {selectedGroup && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl">{selectedGroup.name}</DialogTitle>
                    <DialogDescription>
                      Информация о группе, можно добавить, удалить учеников, закрыть группу
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant={selectedGroup.isActive ? "default" : "secondary"} className="text-base px-3 py-1">
                        {selectedGroup.isActive ? "Группа открыта" : "Группа закрыта"}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Информация о группе</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openEditDetailsDialog}
                      >
                        Редактировать
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Преподаватель</p>
                        <p className="font-medium">{selectedGroup.teacherName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Расписание</p>
                        <p className="font-medium">{selectedGroup.schedule}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Зал</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{selectedGroup.hallName}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={openEditHallDialog}
                          >
                            Изменить
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Вместимость</p>
                        <p className="font-medium">{selectedGroup.studentLimit} человек</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Список учеников</h3>
                        <Button size="sm" variant="outline" onClick={openAddStudentDialog}>
                          <Plus className="w-4 h-4 mr-2" />
                          Добавить ученика
                        </Button>
                      </div>

                      {selectedGroup.students.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Нет учеников в группе</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Имя</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Посещаемость</TableHead>
                              <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedGroup.students.map((student) => (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.email}</TableCell>
                                <TableCell>
                                  {student.attendanceCount} занятий
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeStudent(selectedGroup.id, student.id);
                                    }}
                                  >
                                    <Trash className="w-4 h-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div className="flex justify-between pt-4 border-t">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className={selectedGroup?.isActive
                            ? "border-orange-500 text-orange-500 hover:bg-orange-50"
                            : "border-green-500 text-green-500 hover:bg-green-50"
                          }
                          onClick={() => setCloseGroupDialogOpen(true)}
                        >
                          {selectedGroup?.isActive ? (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              Закрыть группу
                            </>
                          ) : (
                            <>
                              <LockOpen className="w-4 h-4 mr-2" />
                              Открыть группу
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteGroupDialogOpen(true)}
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Удалить группу
                        </Button>
                      </div>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Закрыть
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {}
          <AlertDialog open={closeGroupDialogOpen} onOpenChange={setCloseGroupDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {selectedGroup?.isActive ? "Закрыть группу?" : "Открыть группу?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedGroup?.isActive
                    ? `Вы уверены, что хотите закрыть группу "${selectedGroup?.name}"? Группа будет скрыта из активных, но данные сохранятся.`
                    : `Вы уверены, что хотите открыть группу "${selectedGroup?.name}"? Группа снова станет активной.`
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className={selectedGroup?.isActive
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-green-500 hover:bg-green-600"
                  }
                  onClick={() => selectedGroup && (selectedGroup.isActive ? closeGroup(selectedGroup.id) : openGroup(selectedGroup.id))}
                >
                  {selectedGroup?.isActive ? "Закрыть группу" : "Открыть группу"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {}
          <AlertDialog open={deleteGroupDialogOpen} onOpenChange={setDeleteGroupDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Вы уверены, что хотите УДАЛИТЬ группу "{selectedGroup?.name}"?
                  Это действие нельзя отменить. Все данные группы будут удалены безвозвратно.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600"
                  onClick={() => selectedGroup && deleteGroup(selectedGroup.id)}
                >
                  Удалить группу
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {}
          <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить ученика в группу</DialogTitle>
                <DialogDescription>
                  Выберите ученика для добавления в группу {selectedGroup?.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                  {allStudents.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Нет доступных учеников</p>
                  ) : (
                    <div className="divide-y">
                      {allStudents
                        .filter(s => !selectedGroup?.students.some(gs => gs.id === s.id))
                        .map((student) => (
                          <div
                            key={student.id}
                            className={`p-3 cursor-pointer hover:bg-gray-50 ${
                              selectedStudentId === student.id ? "bg-blue-50" : ""
                            }`}
                            onClick={() => setSelectedStudentId(student.id)}
                          >
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-gray-500">{student.email}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddStudentDialogOpen(false);
                      setSelectedStudentId(null);
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={addStudentToGroup}
                    disabled={!selectedStudentId}
                  >
                    Добавить
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {}
          <Dialog open={editHallDialogOpen} onOpenChange={setEditHallDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Назначить зал группе</DialogTitle>
                <DialogDescription>
                  Выберите зал для группы {selectedGroup?.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                  {allHalls.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Нет доступных залов</p>
                  ) : (
                    <div className="divide-y">
                      {allHalls.map((hall) => (
                        <div
                          key={hall.id}
                          className={`p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedHallId === hall.id ? "bg-blue-50" : ""
                          }`}
                          onClick={() => setSelectedHallId(hall.id)}
                        >
                          <p className="font-medium">{hall.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditHallDialogOpen(false);
                      setSelectedHallId(null);
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={assignHallToGroup}
                    disabled={selectedHallId === null}
                  >
                    Назначить
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {}
          <Dialog open={editDetailsDialogOpen} onOpenChange={setEditDetailsDialogOpen}>
              <DialogContent className="!max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center text-gray-800 mb-2">Редактировать данные группы</DialogTitle>
                <DialogDescription className="text-center text-gray-600 text-lg">
                  Измените преподавателя, расписание или вместимость группы <span className="font-semibold text-purple-700">{selectedGroup?.name}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-8 mt-8 pb-8 px-4">{}
                {}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Преподаватель
                  </label>
                  <div className="max-h-[150px] overflow-y-auto border rounded-lg">
                    {allTeachers.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">Нет доступных преподавателей</p>
                    ) : (
                      <div className="divide-y">
                        {allTeachers.map((teacher) => (
                          <div
                            key={teacher.id}
                            className={`p-3 cursor-pointer transition-all duration-150 ${
                              selectedTeacherId === teacher.id
                                ? "bg-purple-50 border-l-4 border-l-purple-500"
                                : "hover:bg-gray-50 border-l-4 border-l-transparent"
                            }`}
                            onClick={() => {
                              if (selectedTeacherId === teacher.id) {
                                setSelectedTeacherId(null);
                                setTeacherSchedules([]);
                              } else {
                                setSelectedTeacherId(teacher.id);
                                fetchTeacherSchedules(teacher.id);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <p className={`font-medium ${selectedTeacherId === teacher.id ? "text-purple-700" : ""}`}>{teacher.name}</p>
                              {selectedTeacherId === teacher.id && (
                                <span
                                  className="flex items-center justify-center w-5 h-5 bg-purple-500 rounded-full hover:bg-red-500 transition-colors"
                                  title="Нажмите, чтобы отменить выбор"
                                >
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            {selectedTeacherId === teacher.id && (
                              <div className="mt-2 text-sm text-gray-600">
                                {loadingTeacherSchedules ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                    <span>Загрузка расписания...</span>
                                  </div>
                                ) : teacherSchedules.length > 0 ? (
                                  <div>
                                    <p className="font-medium text-gray-700 mb-1">Текущие занятия:</p>
                                    <div className="space-y-1">
                                      {teacherSchedules.map((schedule, index) => (
                                        <div key={index} className="text-xs bg-gray-100 rounded px-2 py-1 flex justify-between items-start">
                                          <div className="flex-1">
                                            <div className="font-medium">{schedule.groupName}</div>
                                            <div className="text-gray-600">{schedule.schedule}</div>
                                            <div className="text-gray-500">{schedule.hallName}</div>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteScheduleDialog({
                                                open: true,
                                                groupId: schedule.groupId,
                                                teacherId: teacher.id,
                                                groupName: schedule.groupName
                                              });
                                            }}
                                            className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                                            title="Удалить расписание"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-500">Нет активных занятий</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-800">Расписание занятий</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Начало:</label>
                        <input
                          type="date"
                          value={scheduleStartDate}
                          onChange={(e) => setScheduleStartDate(e.target.value)}
                          className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          placeholder="Дата начала"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">До:</label>
                        <input
                          type="date"
                          value={repeatUntilDate}
                          onChange={(e) => setRepeatUntilDate(e.target.value)}
                          className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500"
                          placeholder="Дата окончания"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { value: "monday", label: "Понедельник", short: "ПН" },
                      { value: "tuesday", label: "Вторник", short: "ВТ" },
                      { value: "wednesday", label: "Среда", short: "СР" },
                      { value: "thursday", label: "Четверг", short: "ЧТ" },
                      { value: "friday", label: "Пятница", short: "ПТ" },
                      { value: "saturday", label: "Суббота", short: "СБ" },
                      { value: "sunday", label: "Воскресенье", short: "ВС" }
                    ].map((day) => {
                      const currentTime = dayTimeSchedule[day.value] || '';
                      const hasTime = currentTime.trim() !== '';

                      return (
                        <div key={day.value} className="flex items-center space-x-3 p-2 border rounded-lg transition-all hover:shadow-sm">
                          <div className="w-24 text-left">
                            <div className="text-sm font-medium text-gray-800">{day.label}</div>
                          </div>
                          <div className={`flex-1 rounded-md p-2 transition-all ${
                            dayTimeSchedule[day.value]
                              ? 'border border-purple-300 bg-purple-50'
                              : 'border border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}>
                            {dayTimeSchedule[day.value] ? (
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-purple-700">
                                  {dayTimeSchedule[day.value]}
                                </div>
                                <button
                                  onClick={() => {
                                    setDayTimeSchedule(prev => ({
                                      ...prev,
                                      [day.value]: ""
                                    }));
                                  }}
                                  className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded transition-colors"
                                  title="Удалить время"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className="text-xs text-gray-600">Время:</div>
                                <div className="flex items-center space-x-1">
                                  <select
                                    className="w-14 h-8 px-1 py-1 border border-gray-300 rounded text-center text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                                    onChange={(e) => {
                                      setTempTimeSelection(prev => ({
                                        ...prev,
                                        [day.value]: {
                                          hour: e.target.value,
                                          minute: prev[day.value]?.minute || ''
                                        }
                                      }));
                                    }}
                                    value={tempTimeSelection[day.value]?.hour || ''}
                                  >
                                    <option value="">ЧЧ</option>
                                    {Array.from({ length: 24 }, (_, i) => {
                                      const hour = i.toString().padStart(2, '0');
                                      return (
                                        <option key={hour} value={hour}>{hour}</option>
                                      );
                                    })}
                                  </select>
                                  <span className="text-sm text-gray-600">:</span>
                                  <select
                                    className="w-14 h-8 px-1 py-1 border border-gray-300 rounded text-center text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                                    onChange={(e) => {
                                      setTempTimeSelection(prev => ({
                                        ...prev,
                                        [day.value]: {
                                          hour: prev[day.value]?.hour || '',
                                          minute: e.target.value
                                        }
                                      }));
                                    }}
                                    value={tempTimeSelection[day.value]?.minute || ''}
                                  >
                                    <option value="">ММ</option>
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const minute = (i * 5).toString().padStart(2, '0');
                                      return (
                                        <option key={minute} value={minute}>{minute}</option>
                                      );
                                    })}
                                  </select>
                                  {(tempTimeSelection[day.value]?.hour && tempTimeSelection[day.value]?.minute) && (
                                    <button
                                      onClick={() => {
                                        const hour = tempTimeSelection[day.value]?.hour;
                                        const minute = tempTimeSelection[day.value]?.minute;
                                        if (hour && minute) {
                                          setDayTimeSchedule(prev => ({
                                            ...prev,
                                            [day.value]: `${hour}:${minute}`
                                          }));
                                          setTempTimeSelection(prev => ({
                                            ...prev,
                                            [day.value]: { hour: '', minute: '' }
                                          }));
                                        }
                                      }}
                                      className="ml-2 px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 text-xs rounded transition-colors"
                                      title="Сохранить время"
                                    >
                                      ✓
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-600 bg-gray-50 rounded p-2">
                    <span>💡 Нажмите на день и введите время</span>
                    <button
                      onClick={() => {

                        const commonTime = editScheduleTime || '16:00';
                        const hasAnySchedule = Object.values(dayTimeSchedule).some(time => time.trim() !== '');
                        if (hasAnySchedule) {
                          if (window.confirm('Очистить все расписание?')) {
                            setDayTimeSchedule({});
                            setScheduleStartDate("");
                          }
                        } else {

                          setDayTimeSchedule({
                            monday: commonTime,
                            tuesday: commonTime,
                            wednesday: commonTime,
                            thursday: commonTime,
                            friday: commonTime
                          });
                        }
                      }}
                      className="text-purple-600 hover:text-purple-800 text-xs px-2 py-1 rounded hover:bg-purple-50"
                    >
                      {Object.values(dayTimeSchedule).some(time => time.trim() !== '') ? 'Очистить' : 'Будни'}
                    </button>
                  </div>
                </div>
                {}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Вместимость (человек)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditDetailsDialogOpen(false);
                      setSelectedTeacherId(null);
                      setTeacherSchedules([]);
                      setRepeatUntilDate("");
                      setScheduleStartDate("");
                      setDayTimeSchedule({});
                    }}
                  >
                    Отмена
                  </Button>
                  <Button onClick={saveGroupDetails}>
                    Сохранить изменения
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>

        {}
        <CreateGroupModal
          isOpen={createGroupModalOpen}
          onCloseAction={() => setCreateGroupModalOpen(false)}
          onSubmitAction={handleCreateGroup}
        />

        {}
        <AlertDialog
          open={deleteScheduleDialog.open}
          onOpenChange={(open) => setDeleteScheduleDialog(prev => ({ ...prev, open }))}
        >
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить преподавателя из группы?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить преподавателя из группы "{deleteScheduleDialog.groupName}"?
                Это действие нельзя будет отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteScheduleDialog({ open: false, groupId: null, teacherId: null, groupName: "" })}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (deleteScheduleDialog.groupId && deleteScheduleDialog.teacherId) {
                    deleteTeacherSchedule(deleteScheduleDialog.groupId, deleteScheduleDialog.teacherId);
                  }
                  setDeleteScheduleDialog({ open: false, groupId: null, teacherId: null, groupName: "" });
                }}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
