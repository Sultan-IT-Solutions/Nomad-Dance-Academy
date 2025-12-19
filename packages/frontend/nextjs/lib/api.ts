

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}


export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    let errorMessage = error.detail || error.error || 'Request failed';

    if (response.status === 401) {
      errorMessage = 'Неверный email или пароль';
    } else if (response.status === 400) {
      if (errorMessage.includes('email') && errorMessage.includes('пароль')) {
        errorMessage = 'Пожалуйста, заполните все поля';
      } else {
        errorMessage = 'Ошибка в данных. Проверьте введенную информацию';
      }
    } else if (response.status === 422) {
      errorMessage = 'Ошибка валидации. Проверьте правильность заполнения полей';
    } else if (response.status === 500) {
      errorMessage = 'Ошибка сервера. Попробуйте позже';
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


export const API = {
  auth: {
    login: (email: string, password: string) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: {
      full_name: string;
      email: string;
      password: string;
      password_confirm: string;
      phone?: string;
    }) =>
      apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  users: {
    me: () => apiRequest('/users/me'),
    getById: (id: number) => apiRequest(`/users/${id}`),
  },

  students: {
    me: () => apiRequest('/students/me'),
    getAll: () => apiRequest('/admin/students'),
    getById: (id: number) => apiRequest(`/students/${id}`),
    getGroups: (studentId: number) => apiRequest(`/students/${studentId}/groups`),
    getMyGroups: () => apiRequest('/students/my-groups'),
    getAttendance: (studentId: number) => apiRequest(`/students/${studentId}/attendance`),
    getMyAttendance: () => apiRequest('/students/my-attendance'),
  },

  groups: {
    getAvailable: () => apiRequest('/groups/available'),
    getAll: () => apiRequest('/admin/groups'),
    getById: (id: number) => apiRequest(`/admin/groups/${id}`),
    getSchedule: (groupId: number) => apiRequest(`/groups/${groupId}/schedule`),
    join: (groupId: number) => apiRequest(`/groups/${groupId}/join`, { method: 'POST' }),
    trial: (groupId: number) => apiRequest(`/groups/${groupId}/trial`, { method: 'POST' }),
    requestAdditional: (groupId: number, date: string) =>
      apiRequest(`/groups/${groupId}/additional-request`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      }),
    updateLimit: (groupId: number, limit: number) =>
      apiRequest(`/admin/groups/${groupId}/limit`, {
        method: 'PUT',
        body: JSON.stringify({ limit }),
      }),
    create: (data: any) =>
      apiRequest('/admin/groups', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (groupId: number, data: any) =>
      apiRequest(`/admin/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (groupId: number) =>
      apiRequest(`/admin/groups/${groupId}`, { method: 'DELETE' }),
  },

  teachers: {
    getAll: () => apiRequest('/admin/teachers'),
    getById: (id: number) => apiRequest(`/teachers/${id}`),
    getGroups: (teacherId: number) => apiRequest(`/admin/teachers/${teacherId}/groups`),
    getMyGroups: () => apiRequest('/teachers/groups'),
    getScheduledLessons: () => apiRequest('/teachers/scheduled-lessons'),
    saveAttendance: (groupId: number, data: {
      lesson_date: string;
      attendance_records: Array<{ student_id: number; status: string }>;
    }) => apiRequest(`/teachers/groups/${groupId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getGroupStudents: (groupId: number) => apiRequest(`/teachers/groups/${groupId}/students`),
    getGroupStats: (groupId: number) => apiRequest(`/teachers/groups/${groupId}/stats`),
    getGroupDetails: (groupId: number) => apiRequest(`/teachers/groups/${groupId}`),
    getGroupLessons: (groupId: number) => apiRequest(`/teachers/groups/${groupId}/lessons`),
    saveGroupNotes: (groupId: number, notes: string) =>
      apiRequest(`/teachers/groups/${groupId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      }),
    saveLessonAttendance: (lessonId: number, data: {
      attendance_records: Array<{ student_id: number; status: string }>;
    }) => apiRequest(`/teachers/lessons/${lessonId}/attendance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    createGroup: (groupData: {
      name: string;
      hall_id: number;
      start_time: string;
      capacity?: number;
    }) => apiRequest('/teachers/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    }),
    rescheduleRequest: (rescheduleData: {
      lesson_id: number;
      new_start_time: string;
      new_hall_id?: number;
      reason?: string;
    }) => apiRequest('/teachers/reschedule-request', {
      method: 'POST',
      body: JSON.stringify(rescheduleData),
    }),
    assignGroup: (teacherId: number, groupId: number) =>
      apiRequest(`/admin/teachers/${teacherId}/groups/${groupId}`, { method: 'POST' }),
    removeGroup: (teacherId: number, groupId: number) =>
      apiRequest(`/admin/teachers/${teacherId}/groups/${groupId}`, { method: 'DELETE' }),
  },

  halls: {
    getAll: () => apiRequest('/admin/halls'),
    getAnalytics: () => apiRequest('/admin/analytics/halls'),
    getDetails: (hallId: number) => apiRequest(`/admin/halls/${hallId}/details`),
    getSchedule: (hallId: number, date?: string) => {
      const params = date ? `?date=${date}` : '';
      return apiRequest(`/admin/halls/${hallId}/schedule${params}`);
    },
    create: (data: { name: string; capacity: number }) =>
      apiRequest('/admin/halls', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (hallId: number, data: { name: string; capacity: number }) =>
      apiRequest(`/admin/halls/${hallId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (hallId: number) =>
      apiRequest(`/admin/halls/${hallId}`, { method: 'DELETE' }),
  },

  lessons: {
    create: (data: any) =>
      apiRequest('/lessons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (lessonId: number, data: any) =>
      apiRequest(`/admin/lessons/${lessonId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (lessonId: number) =>
      apiRequest(`/admin/lessons/${lessonId}`, { method: 'DELETE' }),
    reschedule: (lessonId: number, newDate: string, newTime: string) =>
      apiRequest(`/admin/lessons/${lessonId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ new_date: newDate, new_time: newTime }),
      }),
    cancel: (lessonId: number) =>
      apiRequest(`/admin/lessons/${lessonId}/cancel`, { method: 'POST' }),
  },

  schedule: {
    getWeekly: (weekStart: string) => apiRequest(`/admin/schedule/weekly?week_start=${weekStart}`),
  },

  admin: {
    getAnalytics: () => apiRequest('/admin/analytics'),
    getTeachersAnalytics: () => apiRequest('/admin/analytics/teachers'),
    getGroupsAnalytics: () => apiRequest('/admin/analytics/groups'),
    getStudentsAnalytics: () => apiRequest('/admin/analytics/students'),
    addStudentToGroup: (groupId: number, studentId: number) =>
      apiRequest(`/admin/groups/${groupId}/students`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, is_trial: false }),
      }),
    removeStudentFromGroup: (groupId: number, studentId: number) =>
      apiRequest(`/admin/groups/${groupId}/students/${studentId}`, { method: 'DELETE' }),
    handleAdditionalLesson: (exceptionId: number, decision: 'approve' | 'reject') =>
      apiRequest(`/admin/additional-lessons/${exceptionId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }),
    getRescheduleRequests: () => apiRequest('/admin/reschedule-requests'),
    approveRescheduleRequest: (requestId: number) =>
      apiRequest(`/admin/reschedule-requests/${requestId}/approve`, { method: 'POST' }),
    rejectRescheduleRequest: (requestId: number) =>
      apiRequest(`/admin/reschedule-requests/${requestId}/reject`, { method: 'POST' }),
  },

  health: () => apiRequest('/health'),
};


export function handleApiError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}


export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
}


export function getUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}


export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}
