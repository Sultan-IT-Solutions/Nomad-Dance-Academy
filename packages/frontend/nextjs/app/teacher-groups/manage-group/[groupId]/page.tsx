'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, MapPin, Calendar, BookOpen, Settings, BarChart, Loader2, ArrowLeft } from 'lucide-react';
import TeacherAttendanceManager from '@/components/teacher-attendance-manager';

interface Student {
  id: number;
  name: string;
  attendance_rate: number;
  last_attendance: string;
  status: string;
}

interface GroupStats {
  total_students: number;
  active_students: number;
  average_attendance: number;
  total_lessons: number;
  upcoming_lessons: number;
}

interface Lesson {
  id: number;
  lesson_date: string;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  hall_name: string;
  is_cancelled: boolean;
  attendance_records: AttendanceRecord[];
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  attended: boolean;
  status: 'P' | 'E' | 'L' | 'A' | null;
  recorded_at: string;
}

interface GroupDetails {
  id: number;
  name: string;
  notes: string;
  capacity: number;
  hall_name: string;
}

export default function ManageGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [activeTab, setActiveTab] = useState('overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [groupNotes, setGroupNotes] = useState('');

  useEffect(() => {
    if (groupId) {
      fetchGroupData();
    }
  }, [groupId]);

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

      const [studentsResponse, statsResponse, groupResponse, lessonsResponse] = await Promise.all([
        fetch(`http://localhost:8000/teachers/groups/${groupId}/students`, { headers }),
        fetch(`http://localhost:8000/teachers/groups/${groupId}/stats`, { headers }),
        fetch(`http://localhost:8000/teachers/groups/${groupId}`, { headers }),
        fetch(`http://localhost:8000/teachers/groups/${groupId}/lessons`, { headers })
      ]);

      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        setStudents(studentsData.students || []);
      } else {
        console.error('Failed to fetch students:', studentsResponse.status);
        setStudents([]);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setGroupStats(statsData.stats || null);
      } else {
        console.error('Failed to fetch stats:', statsResponse.status);
        setGroupStats(null);
      }

      if (groupResponse.ok) {
        const groupData = await groupResponse.json();
        setGroupDetails(groupData);
        setGroupNotes(groupData.notes || '');
      } else {
        console.error('Failed to fetch group details:', groupResponse.status);
      }

      if (lessonsResponse.ok) {
        const lessonsData = await lessonsResponse.json();

        setLessons(lessonsData.lessons || []);
      } else {
        console.error('Failed to fetch lessons:', lessonsResponse.status);
        setLessons([]);
      }
    } catch (error) {
      console.error('Error fetching group data:', error);
      setStudents([]);
      setGroupStats(null);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:8000/teachers/groups/${groupId}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: groupNotes })
      });

      if (response.ok) {
        alert('Заметки сохранены!');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleAttendanceUpdate = async (lessonId: number, studentId: number, status: 'P' | 'E' | 'L' | 'A') => {
    setAttendanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:8000/teachers/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attendance_records: [{
            student_id: studentId,
            status: status
          }]
        })
      });

      if (response.ok) {
        setLessons(prev => prev.map(lesson => {
          if (lesson.id === lessonId) {
            const existingRecordIndex = lesson.attendance_records?.findIndex(
              r => r.student_id === studentId
            );

            const newRecord: AttendanceRecord = {
              id: 0,
              student_id: studentId,
              student_name: students.find(s => s.id === studentId)?.name || '',
              attended: status === 'P' || status === 'E' || status === 'L',
              status: status,
              recorded_at: new Date().toISOString()
            };

            if (existingRecordIndex !== undefined && existingRecordIndex >= 0) {
              const updatedRecords = [...(lesson.attendance_records || [])];
              updatedRecords[existingRecordIndex] = newRecord;
              return { ...lesson, attendance_records: updatedRecords };
            } else {
              return {
                ...lesson,
                attendance_records: [...(lesson.attendance_records || []), newRecord]
              };
            }
          }
          return lesson;
        }));
      } else {
        console.error('Failed to save attendance');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/teacher-groups')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад к группам
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Управление группой: {groupDetails?.name || 'Загрузка...'}
                </h1>
                <p className="text-gray-600">
                  {groupDetails?.hall_name && `Зал: ${groupDetails.hall_name} • `}
                  Вместимость: {groupDetails?.capacity || 0} человек
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Студенты
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Расписание
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Посещаемость
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Заметки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {groupStats ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Всего студентов</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{groupStats.total_students}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Активных студентов</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{groupStats.active_students}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Средняя посещаемость</CardTitle>
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{groupStats.average_attendance}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Проведено уроков</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{groupStats.total_lessons}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Предстоящих уроков</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{groupStats.upcoming_lessons}</div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="col-span-5 text-center py-8">
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="ml-2">Загрузка статистики...</span>
                    </div>
                  ) : (
                    <p className="text-gray-500">Нет данных для отображения</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Список студентов</span>
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Добавить студента
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Загрузка студентов...</span>
                  </div>
                ) : students.length > 0 ? (
                  <div className="space-y-4">
                    {students.map((student: Student) => (
                      <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-gray-500">
                            Последнее посещение: {student.last_attendance ? new Date(student.last_attendance).toLocaleDateString('ru-RU') : 'Нет данных'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            student.attendance_rate >= 90 ? 'text-green-600' :
                            student.attendance_rate >= 75 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {student.attendance_rate}% посещаемость
                          </p>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {student.status === 'active' ? 'Активен' : 'Неактивен'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Нет данных о студентах или ошибка загрузки</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Расписание и посещаемость</CardTitle>
                <CardDescription>
                  <div className="flex gap-2 text-sm">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">P - Присутствовал</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">E - Уважительная</span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">L - Опоздал</span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded">A - Отсутствовал</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Загрузка расписания...</span>
                  </div>
                ) : lessons.length > 0 ? (
                  <div className="space-y-4">
                    {lessons.map((lesson) => (
                      <Card key={lesson.id} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{lesson.class_name}</CardTitle>
                              <CardDescription>
                                {new Date(lesson.lesson_date).toLocaleDateString('ru-RU')} в {lesson.start_time}
                                ({lesson.duration_minutes} мин) - {lesson.hall_name}
                              </CardDescription>
                              {lesson.is_cancelled && (
                                <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full mt-2">
                                  Отменено
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        {!lesson.is_cancelled && (
                          <CardContent>
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-gray-700">Отметить посещаемость:</p>
                              <div className="grid gap-3">
                                {students.map((student) => {
                                  const attendanceRecord = lesson.attendance_records?.find(
                                    record => record.student_id === student.id
                                  );

                                  return (
                                    <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                      <span className="font-medium">{student.name}</span>
                                      <div className="flex gap-2">
                                        {['P', 'E', 'L', 'A'].map((status) => (
                                          <button
                                            key={status}
                                            disabled={attendanceLoading}
                                            onClick={() => handleAttendanceUpdate(lesson.id, student.id, status as 'P' | 'E' | 'L' | 'A')}
                                            className={`w-10 h-10 text-sm font-bold rounded-lg ${
                                              attendanceRecord?.status === status
                                                ? status === 'P' ? 'bg-green-500 text-white' :
                                                  status === 'E' ? 'bg-blue-500 text-white' :
                                                  status === 'L' ? 'bg-yellow-500 text-white' :
                                                  'bg-red-500 text-white'
                                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                            } ${attendanceLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transition-colors'}`}
                                            title={
                                              status === 'P' ? 'Присутствовал' :
                                              status === 'E' ? 'Уважительная причина' :
                                              status === 'L' ? 'Опоздал' : 'Отсутствовал'
                                            }
                                          >
                                            {status}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Нет запланированных занятий</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Посещаемость</CardTitle>
                <CardDescription>
                  Отмечать посещаемость студентов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TeacherAttendanceManager groupId={parseInt(groupId)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Заметки к группе</CardTitle>
                <CardDescription>
                  Добавьте заметки о группе, особенности студентов, планы на занятия...
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="groupNotes">Заметки</Label>
                  <Textarea
                    id="groupNotes"
                    value={groupNotes}
                    onChange={(e) => setGroupNotes(e.target.value)}
                    placeholder="Введите ваши заметки..."
                    rows={12}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleSaveNotes} className="w-full">
                  Сохранить заметки
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
