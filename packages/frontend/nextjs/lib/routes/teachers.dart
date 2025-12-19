import 'dart:convert';

import 'package:postgres/postgres.dart' show Sql;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../db/connection.dart';

class TeachersRoute {
  Router get router {
    final router = Router();

    router.post('/teachers/groups', _createGroup);
    router.post('/teachers/groups/<groupId>/extra-lessons', _createAdditionalLesson);
    router.post(
        '/teachers/groups/<groupId>/students/<studentId>/attendance', _markAttendance);
    router.get('/teachers/attendance/average', _teacherAttendanceSummary);
    router.get('/teachers/groups', _getTeacherGroups);
    
    
    router.get('/teachers/groups/<groupId>', _getGroupDetails);
    router.get('/teachers/groups/<groupId>/students', _getGroupStudents);
    router.get('/teachers/groups/<groupId>/stats', _getGroupStats);
    router.get('/teachers/groups/<groupId>/lessons', _getGroupLessons);
    router.post('/teachers/groups/<groupId>/notes', _saveGroupNotes);
    router.post('/teachers/lessons/<lessonId>/attendance', _updateAttendance);
    
    
    router.post('/teachers/reschedule-request', _submitRescheduleRequest);

    return router;
  }

  Future<Response> _createGroup(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may create groups'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;

      final name = data['name']?.toString();
      final hallId = int.tryParse(data['hall_id']?.toString() ?? '');
      final startTime = data['start_time'] == null
          ? null
          : DateTime.tryParse(data['start_time'].toString());
      
      final duration = 90;
      final capacity = int.tryParse(data['capacity']?.toString() ?? '') ?? 12;

      if (name == null || hallId == null || startTime == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'name and hall_id are required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = await _resolveTeacherId(user['id'] as int);
      if (teacherId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Teacher profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final endTime = startTime.add(Duration(minutes: duration));
      final hallConflicts = await connection.execute(
          Sql.named('''
            SELECT g.id FROM groups g
            WHERE g.hall_id = @hallId
              AND NOT (
                (g.start_time + (g.duration_minutes * INTERVAL '1 minute')) <= @startTime
                OR g.start_time >= @endTime
              )
            LIMIT 1;
          '''),
          parameters: {'hallId': hallId, 'startTime': startTime, 'endTime': endTime},
        );
      final exceptionConflicts = await connection.execute(
          Sql.named('''
            SELECT se.id FROM schedule_exceptions se
            WHERE se.hall_id = @hallId AND se.approved = TRUE
              AND NOT (
                (se.start_time + (se.duration_minutes * INTERVAL '1 minute')) <= @startTime
                OR se.start_time >= @endTime
              )
            LIMIT 1;
          '''),
          parameters: {'hallId': hallId, 'startTime': startTime, 'endTime': endTime},
        );

      if (hallConflicts.isNotEmpty || exceptionConflicts.isNotEmpty) {
        return Response(
          409,
          body: jsonEncode({'error': 'Hall not available at requested time'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final inserted = await connection.execute(
        Sql.named('''
          INSERT INTO groups (name, hall_id, main_teacher_id, start_time, duration_minutes, capacity)
          VALUES (@name, @hallId, @teacherId, @startTime, @duration, @capacity)
          RETURNING id;
        '''),
        parameters: {
          'name': name,
          'hallId': hallId,
          'teacherId': teacherId,
          'startTime': startTime,
          'duration': duration,
          'capacity': capacity,
        },
      );

      final groupId = inserted.first[0] as int;
      await connection.execute(
        Sql.named('''
          INSERT INTO group_teachers (group_id, teacher_id)
          VALUES (@groupId, @teacherId)
          ON CONFLICT DO NOTHING;
        '''),
        parameters: {'groupId': groupId, 'teacherId': teacherId},
      );

      print('👨‍🏫 Teacher $teacherId created group $groupId');
      return Response.ok(
        jsonEncode({'group_id': groupId}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to create group: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to create group'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _createAdditionalLesson(Request req, String groupIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may create additional lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final groupId = int.tryParse(groupIdParam);
    if (groupId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid group id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final teacherId = await _resolveTeacherId(user['id'] as int);
      if (teacherId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Teacher profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final isAssigned = await _teacherAssignedToGroup(teacherId, groupId);
      if (!isAssigned) {
        return Response.forbidden(
          jsonEncode({'error': 'Teacher is not assigned to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;
      final startTime = DateTime.tryParse(data['start_time']?.toString() ?? '');
      
      final duration = 90;
      final hallId = int.tryParse(data['hall_id']?.toString() ?? '');
      final reason = data['reason']?.toString();

      if (startTime == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'start_time is required in ISO8601 format'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final groupInfo = await connection.execute(
        Sql.named(
            'SELECT COALESCE(@hallId::INT, hall_id), duration_minutes FROM groups WHERE id = @groupId'),
        parameters: {'hallId': hallId, 'groupId': groupId},
      );

      if (groupInfo.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final resolvedHallId = hallId ?? groupInfo.first[0] as int?;
      final endTime = startTime.add(Duration(minutes: duration));
      if (resolvedHallId != null) {
        final hallConflicts = await connection.execute(
          Sql.named('''
            SELECT g.id FROM groups g
            WHERE g.hall_id = @hallId
              AND NOT (
                (g.start_time + (g.duration_minutes * INTERVAL '1 minute')) <= @startTime
                OR g.start_time >= @endTime
              )
            LIMIT 1;
          '''),
          parameters: {'hallId': resolvedHallId, 'startTime': startTime, 'endTime': endTime},
        );
        final exceptionConflicts = await connection.execute(
          Sql.named('''
            SELECT se.id FROM schedule_exceptions se
            WHERE se.hall_id = @hallId AND se.approved = TRUE
              AND NOT (
                (se.start_time + (se.duration_minutes * INTERVAL '1 minute')) <= @startTime
                OR se.start_time >= @endTime
              )
            LIMIT 1;
          '''),
          parameters: {'hallId': resolvedHallId, 'startTime': startTime, 'endTime': endTime},
        );

        if (hallConflicts.isNotEmpty || exceptionConflicts.isNotEmpty) {
          return Response(
            409,
            body: jsonEncode({'error': 'Hall not available at requested time for additional lesson'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }

      final inserted = await connection.execute(
        Sql.named('''
          INSERT INTO schedule_exceptions (
            group_id,
            teacher_id,
            hall_id,
            start_time,
            duration_minutes,
            reason,
            additional,
            approved,
            requested_by_student
          )
          VALUES (
            @groupId,
            @teacherId,
            @hallId,
            @startTime,
            @duration,
            @reason,
            TRUE,
            TRUE,
            FALSE
          )
          RETURNING id;
        '''),
        parameters: {
          'groupId': groupId,
          'teacherId': teacherId,
          'hallId': resolvedHallId,
          'startTime': startTime,
          'duration': duration,
          'reason': reason,
        },
      );

      final exceptionId = inserted.first[0] as int;
      print('📅 Teacher $teacherId created additional lesson $exceptionId for group $groupId');
      return Response.ok(
        jsonEncode({'additional_lesson_id': exceptionId}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to create additional lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to create additional lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _markAttendance(
    Request req,
    String groupIdParam,
    String studentIdParam,
  ) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may mark attendance'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final groupId = int.tryParse(groupIdParam);
    final studentId = int.tryParse(studentIdParam);
    if (groupId == null || studentId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid group or student id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final teacherId = await _resolveTeacherId(user['id'] as int);
      if (teacherId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Teacher profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final isAssigned = await _teacherAssignedToGroup(teacherId, groupId);
      if (!isAssigned) {
        return Response.forbidden(
          jsonEncode({'error': 'Teacher is not assigned to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;
      final attended = data['attended'] == true;
      final teacherPresent = data['teacher_present'] != false;

      final membership = await connection.execute(
        Sql.named(
            'SELECT 1 FROM group_students WHERE group_id = @groupId AND student_id = @studentId'),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );

      if (membership.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student is not assigned to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      await connection.execute(
        Sql.named('''
          INSERT INTO attendance_records (group_id, student_id, teacher_id, attended, teacher_present)
          VALUES (@groupId, @studentId, @teacherId, @attended, @teacherPresent);
        '''),
        parameters: {
          'groupId': groupId,
          'studentId': studentId,
          'teacherId': teacherId,
          'attended': attended,
          'teacherPresent': teacherPresent,
        },
      );

      print('📋 Teacher $teacherId recorded attendance for student $studentId in group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Attendance recorded'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to record attendance: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to record attendance'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _teacherAttendanceSummary(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may view attendance summary'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final teacherId = await _resolveTeacherId(user['id'] as int);
      if (teacherId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Teacher profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final rows = await connection.execute(
        Sql.named('''
          SELECT
            g.id,
            g.name,
            CASE WHEN COUNT(ar.id) = 0 THEN NULL
                 ELSE AVG(CASE WHEN ar.attended THEN 1 ELSE 0 END)
            END AS student_attendance,
            CASE WHEN COUNT(ar.id) = 0 THEN NULL
                 ELSE AVG(CASE WHEN ar.teacher_present THEN 1 ELSE 0 END)
            END AS teacher_presence
          FROM groups g
          LEFT JOIN attendance_records ar ON ar.group_id = g.id AND ar.teacher_id = @teacherId
          WHERE EXISTS (
            SELECT 1 FROM group_teachers gt WHERE gt.group_id = g.id AND gt.teacher_id = @teacherId
          ) OR g.main_teacher_id = @teacherId
          GROUP BY g.id, g.name
          ORDER BY g.id;
        '''),
        parameters: {'teacherId': teacherId},
      );

      final result = rows
          .map((row) => {
                'group_id': row[0],
                'group_name': row[1],
                'student_attendance': (row[2] as num?)?.toDouble(),
                'teacher_presence': (row[3] as num?)?.toDouble(),
              })
          .toList();

      return Response.ok(
        jsonEncode(result),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load teacher attendance summary: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to load teacher attendance summary'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getTeacherGroups(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may view their groups'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final teacherId = await _resolveTeacherId(user['id'] as int);
      if (teacherId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Teacher profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final rows = await connection.execute(
        Sql.named('''
          SELECT 
            g.id,
            g.name,
            g.start_time,
            g.duration_minutes,
            h.name as hall_name,
            COUNT(DISTINCT gs.student_id) as student_count,
            g.capacity,
            g.is_closed,
            g.recurring_days,
            g.recurring_until,
            g.schedule_json
          FROM groups g
          LEFT JOIN halls h ON g.hall_id = h.id
          LEFT JOIN group_students gs ON g.id = gs.group_id
          WHERE EXISTS (
            SELECT 1 FROM group_teachers gt WHERE gt.group_id = g.id AND gt.teacher_id = @teacherId
          ) OR g.main_teacher_id = @teacherId
          GROUP BY g.id, g.name, g.start_time, g.duration_minutes, h.name, g.capacity, g.is_closed, g.recurring_days, g.recurring_until, g.schedule_json
          ORDER BY g.start_time ASC;
        '''),
        parameters: {'teacherId': teacherId},
      );

      final groups = rows.map((row) {
        final startTime = row[2] as DateTime?;
        final endTime = startTime?.add(Duration(minutes: row[3] as int));
        final recurringDays = row[8];
        final scheduleJson = row[10]; 
        
        
        String schedule = 'Не указано';
        
        
        if (scheduleJson != null && scheduleJson.toString().trim().isNotEmpty) {
          try {
            final scheduleData = jsonDecode(scheduleJson.toString()) as Map<String, dynamic>;
            
            
            if (scheduleData.containsKey('startDate') && scheduleData.containsKey('weekdays')) {
              final weekdays = scheduleData['weekdays'] as Map<String, dynamic>;
              final endDate = scheduleData['endDate'] as String?;
              
              if (weekdays.isNotEmpty) {
                
                final daySchedules = <String>[];
                weekdays.forEach((day, time) {
                  if (time != null && time.toString().trim().isNotEmpty) {
                    final dayName = switch (day.toLowerCase().trim()) {
                      'monday' => 'Пн',
                      'tuesday' => 'Вт', 
                      'wednesday' => 'Ср',
                      'thursday' => 'Чт',
                      'friday' => 'Пт',
                      'saturday' => 'Сб',
                      'sunday' => 'Вс',
                      _ => day,
                    };
                    daySchedules.add('$dayName: $time');
                  }
                });
                
                if (daySchedules.isNotEmpty) {
                  String scheduleText = daySchedules.join('\n');
                  
                  
                  if (endDate != null && endDate.isNotEmpty) {
                    try {
                      final end = DateTime.parse(endDate);
                      final endFormatted = '${end.day.toString().padLeft(2, '0')}.${end.month.toString().padLeft(2, '0')}.${end.year}';
                      scheduleText = '$scheduleText\nДо: $endFormatted';
                    } catch (e) {
                      
                    }
                  }
                  
                  schedule = scheduleText;
                }
              }
            } else {
              
              final daySchedules = <String>[];
              (scheduleData as Map<String, dynamic>).forEach((day, time) {
                if (time != null && time.toString().trim().isNotEmpty) {
                  final dayName = switch (day.toLowerCase().trim()) {
                    'monday' => 'Пн',
                    'tuesday' => 'Вт', 
                    'wednesday' => 'Ср',
                    'thursday' => 'Чт',
                    'friday' => 'Пт',
                    'saturday' => 'Сб',
                    'sunday' => 'Вс',
                    _ => day,
                  };
                  daySchedules.add('$dayName: $time');
                }
              });
              
              if (daySchedules.isNotEmpty) {
                schedule = daySchedules.join('\n');
              }
            }
          } catch (e) {
            print('Error parsing schedule_json for teacher group ${row[0]}: $e');
            
          }
        }
        
        
        if (schedule == 'Не указано' && startTime != null) {
          final time = '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}';
          
          
          if (recurringDays != null && recurringDays.toString().isNotEmpty) {
            final days = recurringDays.toString().split(',');
            final daySchedules = days.map((day) {
              final dayName = switch (day.toLowerCase().trim()) {
                'monday' => 'Пн',
                'tuesday' => 'Вт',
                'wednesday' => 'Ср',
                'thursday' => 'Чт',
                'friday' => 'Пт',
                'saturday' => 'Сб',
                'sunday' => 'Вс',
                _ => day,
              };
              return '$dayName: $time';
            }).toList();
            
            String scheduleText = daySchedules.join('\n');
            
            
            if (row[9] != null && row[9].toString().isNotEmpty) {
              try {
                final untilDate = DateTime.parse(row[9].toString());
                final untilFormatted = '${untilDate.day.toString().padLeft(2, '0')}.${untilDate.month.toString().padLeft(2, '0')}.${untilDate.year}';
                scheduleText = '$scheduleText\nДо: $untilFormatted';
              } catch (e) {
                
              }
            }
            schedule = scheduleText;
          } else {
            final dayOfWeek = _getDayOfWeek(startTime.weekday);
            schedule = '$dayOfWeek $time';
          }
        }
        
        return {
          'id': row[0],
          'name': row[1],
          'start_time': startTime?.toIso8601String(),
          'end_time': endTime?.toIso8601String(),
          'duration_minutes': row[3],
          'hall_name': row[4],
          'student_count': row[5],
          'capacity': row[6],
          'is_closed': row[7],
          'schedule': schedule,
          'recurring_days': recurringDays?.toString(),
          'recurring_until': row[9]?.toString(),
        };
      }).toList();

      return Response.ok(
        jsonEncode({'groups': groups}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch teacher groups: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to load teacher groups'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<int?> _resolveTeacherId(int userId) async {
    final rows = await connection.execute(
      Sql.named('SELECT id FROM teachers WHERE user_id = @userId'),
      parameters: {'userId': userId},
    );
    if (rows.isEmpty) {
      return null;
    }
    return rows.first[0] as int;
  }

  Future<bool> _teacherAssignedToGroup(int teacherId, int groupId) async {
    final rows = await connection.execute(
      Sql.named('''
        SELECT 1
        FROM group_teachers
        WHERE group_id = @groupId AND teacher_id = @teacherId
        UNION
        SELECT 1 FROM groups WHERE id = @groupId AND main_teacher_id = @teacherId;
      '''),
      parameters: {'groupId': groupId, 'teacherId': teacherId},
    );
    return rows.isNotEmpty;
  }

  String _getDayOfWeek(int weekday) {
    switch (weekday) {
      case 1:
        return 'Пн';
      case 2:
        return 'Вт';
      case 3:
        return 'Ср';
      case 4:
        return 'Чт';
      case 5:
        return 'Пт';
      case 6:
        return 'Сб';
      case 7:
        return 'Вс';
      default:
        return '';
    }
  }
  
  
  Future<Response> _getGroupDetails(Request req, String groupId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'] as int;
      final groupIdInt = int.tryParse(groupId);
      if (groupIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid group ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final groupResult = await connection.execute(
        Sql.named('''
          SELECT g.id, g.name, g.notes, g.capacity, h.name as hall_name
          FROM groups g
          LEFT JOIN halls h ON h.id = g.hall_id
          WHERE g.id = @groupId AND g.main_teacher_id = (SELECT id FROM teachers WHERE user_id = @teacherId)
        '''),
        parameters: {'groupId': groupIdInt, 'teacherId': teacherId},
      );

      if (groupResult.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final row = groupResult.first;
      final groupDetails = {
        'id': row[0],
        'name': row[1],
        'notes': row[2] ?? '',
        'capacity': row[3],
        'hall_name': row[4],
      };

      return Response.ok(
        jsonEncode(groupDetails),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch group details: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch group details'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroupStudents(Request req, String groupId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'] as int;
      final groupIdInt = int.tryParse(groupId);
      if (groupIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid group ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final groupCheck = await connection.execute(
        Sql.named('SELECT id FROM groups WHERE id = @groupId AND main_teacher_id = (SELECT id FROM teachers WHERE user_id = @teacherId)'),
        parameters: {'groupId': groupIdInt, 'teacherId': teacherId},
      );

      if (groupCheck.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final studentsResult = await connection.execute(
        Sql.named('''
          SELECT u.id, u.name, 
                 COALESCE(attendance_stats.attendance_rate, 0) as attendance_rate,
                 COALESCE(attendance_stats.last_attendance, '1970-01-01') as last_attendance,
                 'active' as status
          FROM group_students gs
          JOIN students s ON s.id = gs.student_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN (
            SELECT s2.user_id,
                   ROUND((COUNT(CASE WHEN ar.attended = true THEN 1 END) * 100.0 / COUNT(*)), 1) as attendance_rate,
                   MAX(ar.lesson_date) as last_attendance
            FROM attendance_records ar
            JOIN students s2 ON s2.id = ar.student_id
            WHERE ar.group_id = @groupId
            GROUP BY s2.user_id
          ) attendance_stats ON attendance_stats.user_id = u.id
          WHERE gs.group_id = @groupId AND u.role = 'student'
          ORDER BY u.name
        '''),
        parameters: {'groupId': groupIdInt},
      );

      final students = studentsResult.map((row) => {
        'id': row[0],
        'name': row[1],
        'attendance_rate': row[2] ?? 0,
        'last_attendance': row[3].toString(),
        'status': row[4],
      }).toList();

      return Response.ok(
        jsonEncode({'students': students}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch group students: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch students'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroupStats(Request req, String groupId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'] as int;
      final groupIdInt = int.tryParse(groupId);
      if (groupIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid group ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final groupCheck = await connection.execute(
        Sql.named('SELECT id FROM groups WHERE id = @groupId AND main_teacher_id = (SELECT id FROM teachers WHERE user_id = @teacherId)'),
        parameters: {'groupId': groupIdInt, 'teacherId': teacherId},
      );

      if (groupCheck.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final statsResult = await connection.execute(
        Sql.named('''
          SELECT 
            (SELECT COUNT(*) FROM group_students gs 
             JOIN students s ON s.id = gs.student_id 
             JOIN users u ON u.id = s.user_id 
             WHERE gs.group_id = @groupId AND u.role = 'student') as total_students,
            (SELECT COUNT(*) FROM group_students gs 
             JOIN students s ON s.id = gs.student_id 
             JOIN users u ON u.id = s.user_id 
             WHERE gs.group_id = @groupId AND u.role = 'student') as active_students,
            (SELECT COALESCE(ROUND(AVG(CASE WHEN ar.attended = true THEN 100.0 ELSE 0.0 END), 1), 0) 
             FROM attendance_records ar 
             JOIN students s ON s.id = ar.student_id
             JOIN users u ON u.id = s.user_id 
             WHERE ar.group_id = @groupId AND u.role = 'student') as average_attendance,
            (SELECT COUNT(DISTINCT ar.lesson_date) FROM attendance_records ar WHERE ar.group_id = @groupId) as total_lessons,
            (SELECT COUNT(*) FROM lessons WHERE group_id = @groupId AND start_time > NOW()) as upcoming_lessons
        '''),
        parameters: {'groupId': groupIdInt},
      );

      if (statsResult.isNotEmpty) {
        final row = statsResult.first;
        final stats = {
          'total_students': row[0] ?? 0,
          'active_students': row[1] ?? 0,
          'average_attendance': row[2] ?? 0.0,
          'total_lessons': row[3] ?? 0,
          'upcoming_lessons': row[4] ?? 0,
        };

        return Response.ok(
          jsonEncode({'stats': stats}),
          headers: {'content-type': 'application/json'},
        );
      }

      return Response.ok(
        jsonEncode({'stats': null}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch group stats: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch stats'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _saveGroupNotes(Request req, String groupId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'] as int;
      final groupIdInt = int.tryParse(groupId);
      if (groupIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid group ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;
      final notes = data['notes']?.toString() ?? '';

      
      final groupCheck = await connection.execute(
        Sql.named('SELECT id FROM groups WHERE id = @groupId AND main_teacher_id = (SELECT id FROM teachers WHERE user_id = @teacherId)'),
        parameters: {'groupId': groupIdInt, 'teacherId': teacherId},
      );

      if (groupCheck.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      await connection.execute(
        Sql.named('UPDATE groups SET notes = @notes WHERE id = @groupId'),
        parameters: {'notes': notes, 'groupId': groupIdInt},
      );

      return Response.ok(
        jsonEncode({'message': 'Notes saved successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to save group notes: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to save notes'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroupLessons(Request req, String groupId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'] as int;
      final groupIdInt = int.tryParse(groupId);
      if (groupIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid group ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final groupCheck = await connection.execute(
        Sql.named('SELECT id FROM groups WHERE id = @groupId AND main_teacher_id = (SELECT id FROM teachers WHERE user_id = @teacherId)'),
        parameters: {'groupId': groupIdInt, 'teacherId': teacherId},
      );

      if (groupCheck.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final lessonsResult = await connection.execute(
        Sql.named('''
          SELECT l.id, l.start_time::date as lesson_date, 
                 l.start_time::time as start_time, l.duration_minutes, 
                 l.class_name, h.name as hall_name, l.is_cancelled
          FROM lessons l
          LEFT JOIN halls h ON h.id = l.hall_id
          WHERE l.group_id = @groupId
          ORDER BY l.start_time DESC
          LIMIT 20
        '''),
        parameters: {'groupId': groupIdInt},
      );

      final lessons = <Map<String, dynamic>>[];
      
      for (final lessonRow in lessonsResult) {
        final lessonId = lessonRow[0] as int;
        
        
        final attendanceResult = await connection.execute(
          Sql.named('''
            SELECT ar.id, s.user_id as student_user_id, u.name as student_name, 
                   ar.attended, ar.status, ar.recorded_at
            FROM attendance_records ar
            JOIN students s ON s.id = ar.student_id
            JOIN users u ON u.id = s.user_id
            WHERE ar.group_id = @groupId 
              AND ar.lesson_date = @lessonDate
            ORDER BY u.name
          '''),
          parameters: {
            'groupId': groupIdInt, 
            'lessonDate': lessonRow[1].toString()
          },
        );

        final attendanceRecords = attendanceResult.map((row) => {
          'id': row[0],
          'student_id': row[1], 
          'student_name': row[2],
          'attended': row[3],
          'status': row[4],
          'recorded_at': row[5].toString(),
        }).toList();

        lessons.add({
          'id': lessonId,
          'lesson_date': lessonRow[1].toString(),
          'start_time': lessonRow[2].toString(),
          'duration_minutes': lessonRow[3],
          'class_name': lessonRow[4] ?? 'Урок танцев',
          'hall_name': lessonRow[5] ?? 'Зал не указан',
          'is_cancelled': lessonRow[6] ?? false,
          'attendance_records': attendanceRecords,
        });
      }

      return Response.ok(
        jsonEncode({'lessons': lessons}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch group lessons: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _updateAttendance(Request req, String lessonId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final lessonIdInt = int.tryParse(lessonId);
      if (lessonIdInt == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Invalid lesson ID'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;
      final studentUserId = data['student_id'] as int?; 
      final status = data['status']?.toString();
      final attended = data['attended'] as bool? ?? false;

      if (studentUserId == null || status == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Missing student_id or status'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final studentResult = await connection.execute(
        Sql.named('SELECT id FROM students WHERE user_id = @userId'),
        parameters: {'userId': studentUserId},
      );

      if (studentResult.isEmpty) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Student not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final studentId = studentResult.first[0] as int;

      
      final lessonInfo = await connection.execute(
        Sql.named('''
          SELECT l.group_id, l.start_time::date as lesson_date, g.main_teacher_id
          FROM lessons l
          JOIN groups g ON g.id = l.group_id
          WHERE l.id = @lessonId
        '''),
        parameters: {'lessonId': lessonIdInt},
      );

      if (lessonInfo.isEmpty) {
        return Response.notFound(
          jsonEncode({'error': 'Lesson not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final lessonRow = lessonInfo.first;
      final groupId = lessonRow[0] as int;
      final lessonDate = lessonRow[1];
      final mainTeacherId = lessonRow[2] as int;

      
      final teacherCheck = await connection.execute(
        Sql.named('SELECT id FROM teachers WHERE user_id = @userId AND id = @teacherId'),
        parameters: {'userId': userData['id'], 'teacherId': mainTeacherId},
      );

      if (teacherCheck.isEmpty) {
        return Response.forbidden(
          jsonEncode({'error': 'Access denied to this lesson'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      await connection.execute(
        Sql.named('''
          INSERT INTO attendance_records (group_id, student_id, teacher_id, attended, status, lesson_date, recorded_at)
          VALUES (@groupId, @studentId, @teacherId, @attended, @status, @lessonDate, NOW())
          ON CONFLICT (group_id, student_id, lesson_date) 
          DO UPDATE SET 
            attended = @attended, 
            status = @status, 
            teacher_id = @teacherId,
            recorded_at = NOW()
        '''),
        parameters: {
          'groupId': groupId,
          'studentId': studentId,
          'teacherId': mainTeacherId,
          'attended': attended,
          'status': status,
          'lessonDate': lessonDate.toString(),
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Attendance updated successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to update attendance: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to update attendance'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _submitRescheduleRequest(Request request) async {
    final user = request.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'teacher') {
      return Response.forbidden(
        jsonEncode({'error': 'Only teachers may submit reschedule requests'}),
        headers: {'content-type': 'application/json'},
      );
    }
    
    try {
      final body = await request.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;
      
      final groupId = data['group_id'];
      final originalStartTime = data['original_start_time'];
      final newStartTime = data['new_start_time'];
      final reason = data['reason'] ?? '';
      
      if (groupId == null || originalStartTime == null || newStartTime == null) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Missing required fields'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final lessonResult = await connection.execute(
        Sql.named('''
          SELECT id FROM lessons 
          WHERE group_id = @group_id 
          AND teacher_id = @teacher_id
          AND start_time = @original_start_time
          LIMIT 1
        '''),
        parameters: {
          'group_id': groupId,
          'teacher_id': user['id'],
          'original_start_time': originalStartTime,
        },
      );

      if (lessonResult.isEmpty) {
        return Response.badRequest(
          body: jsonEncode({'error': 'Lesson not found or you are not authorized to reschedule it'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final lessonId = lessonResult.first[0];

      await connection.execute(
        Sql.named('''
          INSERT INTO reschedule_requests (
            lesson_id, requested_by, original_start_time, 
            new_start_time, reason
          ) VALUES (
            @lesson_id, @requested_by, @original_start_time,
            @new_start_time, @reason
          )
        '''),
        parameters: {
          'lesson_id': lessonId,
          'requested_by': user['id'],
          'original_start_time': originalStartTime,
          'new_start_time': newStartTime,
          'reason': reason,
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Reschedule request submitted successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to submit reschedule request: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to submit reschedule request'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }
}
