import 'dart:convert';

import 'package:postgres/postgres.dart' show Sql;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../db/connection.dart';

class AdminRoute {
  Router get router {
    final router = Router();

    router.get('/admin/analytics', _analytics);
    router.get('/admin/analytics/halls', _hallAnalytics);
    router.get('/admin/analytics/teachers', _teacherAnalytics);
    router.get('/admin/analytics/groups', _groupAnalytics);
    router.get('/admin/analytics/students', _studentsAnalytics);
    router.get('/admin/halls/<hallId>/schedule', _hallSchedule);
    router.post('/admin/notifications/<notificationId>/read', _markNotificationAsRead);
    router.get('/admin/groups', _getGroups);
    router.get('/admin/lessons', _getLessons);
    router.get('/admin/groups/<groupId>', _getGroupDetails);
    router.get('/admin/students', _getAllStudents);
    router.get('/admin/halls', _getAllHalls);
    router.get('/admin/teachers', _getAllTeachers);
    router.get('/admin/teachers/<teacherId>/schedules', _getTeacherSchedules);
    router.post('/admin/groups', _createGroup);
    router.put('/admin/groups/<groupId>', _updateGroup);
    router.post('/admin/groups/<groupId>/students', _addStudentToGroup);
    router.post('/admin/halls', _createHall);
    router.post('/admin/students', _createStudent);
    router.post('/admin/teachers', _createTeacher);
    router.post('/admin/groups/<groupId>/limit', _updateGroupLimit);
    router.post('/admin/teachers/<teacherId>/groups/<groupId>', _assignTeacherToGroup);
    router.delete('/admin/groups/<groupId>/students/<studentId>', _removeStudentFromGroup);
    router.post('/admin/additional-lessons/<exceptionId>/decision', _decideAdditionalLesson);
    router.get('/admin/groups/<groupId>/students', _getGroupStudents);
    router.post('/admin/groups/<groupId>/attendance', _saveAttendance);
    
    
    router.post('/admin/lessons', _createLesson);
    router.put('/admin/lessons/<lessonId>', _updateLesson);
    router.delete('/admin/lessons/<lessonId>', _deleteLesson);
    router.post('/admin/lessons/<groupId>/substitute', _substituteLessonTeacher);
    router.post('/admin/lessons/<groupId>/cancel', _cancelLesson);
    router.post('/admin/lessons/<groupId>/reschedule', _rescheduleLesson);
    
    
    router.get('/admin/reschedule-requests', _getRescheduleRequests);
    router.post('/admin/reschedule-requests/<requestId>/approve', _approveRescheduleRequest);
    router.post('/admin/reschedule-requests/<requestId>/reject', _rejectRescheduleRequest);

    return router;
  }

  Future<Response> _hallAnalytics(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      
      final hallRows = await connection.execute('''
        SELECT
          h.id,
          h.name,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 1 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS monday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 2 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS tuesday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 3 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS wednesday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 4 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS thursday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 5 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS friday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 6 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS saturday_hours,
          COALESCE(SUM(CASE 
            WHEN EXTRACT(DOW FROM g.start_time) = 0 
            THEN COALESCE(g.duration_minutes, 90) / 60.0 
            ELSE 0 
          END), 0) AS sunday_hours
        FROM halls h
        LEFT JOIN groups g ON g.hall_id = h.id AND g.is_closed = FALSE AND g.start_time IS NOT NULL
        GROUP BY h.id, h.name
        ORDER BY h.id;
      ''');

      final halls = hallRows.map((row) {
        final monday = row[2] is num ? (row[2] as num).toDouble() : double.tryParse(row[2].toString()) ?? 0.0;
        final tuesday = row[3] is num ? (row[3] as num).toDouble() : double.tryParse(row[3].toString()) ?? 0.0;
        final wednesday = row[4] is num ? (row[4] as num).toDouble() : double.tryParse(row[4].toString()) ?? 0.0;
        final thursday = row[5] is num ? (row[5] as num).toDouble() : double.tryParse(row[5].toString()) ?? 0.0;
        final friday = row[6] is num ? (row[6] as num).toDouble() : double.tryParse(row[6].toString()) ?? 0.0;
        final saturday = row[7] is num ? (row[7] as num).toDouble() : double.tryParse(row[7].toString()) ?? 0.0;
        final sunday = row[8] is num ? (row[8] as num).toDouble() : double.tryParse(row[8].toString()) ?? 0.0;
        final total = monday + tuesday + wednesday + thursday + friday + saturday + sunday;

        return {
          'hallId': row[0],
          'hallName': row[1],
          'monday': monday.round(),
          'tuesday': tuesday.round(),
          'wednesday': wednesday.round(),
          'thursday': thursday.round(),
          'friday': friday.round(),
          'saturday': saturday.round(),
          'sunday': sunday.round(),
          'total': total.round(),
        };
      }).toList();

      return Response.ok(
        jsonEncode({'halls': halls}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load hall analytics: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load analytics'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _teacherAnalytics(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      
      
      final teacherRows = await connection.execute('''
        SELECT
          t.id,
          u.name,
          COALESCE(SUM(DISTINCT g.duration_minutes), 0) / 60.0 AS total_hours_per_week,
          COUNT(DISTINCT gs.student_id) AS student_count
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN groups g ON 
          (g.main_teacher_id = t.id OR EXISTS (
            SELECT 1 FROM group_teachers gt 
            WHERE gt.group_id = g.id AND gt.teacher_id = t.id
          ))
          AND g.is_closed = FALSE 
          AND g.start_time IS NOT NULL
        LEFT JOIN group_students gs ON gs.group_id = g.id AND gs.is_trial = FALSE
        GROUP BY t.id, u.name
        ORDER BY total_hours_per_week DESC;
      ''');

      final teachers = teacherRows.map((row) {
        final hoursValue = row[2];
        final totalHours = hoursValue is num 
          ? hoursValue.toDouble() 
          : (hoursValue is String ? double.tryParse(hoursValue) ?? 0.0 : 0.0);
        final studentCount = row[3] is int ? row[3] as int : 0;

        return {
          'teacherId': row[0],
          'teacherName': row[1],
          'totalHours': totalHours.round(),
          'studentCount': studentCount,
        };
      }).toList();

      return Response.ok(
        jsonEncode({'teachers': teachers}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load teacher analytics: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load analytics'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _groupAnalytics(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      
      final groupRows = await connection.execute('''
        SELECT
          g.id,
          g.name,
          CASE 
            WHEN COUNT(ar.id) = 0 THEN NULL
            ELSE AVG(CASE WHEN ar.attended THEN 100.0 ELSE 0.0 END)
          END AS avg_attendance
        FROM groups g
        LEFT JOIN attendance_records ar ON ar.group_id = g.id
        WHERE g.is_closed = FALSE AND g.is_additional = FALSE
        GROUP BY g.id, g.name
        ORDER BY g.id;
      ''');

      final groups = [];
      
      for (final row in groupRows) {
        final groupId = row[0] as int;
        final groupName = row[1] as String;
        final avgAttendanceValue = row[2];
        final avgAttendance = avgAttendanceValue != null
          ? (avgAttendanceValue is num 
              ? avgAttendanceValue.toDouble() 
              : double.tryParse(avgAttendanceValue.toString()) ?? 0.0)
          : 0.0;

        
        final monthlyRows = await connection.execute(
          Sql.named('''
            SELECT
              EXTRACT(MONTH FROM ar.recorded_at) AS month_num,
              AVG(CASE WHEN ar.attended THEN 100.0 ELSE 0.0 END) AS attendance,
              COUNT(DISTINCT gs.student_id) AS student_count
            FROM attendance_records ar
            JOIN group_students gs ON gs.group_id = ar.group_id AND gs.student_id = ar.student_id
            WHERE ar.group_id = @groupId
            GROUP BY EXTRACT(MONTH FROM ar.recorded_at)
            ORDER BY month_num;
          '''),
          parameters: {'groupId': groupId},
        );

        
        final monthlyDataMap = <int, Map<String, dynamic>>{};
        for (final monthRow in monthlyRows) {
          final monthValue = monthRow[0];
          final monthNum = monthValue is num 
            ? monthValue.toInt() 
            : int.tryParse(monthValue.toString()) ?? 1;
          final attendanceValue = monthRow[1];
          final attendance = attendanceValue is num 
            ? attendanceValue.toInt() 
            : int.tryParse(attendanceValue.toString()) ?? 0;
          final studentValue = monthRow[2];
          final studentCount = studentValue is num 
            ? studentValue.toInt() 
            : int.tryParse(studentValue.toString()) ?? 0;
          
          monthlyDataMap[monthNum] = {
            'month': _getMonthName(monthNum),
            'attendance': attendance,
            'studentCount': studentCount,
          };
        }

        
        final monthlyData = List.generate(12, (index) {
          final monthNum = index + 1;
          return monthlyDataMap[monthNum] ?? {
            'month': _getMonthName(monthNum),
            'attendance': 0,
            'studentCount': 0,
          };
        });

        groups.add({
          'groupId': groupId,
          'groupName': groupName,
          'avgAttendance': avgAttendance.round(),
          'monthlyData': monthlyData,
        });
      }

      return Response.ok(
        jsonEncode({'groups': groups}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load group analytics: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load analytics'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  String _getMonthName(int month) {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[month - 1];
  }

  Future<Response> _analytics(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final hallRows = await connection.execute('''
        SELECT
          h.id,
          h.name,
          h.capacity,
          COUNT(DISTINCT g.id) FILTER (WHERE g.is_additional = FALSE) AS regular_groups,
          COUNT(DISTINCT se.id) FILTER (WHERE se.additional = TRUE AND se.approved = TRUE) AS additional_lessons
        FROM halls h
        LEFT JOIN groups g ON g.hall_id = h.id
        LEFT JOIN schedule_exceptions se ON se.hall_id = h.id
        GROUP BY h.id, h.name, h.capacity
        ORDER BY h.id;
      ''');

      final studentAttendanceRows = await connection.execute('''
        SELECT
          g.id,
          g.name,
          CASE WHEN COUNT(ar.id) = 0 THEN NULL
               ELSE AVG(CASE WHEN ar.attended THEN 1 ELSE 0 END)
          END AS avg_attendance
        FROM groups g
        LEFT JOIN attendance_records ar ON ar.group_id = g.id
        GROUP BY g.id, g.name
        ORDER BY g.id;
      ''');

      final teacherAttendanceRows = await connection.execute('''
        SELECT
          t.id,
          u.name,
          CASE WHEN COUNT(ar.id) = 0 THEN NULL
               ELSE AVG(CASE WHEN ar.teacher_present THEN 1 ELSE 0 END)
          END AS avg_presence
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN attendance_records ar ON ar.teacher_id = t.id
        GROUP BY t.id, u.name
        ORDER BY t.id;
      ''');

      final analytics = {
        'halls': hallRows
            .map((row) => {
                  'id': row[0],
                  'name': row[1],
                  'capacity': row[2],
                  'regular_groups': row[3],
                  'additional_lessons': row[4],
                })
            .toList(),
        'student_attendance': studentAttendanceRows
            .map((row) => {
                  'group_id': row[0],
                  'group_name': row[1],
                  'average_attendance': (row[2] as num?)?.toDouble(),
                })
            .toList(),
        'teacher_attendance': teacherAttendanceRows
            .map((row) => {
                  'teacher_id': row[0],
                  'teacher_name': row[1],
                  'average_presence': (row[2] as num?)?.toDouble(),
                })
            .toList(),
      };

      return Response.ok(
        jsonEncode(analytics),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load analytics: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to build analytics'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _hallSchedule(Request req, String hallIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final hallId = int.tryParse(hallIdParam);
    if (hallId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid hall id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final groupsRows = await connection.execute(
        Sql.named('''
          SELECT id, name, class_name, start_time, duration_minutes, is_additional, is_closed
          FROM groups
          WHERE hall_id = @hallId
          ORDER BY start_time NULLS LAST, id;
        '''),
        parameters: {'hallId': hallId},
      );

      final extraRows = await connection.execute(
        Sql.named('''
          SELECT id, group_id, start_time, duration_minutes, additional, approved, requested_by_student
          FROM schedule_exceptions
          WHERE hall_id = @hallId
          ORDER BY start_time NULLS LAST, id;
        '''),
        parameters: {'hallId': hallId},
      );

      final schedule = {
        'hall_id': hallId,
        'groups': groupsRows
            .map((row) => {
                  'id': row[0],
                  'name': row[1],
                  'class_name': row[2],
                  'start_time': row[3]?.toString(),
                  'duration_minutes': row[4],
                  'is_additional': row[5],
                  'is_closed': row[6],
                })
            .toList(),
        'exceptions': extraRows
            .map((row) => {
                  'id': row[0],
                  'group_id': row[1],
                  'start_time': row[2]?.toString(),
                  'duration_minutes': row[3],
                  'is_additional': row[4],
                  'approved': row[5],
                  'requested_by_student': row[6],
                })
            .toList(),
      };

      return Response.ok(
        jsonEncode(schedule),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load hall schedule: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to load hall schedule'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _createGroup(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;

      final name = data['name']?.toString();
      final startTimeStr = data['start_time']?.toString();
      
      final hallId = data['hall_id'] == null ? null : int.tryParse(data['hall_id'].toString());
      final capacity = data['capacity'] == null ? null : int.tryParse(data['capacity'].toString());
      final isAdditional = data['is_additional'] == true;
      final isClosed = data['is_closed'] == true;
      final mainTeacherId = data['main_teacher_id'] == null ? null : int.tryParse(data['main_teacher_id'].toString());

      if (name == null || startTimeStr == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'name and start_time are required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final startTime = DateTime.tryParse(startTimeStr);
      if (startTime == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'start_time must be a valid ISO8601 timestamp'}),
          headers: {'content-type': 'application/json'},
        );
      }

  
  final duration = 90;
      final cap = capacity;

      
      if (hallId != null) {
        final h = await connection.execute(
          Sql.named('SELECT id FROM halls WHERE id = @hallId'),
          parameters: {'hallId': hallId},
        );
        if (h.isEmpty) {
          return Response(
            400,
            body: jsonEncode({'error': 'Referenced hall_id not found'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }
      if (mainTeacherId != null) {
        final t = await connection.execute(
          Sql.named('SELECT id FROM teachers WHERE id = @teacherId'),
          parameters: {'teacherId': mainTeacherId},
        );
        if (t.isEmpty) {
          return Response(
            400,
            body: jsonEncode({'error': 'Referenced main_teacher_id not found'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }

      
      final endTime = startTime.add(Duration(minutes: duration));
      if (hallId != null) {
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
            body: jsonEncode({'error': 'Referenced hall not available at requested time'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }

      final rows = await connection.execute(
        Sql.named('''
          INSERT INTO groups (name, start_time, duration_minutes, hall_id, capacity, is_additional, is_closed, main_teacher_id)
          VALUES (@name, @startTime, @duration, @hallId, @capacity, @isAdditional, @isClosed, @mainTeacherId)
          RETURNING id, name, start_time, duration_minutes, hall_id, capacity, is_additional, is_closed, main_teacher_id;
        '''),
        parameters: {
          'name': name,
          'startTime': startTime,
          'duration': duration,
          'hallId': hallId,
          'capacity': cap,
          'isAdditional': isAdditional,
          'isClosed': isClosed,
          'mainTeacherId': mainTeacherId,
        },
      );

      if (rows.isEmpty) {
        return Response.internalServerError(
          body: jsonEncode({'error': 'Failed to create group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final row = rows.first;
      final created = {
        'id': row[0],
        'name': row[1],
        'start_time': row[2]?.toString(),
        'duration_minutes': row[3],
        'hall_id': row[4],
        'capacity': row[5],
        'is_additional': row[6],
        'is_closed': row[7],
        'main_teacher_id': row[8],
      };

      return Response.ok(
        jsonEncode({'message': 'Group created', 'group': created}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to create group: $e');
      print(st);
      
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to create group', 'detail': e.toString()}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _createHall(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty ? <String, dynamic>{} : jsonDecode(body) as Map<String, dynamic>;
      final name = data['name']?.toString();
      final capacity = int.tryParse(data['capacity']?.toString() ?? '');

      if (name == null || capacity == null || capacity <= 0) {
        return Response(
          400,
          body: jsonEncode({'error': 'name and capacity (positive integer) are required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final rows = await connection.execute(
        Sql.named('''
          INSERT INTO halls (name, capacity)
          VALUES (@name, @capacity)
          ON CONFLICT (name) DO UPDATE SET capacity = EXCLUDED.capacity
          RETURNING id, name, capacity;
        '''),
        parameters: {'name': name, 'capacity': capacity},
      );

      if (rows.isEmpty) {
        return Response.internalServerError(
          body: jsonEncode({'error': 'Failed to create hall'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final row = rows.first;
      return Response.ok(
        jsonEncode({'message': 'Hall created', 'hall': {'id': row[0], 'name': row[1], 'capacity': row[2]}}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to create hall: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to create hall', 'detail': e.toString()}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _createTeacher(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty ? <String, dynamic>{} : jsonDecode(body) as Map<String, dynamic>;

      int? userId;
      if (data['user_id'] != null) {
        userId = int.tryParse(data['user_id'].toString());
        if (userId == null) {
          return Response(400, body: jsonEncode({'error': 'user_id must be an integer'}), headers: {'content-type': 'application/json'});
        }
        
        final u = await connection.execute(Sql.named('SELECT id FROM users WHERE id = @id'), parameters: {'id': userId});
        if (u.isEmpty) {
          return Response(400, body: jsonEncode({'error': 'Referenced user_id not found'}), headers: {'content-type': 'application/json'});
        }
      } else {
        final name = data['name']?.toString();
        final email = data['email']?.toString();
        final password = data['password']?.toString();
        if (name == null || email == null || password == null) {
          return Response(400, body: jsonEncode({'error': 'Either user_id or name,email,password must be provided'}), headers: {'content-type': 'application/json'});
        }
        
        await connection.execute(Sql.named('''
          INSERT INTO users (name, email, password, role)
          VALUES (@name, @email, @password, 'teacher')
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password
        '''), parameters: {'name': name, 'email': email, 'password': password});

        final created = await connection.execute(Sql.named('SELECT id FROM users WHERE email = @email'), parameters: {'email': email});
        userId = created.first[0] as int;
      }

      
      final t = await connection.execute(Sql.named('''
        INSERT INTO teachers (user_id)
        VALUES (@userId)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id, user_id;
      '''), parameters: {'userId': userId});

      if (t.isEmpty) {
        
        final existing = await connection.execute(Sql.named('SELECT id, user_id FROM teachers WHERE user_id = @userId'), parameters: {'userId': userId});
        if (existing.isEmpty) {
          return Response.internalServerError(body: jsonEncode({'error': 'Failed to create or locate teacher'}), headers: {'content-type': 'application/json'});
        }
        final row = existing.first;
        return Response.ok(jsonEncode({'message': 'Teacher exists', 'teacher': {'id': row[0], 'user_id': row[1]}}), headers: {'content-type': 'application/json'});
      }

      final row = t.first;
      return Response.ok(jsonEncode({'message': 'Teacher created', 'teacher': {'id': row[0], 'user_id': row[1]}}), headers: {'content-type': 'application/json'});
    } catch (e, st) {
      print('❌ Failed to create teacher: $e');
      print(st);
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to create teacher', 'detail': e.toString()}), headers: {'content-type': 'application/json'});
    }
  }

  
  Future<Response> _createStudent(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty ? <String, dynamic>{} : jsonDecode(body) as Map<String, dynamic>;

      int? userId;
      final parentPhone = data['parent_phone']?.toString();
      if (parentPhone == null || parentPhone.isEmpty) {
        return Response(400, body: jsonEncode({'error': 'parent_phone is required'}), headers: {'content-type': 'application/json'});
      }

      if (data['user_id'] != null) {
        userId = int.tryParse(data['user_id'].toString());
        if (userId == null) {
          return Response(400, body: jsonEncode({'error': 'user_id must be an integer'}), headers: {'content-type': 'application/json'});
        }
        final u = await connection.execute(Sql.named('SELECT id FROM users WHERE id = @id'), parameters: {'id': userId});
        if (u.isEmpty) {
          return Response(400, body: jsonEncode({'error': 'Referenced user_id not found'}), headers: {'content-type': 'application/json'});
        }
  
  await connection.execute(Sql.named("UPDATE users SET role = 'student' WHERE id = @id"), parameters: {'id': userId});
      } else {
        final name = data['name']?.toString();
        final email = data['email']?.toString();
        final password = data['password']?.toString();
        if (name == null || email == null || password == null) {
          return Response(400, body: jsonEncode({'error': 'Either user_id or name,email,password must be provided'}), headers: {'content-type': 'application/json'});
        }

        
        await connection.execute(Sql.named('''
          INSERT INTO users (name, email, password, role)
          VALUES (@name, @email, @password, 'student')
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = 'student'
        '''), parameters: {'name': name, 'email': email, 'password': password});

        final created = await connection.execute(Sql.named('SELECT id FROM users WHERE email = @email'), parameters: {'email': email});
        userId = created.first[0] as int;
      }

      
      final s = await connection.execute(Sql.named('''
        INSERT INTO students (user_id, parent_phone, comment)
        VALUES (@userId, @parentPhone, @comment)
        ON CONFLICT (user_id) DO UPDATE SET parent_phone = EXCLUDED.parent_phone, comment = COALESCE(EXCLUDED.comment, students.comment)
        RETURNING id, user_id, parent_phone, comment, trial_used, subscription_until
      '''), parameters: {'userId': userId, 'parentPhone': parentPhone, 'comment': data['comment']?.toString()});

      final row = s.first;
      return Response.ok(jsonEncode({'message': 'Student created/updated', 'student': {'id': row[0], 'user_id': row[1], 'parent_phone': row[2], 'comment': row[3], 'trial_used': row[4], 'subscription_until': row[5]?.toString()}}), headers: {'content-type': 'application/json'});
    } catch (e, st) {
      print('❌ Failed to create student: $e');
      print(st);
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to create student', 'detail': e.toString()}), headers: {'content-type': 'application/json'});
    }
  }

  Future<Response> _updateGroupLimit(Request req, String groupIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
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
      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;
      final capacity = int.tryParse(data['capacity']?.toString() ?? '');

      if (capacity == null || capacity <= 0) {
        return Response(
          400,
          body: jsonEncode({'error': 'capacity must be a positive integer'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final updated = await connection.execute(
        Sql.named('UPDATE groups SET capacity = @capacity WHERE id = @groupId'),
        parameters: {'capacity': capacity, 'groupId': groupId},
      );

      if (updated.affectedRows == 0) {
        return Response(
          404,
          body: jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      print('🛑 Updated capacity for group $groupId to $capacity');
      return Response.ok(
        jsonEncode({'message': 'Capacity updated'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to update group capacity: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to update capacity'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _assignTeacherToGroup(
    Request req,
    String teacherIdParam,
    String groupIdParam,
  ) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final teacherId = int.tryParse(teacherIdParam);
    final groupId = int.tryParse(groupIdParam);
    if (teacherId == null || groupId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid teacher or group id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      await connection.execute(
        Sql.named('''
          INSERT INTO group_teachers (group_id, teacher_id)
          VALUES (@groupId, @teacherId)
          ON CONFLICT DO NOTHING;
        '''),
        parameters: {'groupId': groupId, 'teacherId': teacherId},
      );

      print('👥 Assigned teacher $teacherId to group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Teacher assigned to group'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to assign teacher to group: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to assign teacher'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _removeStudentFromGroup(
    Request req,
    String groupIdParam,
    String studentIdParam,
  ) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
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
      final removed = await connection.execute(
        Sql.named('DELETE FROM group_students WHERE group_id = @groupId AND student_id = @studentId'),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );

      if (removed.affectedRows == 0) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student not found in group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      print('➖ Removed student $studentId from group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Student removed from group'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to remove student: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to remove student'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroups(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute('''
        SELECT
          g.id,
          g.name,
          g.class_name,
          g.hall_id,
          h.name AS hall_name,
          g.main_teacher_id AS teacher_id,
          u.name AS teacher_name,
          g.start_time,
          g.duration_minutes,
          g.capacity,
          g.is_closed,
          (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) AS student_count,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.group_id = g.id) AS attendance_count,
          g.recurring_days,
          g.recurring_until,
          g.schedule_json
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        LEFT JOIN teachers t ON t.id = g.main_teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY g.is_closed ASC, g.name ASC;
      ''');

      final groups = result.map((row) {
        final startTime = row[7];  
        final recurringDays = row[13]; 
        final scheduleJson = row[15]; 
        String schedule = 'Не указано';
        
        
        if (scheduleJson != null && scheduleJson.toString().trim().isNotEmpty) {
          try {
            final scheduleData = jsonDecode(scheduleJson.toString()) as Map<String, dynamic>;
            
            
            if (scheduleData.containsKey('startDate') && scheduleData.containsKey('weekdays')) {
              final weekdays = scheduleData['weekdays'] as Map<String, dynamic>;
              final startDate = scheduleData['startDate'] as String?;
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
                schedule = daySchedules.join(', ');
              }
            }
          } catch (e) {
            print('Error parsing schedule_json for group ${row[0]}: $e');
            
          }
        }
        
        
        if (schedule == 'Не указано' && startTime != null) {
          final dt = DateTime.parse(startTime.toString());
          final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          
          
          if (recurringDays != null && recurringDays.toString().isNotEmpty) {
            final days = recurringDays.toString().split(',');
            final dayNames = days.map((day) {
              switch (day.toLowerCase().trim()) {
                case 'monday': return 'Пн';
                case 'tuesday': return 'Вт';
                case 'wednesday': return 'Ср';
                case 'thursday': return 'Чт';
                case 'friday': return 'Пт';
                case 'saturday': return 'Сб';
                case 'sunday': return 'Вс';
                default: return day;
              }
            }).join(', ');
            
            
            String scheduleText = '$dayNames $time';
            if (row[14] != null && row[14].toString().isNotEmpty) {
              try {
                final untilDate = DateTime.parse(row[14].toString());
                final untilFormatted = '${untilDate.day.toString().padLeft(2, '0')}.${untilDate.month.toString().padLeft(2, '0')}.${untilDate.year}';
                scheduleText = '$dayNames $time (до $untilFormatted)';
              } catch (e) {
                
                scheduleText = '$dayNames $time';
              }
            }
            schedule = scheduleText;
          } else {
            final dayOfWeek = _getDayOfWeek(dt.weekday);
            schedule = '$dayOfWeek $time';
          }
        }

        final studentCountValue = row[11]; 
        final studentCount = studentCountValue is num
            ? studentCountValue.toInt()
            : int.tryParse(studentCountValue.toString()) ?? 0;

        final attendanceCountValue = row[12]; 
        final attendanceCount = attendanceCountValue is num
            ? attendanceCountValue.toInt()
            : int.tryParse(attendanceCountValue.toString()) ?? 0;

        final capacity = row[9]; 
        final limit = capacity is num
            ? capacity.toInt()
            : int.tryParse(capacity.toString()) ?? 0;

        final isClosed = row[10]; 
        final isActive = isClosed == false || isClosed == null;

        return {
          'id': row[0],
          'name': row[1],
          'class_name': row[2],
          'hallId': row[3], 
          'hallName': row[4] ?? 'Не указан', 
          'teacherId': row[5], 
          'teacherName': row[6] ?? 'Не назначен', 
          'schedule': schedule,
          'startTime': startTime?.toString(),
          'durationMinutes': row[8], 
          'recurringDays': recurringDays?.toString(),
          'recurringUntil': row[14]?.toString(), 
          'studentLimit': limit,
          'studentCount': studentCount,
          'attendanceCount': attendanceCount,
          'isActive': isActive,
        };
      }).toList();

      final stats = {
        'totalGroups': groups.length,
        'activeGroups': groups.where((g) => g['isActive'] == true).length,
        'totalStudents': groups.fold<int>(0, (sum, g) => sum + (g['studentCount'] as int)),
      };

      return Response.ok(
        jsonEncode({
          'groups': groups,
          'stats': stats,
        }),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load groups: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load groups'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getLessons(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute('''
        SELECT
          l.id as lesson_id,
          l.class_name,
          l.start_time,
          l.duration_minutes,
          l.is_cancelled,
          l.is_rescheduled,
          g.id as group_id,
          g.name as group_name,
          h.id as hall_id,
          h.name as hall_name,
          u.name as teacher_name,
          sub_u.name as substitute_teacher_name
        FROM lessons l
        JOIN groups g ON g.id = l.group_id
        LEFT JOIN halls h ON h.id = l.hall_id
        LEFT JOIN teachers t ON t.id = l.teacher_id
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN teachers sub_t ON sub_t.id = l.substitute_teacher_id
        LEFT JOIN users sub_u ON sub_u.id = sub_t.user_id
        WHERE l.start_time >= NOW() - INTERVAL '7 days'
        ORDER BY l.start_time ASC;
      ''');

      final lessons = result.map((row) {
        final startTime = row[2];
        String schedule = 'Не указано';
        
        if (startTime != null) {
          final dt = DateTime.parse(startTime.toString());
          final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          final dayOfWeek = _getDayOfWeek(dt.weekday);
          schedule = '$dayOfWeek $time';
        }

        return {
          'id': row[0],
          'class_name': row[1],
          'group_id': row[6],
          'group_name': row[7],
          'hall_id': row[8],
          'hall_name': row[9] ?? 'Не указан',
          'teacher_name': row[10] ?? 'Не назначен',
          'substitute_teacher_name': row[11],
          'schedule': schedule,
          'start_time': startTime?.toString(),
          'duration_minutes': row[3],
          'is_cancelled': row[4] ?? false,
          'is_rescheduled': row[5] ?? false,
        };
      }).toList();

      return Response.ok(
        jsonEncode({'lessons': lessons}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load lessons: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroupDetails(Request req, String groupIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
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
      
      final groupResult = await connection.execute(
        Sql.named('''
          SELECT
            g.id,
            g.name,
            g.hall_id,
            h.name AS hall_name,
            g.main_teacher_id AS teacher_id,
            u.name AS teacher_name,
            g.start_time,
            g.duration_minutes,
            g.capacity,
            g.is_closed,
            g.recurring_days,
            g.recurring_until,
            g.schedule_json
          FROM groups g
          LEFT JOIN halls h ON h.id = g.hall_id
          LEFT JOIN teachers t ON t.id = g.main_teacher_id
          LEFT JOIN users u ON u.id = t.user_id
          WHERE g.id = @groupId;
        '''),
        parameters: {'groupId': groupId},
      );

      if (groupResult.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final groupRow = groupResult.first;
      final startTime = groupRow[6];
      final recurringDays = groupRow[10];
      final recurringUntil = groupRow[11];
      final scheduleJson = groupRow[12];
      
      String schedule = 'Не указано';
      
      
      if (scheduleJson != null && scheduleJson.toString().trim().isNotEmpty) {
        try {
          final scheduleData = jsonDecode(scheduleJson.toString()) as Map<String, dynamic>;
          
          
          if (scheduleData.containsKey('startDate') && scheduleData.containsKey('weekdays')) {
            final weekdays = scheduleData['weekdays'] as Map<String, dynamic>;
            final startDate = scheduleData['startDate'] as String?;
            final endDate = scheduleData['endDate'] as String?;
            
            if (weekdays.isNotEmpty) {
              
              final daySchedules = <String>[];
              weekdays.forEach((day, time) {
                if (time != null && time.toString().trim().isNotEmpty) {
                  final dayName = _getDayOfWeekFromString(day);
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
            
            final scheduleEntries = scheduleData.entries.map((entry) {
              final dayName = _getDayOfWeekFromString(entry.key);
              return '$dayName ${entry.value}';
            }).toList();
            schedule = scheduleEntries.join(', ');
          }
        } catch (e) {
          print('Error parsing schedule_json: $e');
          schedule = 'Ошибка формата расписания';
        }
      } else if (startTime != null) {
        final dt = DateTime.parse(startTime.toString());
        final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
        
        
        if (recurringDays != null && recurringDays.toString().isNotEmpty) {
          final days = recurringDays.toString().split(',');
          final dayNames = days.map((day) {
            switch (day.toLowerCase().trim()) {
              case 'monday': return 'Пн';
              case 'tuesday': return 'Вт';
              case 'wednesday': return 'Ср';
              case 'thursday': return 'Чт';
              case 'friday': return 'Пт';
              case 'saturday': return 'Сб';
              case 'sunday': return 'Вс';
              default: return day;
            }
          }).join(', ');
          
          
          String scheduleText = '$dayNames $time';
          if (recurringUntil != null && recurringUntil.toString().isNotEmpty) {
            try {
              final untilDate = DateTime.parse(recurringUntil.toString());
              final untilFormatted = '${untilDate.day.toString().padLeft(2, '0')}.${untilDate.month.toString().padLeft(2, '0')}.${untilDate.year}';
              scheduleText = '$dayNames $time (до $untilFormatted)';
            } catch (e) {
              
              scheduleText = '$dayNames $time';
            }
          }
          schedule = scheduleText;
        } else {
          final dayOfWeek = _getDayOfWeek(dt.weekday);
          schedule = '$dayOfWeek $time';
        }
      }

      final capacity = groupRow[8];
      final limit = capacity is num
          ? capacity.toInt()
          : int.tryParse(capacity.toString()) ?? 0;

      final isClosed = groupRow[9];
      final isActive = isClosed == false || isClosed == null;

      
      final studentsResult = await connection.execute(
        Sql.named('''
          SELECT
            s.id,
            u.name,
            u.email,
            s.parent_phone,
            (SELECT COUNT(*) FROM attendance_records WHERE student_id = s.id AND group_id = @groupId) AS attendance_count
          FROM group_students gs
          JOIN students s ON s.id = gs.student_id
          JOIN users u ON u.id = s.user_id
          WHERE gs.group_id = @groupId
          ORDER BY u.name;
        '''),
        parameters: {'groupId': groupId},
      );

      final students = studentsResult.map((row) {
        final attendanceValue = row[4];
        final attendanceCount = attendanceValue is num
            ? attendanceValue.toInt()
            : int.tryParse(attendanceValue.toString()) ?? 0;

        return {
          'id': row[0],
          'name': row[1],
          'email': row[2],
          'phone': row[3]?.toString() ?? 'Не указано',
          'attendanceCount': attendanceCount,
        };
      }).toList();

      
      final attendanceResult = await connection.execute(
        Sql.named('''
          SELECT
            ar.recorded_at,
            COUNT(DISTINCT ar.student_id) AS present_count
          FROM attendance_records ar
          WHERE ar.group_id = @groupId
          GROUP BY ar.recorded_at
          ORDER BY ar.recorded_at DESC
          LIMIT 10;
        '''),
        parameters: {'groupId': groupId},
      );

      final attendance = attendanceResult.map((row) {
        final presentValue = row[1];
        final presentCount = presentValue is num
            ? presentValue.toInt()
            : int.tryParse(presentValue.toString()) ?? 0;

        return {
          'date': row[0]?.toString(),
          'presentCount': presentCount,
        };
      }).toList();

      return Response.ok(
        jsonEncode({
          'id': groupRow[0],
          'name': groupRow[1],
          'hallId': groupRow[2],
          'hallName': groupRow[3] ?? 'Не указан',
          'teacherId': groupRow[4],
          'teacherName': groupRow[5] ?? 'Не назначен',
          'schedule': schedule,
          'startTime': startTime?.toString(),
          'recurringDays': recurringDays?.toString(),
          'recurringUntil': recurringUntil?.toString(),
          'scheduleJson': scheduleJson?.toString(),
          'studentLimit': limit,
          'isActive': isActive,
          'students': students,
          'attendance': attendance,
        }),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load group details: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load group details'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _updateGroup(Request req, String groupIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
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
      final body = jsonDecode(await req.readAsString()) as Map<String, dynamic>;
      
      final updateFields = <String>[];
      final parameters = <String, dynamic>{'groupId': groupId};

      if (body.containsKey('name')) {
        updateFields.add('name = @name');
        parameters['name'] = body['name'];
      }

      if (body.containsKey('class_name')) {
        updateFields.add('class_name = @className');
        parameters['className'] = body['class_name'];
      }

      if (body.containsKey('hallId')) {
        updateFields.add('hall_id = @hallId');
        parameters['hallId'] = body['hallId'];
      }

      if (body.containsKey('startTime')) {
        final timeValue = body['startTime'];
        
        if (timeValue == null) {
          
          updateFields.add('start_time = NULL');
        } else {
          final timeString = timeValue as String;
          
          
          if (timeString.trim().isEmpty) {
            updateFields.add('start_time = NULL');
          } else {
            try {
              DateTime timestamp;
              
              if (timeString.contains('T') && timeString.contains('Z')) {
                
                timestamp = DateTime.parse(timeString);
              } else {
                
                final timeParts = timeString.split(':');
                
                if (timeParts.length != 2 || timeParts[0].trim().isEmpty || timeParts[1].trim().isEmpty) {
                  
                  updateFields.add('start_time = NULL');
                } else {
                  final hour = int.parse(timeParts[0].trim());
                  final minute = int.parse(timeParts[1].trim());
                  final now = DateTime.now();
                  timestamp = DateTime(now.year, now.month, now.day, hour, minute);
                  
                  updateFields.add('start_time = @startTime');
                  parameters['startTime'] = timestamp;
                }
              }
            } catch (e) {
              print('Error parsing startTime "$timeString": $e');
              
              updateFields.add('start_time = NULL');
            }
          }
        }
      }

      if (body.containsKey('durationMinutes')) {
        updateFields.add('duration_minutes = @durationMinutes');
        parameters['durationMinutes'] = body['durationMinutes'];
      }

      if (body.containsKey('capacity')) {
        updateFields.add('capacity = @capacity');
        parameters['capacity'] = body['capacity'];
      }

      if (body.containsKey('isActive')) {
        
        updateFields.add('is_closed = @isClosed');
        parameters['isClosed'] = !(body['isActive'] as bool);
      }

      if (body.containsKey('teacherId')) {
        updateFields.add('main_teacher_id = @teacherId');
        parameters['teacherId'] = body['teacherId'];
      }

      
      if (body.containsKey('recurring')) {
        final recurringValue = body['recurring'];
        if (recurringValue != null) {
          final recurring = recurringValue as Map<String, dynamic>;
          if (recurring['enabled'] == true && recurring['days'] != null) {
            
            final days = (recurring['days'] as List).join(',');
            updateFields.add('recurring_days = @recurringDays');
            parameters['recurringDays'] = days;
            
            if (recurring['until'] != null && recurring['until'].toString().isNotEmpty) {
              updateFields.add('recurring_until = @recurringUntil');
              parameters['recurringUntil'] = recurring['until'];
            } else {
              updateFields.add('recurring_until = NULL');
            }
          } else {
            
            updateFields.add('recurring_days = NULL');
            updateFields.add('recurring_until = NULL');
          }
        } else {
          
          updateFields.add('recurring_days = NULL');
          updateFields.add('recurring_until = NULL');
        }
      }

      
      if (body.containsKey('scheduleJson')) {
        final scheduleJson = body['scheduleJson'];
        if (scheduleJson != null && scheduleJson.toString().trim().isNotEmpty) {
          updateFields.add('schedule_json = @scheduleJson');
          parameters['scheduleJson'] = scheduleJson;
          
          
          if (!body.containsKey('startTime')) {
            updateFields.add('start_time = NULL');
          }
          if (!body.containsKey('recurring')) {
            updateFields.add('recurring_days = NULL');
            updateFields.add('recurring_until = NULL');
          }
        } else {
          
          updateFields.add('schedule_json = NULL');
          if (!body.containsKey('startTime')) {
            updateFields.add('start_time = NULL');
          }
          if (!body.containsKey('recurring')) {
            updateFields.add('recurring_days = NULL');
            updateFields.add('recurring_until = NULL');
          }
        }
      }

      if (updateFields.isEmpty) {
        return Response(
          400,
          body: jsonEncode({'error': 'No fields to update'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      print('🐛 UpdateFields: $updateFields');
      print('🐛 Parameters: $parameters');

      
      await connection.runTx((session) async {
        
        await session.execute(
          Sql.named('UPDATE groups SET ${updateFields.join(', ')} WHERE id = @groupId'),
          parameters: parameters,
        );

        
        if (body.containsKey('teacherId')) {
          final teacherId = body['teacherId'] as int;
          
          
          await session.execute(
            Sql.named('DELETE FROM group_teachers WHERE group_id = @groupId'),
            parameters: {'groupId': groupId},
          );
          
          
          await session.execute(
            Sql.named('INSERT INTO group_teachers (group_id, teacher_id) VALUES (@groupId, @teacherId)'),
            parameters: {'groupId': groupId, 'teacherId': teacherId},
          );
          
          print('✏️ Updated teacher assignment for group $groupId: teacher $teacherId');
        }
      });

      print('✏️ Updated group $groupId: ${body.keys.join(', ')}');
      return Response.ok(
        jsonEncode({'message': 'Group updated successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to update group: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to update group'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getAllStudents(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute('''
        SELECT
          s.id,
          u.name,
          u.email
        FROM students s
        JOIN users u ON u.id = s.user_id
        ORDER BY u.name;
      ''');

      final students = result.map((row) {
        return {
          'id': row[0],
          'name': row[1],
          'email': row[2],
        };
      }).toList();

      return Response.ok(
        jsonEncode({'students': students}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load students: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load students'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _addStudentToGroup(Request req, String groupIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
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
      final body = jsonDecode(await req.readAsString()) as Map<String, dynamic>;
      final studentIdOrUserId = body['studentId'] as int?;

      if (studentIdOrUserId == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'Student ID is required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      int actualStudentId = studentIdOrUserId;
      
      
      final directStudentCheck = await connection.execute(
        Sql.named('SELECT id FROM students WHERE id = @id'),
        parameters: {'id': studentIdOrUserId},
      );
      
      if (directStudentCheck.isEmpty) {
        
        final studentFromUser = await connection.execute(
          Sql.named('SELECT id FROM students WHERE user_id = @userId'),
          parameters: {'userId': studentIdOrUserId},
        );
        
        if (studentFromUser.isNotEmpty) {
          actualStudentId = studentFromUser.first[0] as int;
          print('📝 Converted user_id $studentIdOrUserId to student_id $actualStudentId');
        } else {
          return Response(
            400,
            body: jsonEncode({'error': 'Student not found'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }

      
      final existing = await connection.execute(
        Sql.named('SELECT 1 FROM group_students WHERE group_id = @groupId AND student_id = @studentId'),
        parameters: {'groupId': groupId, 'studentId': actualStudentId},
      );

      if (existing.isNotEmpty) {
        return Response(
          400,
          body: jsonEncode({'error': 'Student is already in this group'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      await connection.execute(
        Sql.named('INSERT INTO group_students (group_id, student_id) VALUES (@groupId, @studentId)'),
        parameters: {'groupId': groupId, 'studentId': actualStudentId},
      );

      print('➕ Added student $actualStudentId to group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Student added to group'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to add student to group: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to add student to group'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getAllHalls(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute('''
        SELECT
          id,
          name
        FROM halls
        ORDER BY name;
      ''');

      final halls = result.map((row) {
        return {
          'id': row[0],
          'name': row[1],
        };
      }).toList();

      return Response.ok(
        jsonEncode({'halls': halls}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load halls: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load halls'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getAllTeachers(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute('''
        SELECT
          t.id,
          u.name
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        ORDER BY u.name;
      ''');

      final teachers = result.map((row) {
        return {
          'id': row[0],
          'name': row[1],
        };
      }).toList();

      return Response.ok(
        jsonEncode({'teachers': teachers}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load teachers: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load teachers'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getTeacherSchedules(Request req, String teacherIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final teacherId = int.tryParse(teacherIdParam);
    if (teacherId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid teacher id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final result = await connection.execute(
        Sql.named('''
          SELECT
            g.id,
            g.name AS group_name,
            g.start_time,
            g.recurring_days,
            g.recurring_until,
            h.name AS hall_name
          FROM groups g
          LEFT JOIN halls h ON h.id = g.hall_id
          WHERE g.main_teacher_id = @teacherId
          AND g.is_closed = false
          ORDER BY g.start_time;
        '''),
        parameters: {'teacherId': teacherId},
      );

      final schedules = result.map((row) {
        final startTime = row[2];
        final recurringDays = row[3];
        final recurringUntil = row[4];
        final hallName = row[5] ?? 'Не указан';
        
        String schedule = 'Не указано';
        String timeOnly = 'Не указано';
        
        if (startTime != null) {
          final dt = DateTime.parse(startTime.toString());
          timeOnly = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          
          
          if (recurringDays != null && recurringDays.toString().isNotEmpty) {
            final days = recurringDays.toString().split(',');
            final dayNames = days.map((day) => _getDayOfWeekFromString(day.trim())).toList();
            schedule = '${dayNames.join(', ')} $timeOnly';
            
            
            if (recurringUntil != null) {
              final until = DateTime.parse(recurringUntil.toString());
              final untilFormatted = '${until.day.toString().padLeft(2, '0')}.${until.month.toString().padLeft(2, '0')}.${until.year}';
              schedule += ' (до $untilFormatted)';
            }
          } else {
            final dayName = _getDayOfWeekFromString(_getWeekdayFromDateTime(dt));
            schedule = '$dayName $timeOnly';
          }
        }

        return {
          'id': row[0],
          'groupName': row[1],
          'schedule': schedule,
          'timeOnly': timeOnly,
          'hallName': hallName,
          'startTime': startTime?.toString(),
          'recurringDays': recurringDays?.toString(),
          'recurringUntil': recurringUntil?.toString(),
        };
      }).toList();

      return Response.ok(
        jsonEncode({'schedules': schedules}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load teacher schedules: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load teacher schedules'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _decideAdditionalLesson(Request req, String exceptionIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final exceptionId = int.tryParse(exceptionIdParam);
    if (exceptionId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid additional lesson id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;
      final approved = data['approved'] == true;

      final updated = await connection.execute(
        Sql.named('UPDATE schedule_exceptions SET approved = @approved WHERE id = @id'),
        parameters: {'approved': approved, 'id': exceptionId},
      );

      if (updated.affectedRows == 0) {
        return Response(
          404,
          body: jsonEncode({'error': 'Additional lesson not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      print('✅ Additional lesson $exceptionId approval changed to $approved');
      return Response.ok(
        jsonEncode({'message': 'Decision recorded'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to update additional lesson decision: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to update additional lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _studentsAnalytics(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      
      final studentRows = await connection.execute('''
        SELECT
          s.id,
          u.name,
          u.email,
          s.parent_phone,
          s.subscription_until,
          u.created_at,
          COALESCE(
            (SELECT COUNT(*) FROM group_students gs WHERE gs.student_id = s.id AND gs.is_trial = FALSE),
            0
          ) AS lessons_remaining
        FROM students s
        JOIN users u ON u.id = s.user_id
        ORDER BY u.name;
      ''');

      final students = [];
      
      for (final row in studentRows) {
        final studentId = row[0] as int;
        final studentName = row[1] as String;
        final email = row[2] as String;
        final parentPhone = row[3] as String?;
        final subscriptionUntil = row[4]?.toString();
        final createdAt = row[5]?.toString();
        final lessonsRemaining = row[6] as int;

        
        final groupRows = await connection.execute(
          Sql.named('''
            SELECT
              g.id,
              g.name,
              u.name AS teacher_name,
              g.start_time,
              h.name AS hall_name,
              COALESCE(
                (SELECT AVG(CASE WHEN ar.attended THEN 100.0 ELSE 0.0 END)
                 FROM attendance_records ar
                 WHERE ar.group_id = g.id AND ar.student_id = @studentId),
                0
              ) AS attendance
            FROM group_students gs
            JOIN groups g ON g.id = gs.group_id
            LEFT JOIN teachers t ON t.id = g.main_teacher_id
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN halls h ON h.id = g.hall_id
            WHERE gs.student_id = @studentId AND g.is_closed = FALSE
            ORDER BY g.name;
          '''),
          parameters: {'studentId': studentId},
        );

        final groups = groupRows.map((groupRow) {
          final startTime = groupRow[3]?.toString();
          final dayOfWeek = startTime != null
              ? _getDayOfWeek(DateTime.parse(startTime).weekday)
              : '';
          final time = startTime != null
              ? DateTime.parse(startTime).toLocal().toString().substring(11, 16)
              : '';

          final attendanceValue = groupRow[5];
          final attendance = attendanceValue is num
              ? attendanceValue.toInt()
              : int.tryParse(attendanceValue.toString()) ?? 0;

          return {
            'groupName': groupRow[1],
            'teacher': groupRow[2] ?? 'Не указано',
            'schedule': '$dayOfWeek $time',
            'hall': groupRow[4] ?? 'Не указано',
            'attendance': attendance,
          };
        }).toList();

        final isActive = groups.isNotEmpty;

        students.add({
          'id': studentId,
          'name': studentName,
          'email': email,
          'phone': parentPhone ?? 'Не указано',
          'parentPhone': parentPhone ?? 'Не указано',
          'groups': groups,
          'lessonsRemaining': lessonsRemaining,
          'subscriptionUntil': subscriptionUntil,
          'isActive': isActive,
          'registeredAt': createdAt,
        });
      }

      
      final totalStudents = students.length;
      final activeStudents = students.where((s) => s['isActive'] == true).length;
      
      
      final now = DateTime.now();
      final thisMonthStart = DateTime(now.year, now.month, 1);
      final newThisMonth = students.where((s) {
        final registeredAt = s['registeredAt'];
        if (registeredAt == null) return false;
        final date = DateTime.parse(registeredAt);
        return date.isAfter(thisMonthStart);
      }).length;

      
      double totalAttendance = 0;
      int groupCount = 0;
      for (final student in students) {
        final groups = student['groups'] as List;
        for (final group in groups) {
          totalAttendance += (group['attendance'] as int).toDouble();
          groupCount++;
        }
      }
      final avgAttendance = groupCount > 0 ? (totalAttendance / groupCount).round() : 0;

      
      final recentRegistrations = await connection.execute('''
        SELECT
          s.id,
          u.name,
          u.email,
          s.parent_phone,
          u.created_at
        FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE u.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY u.created_at DESC;
      ''');

      final notifications = recentRegistrations.map((row) {
        return {
          'id': row[0],
          'type': 'new_student',
          'studentName': row[1],
          'email': row[2],
          'phone': row[3]?.toString() ?? 'Не указано',
          'timestamp': row[4]?.toString() ?? DateTime.now().toIso8601String(),
          'isRead': false,
        };
      }).toList();

      final stats = {
        'totalStudents': totalStudents,
        'activeStudents': activeStudents,
        'newThisMonth': newThisMonth,
        'avgAttendance': avgAttendance,
      };

      return Response.ok(
        jsonEncode({
          'students': students,
          'stats': stats,
          'notifications': notifications,
        }),
        headers: {'content-type': 'application/json'},
      );
    } catch (e, st) {
      print('❌ Failed to load students analytics: $e');
      print(st);
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load students analytics'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _markNotificationAsRead(Request req, String notificationIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    
    
    return Response.ok(
      jsonEncode({'message': 'Notification marked as read'}),
      headers: {'content-type': 'application/json'},
    );
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

  String _getDayOfWeekFromString(String dayName) {
    switch (dayName.toLowerCase()) {
      case 'monday':
        return 'Пн';
      case 'tuesday':
        return 'Вт';
      case 'wednesday':
        return 'Ср';
      case 'thursday':
        return 'Чт';
      case 'friday':
        return 'Пт';
      case 'saturday':
        return 'Сб';
      case 'sunday':
        return 'Вс';
      default:
        return '';
    }
  }

  String _getWeekdayFromDateTime(DateTime dt) {
    switch (dt.weekday) {
      case 1:
        return 'monday';
      case 2:
        return 'tuesday';
      case 3:
        return 'wednesday';
      case 4:
        return 'thursday';
      case 5:
        return 'friday';
      case 6:
        return 'saturday';
      case 7:
        return 'sunday';
      default:
        return '';
    }
  }

  Future<Response> _getGroupStudents(Request req, String groupId) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      
      final lessonDate = req.url.queryParameters['lessonDate'] ?? 
        DateTime.now().toIso8601String().split('T')[0];

      print('🔍 Fetching students for group: $groupId, date: $lessonDate');

      final result = await connection.execute(
        Sql.named('''
          SELECT DISTINCT ON (s.id)
            s.id,
            u.name,
            u.email,
            s.parent_phone,
            ar.status
          FROM group_students gs
          JOIN students s ON s.id = gs.student_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN attendance_records ar ON ar.student_id = s.id 
            AND ar.group_id = @groupId 
            AND ar.lesson_date = @lessonDate
          WHERE gs.group_id = @groupId AND gs.is_trial = FALSE
          ORDER BY s.id, u.name;
        '''),
        parameters: {
          'groupId': int.parse(groupId),
          'lessonDate': lessonDate,
        },
      );

      print('📊 Query returned ${result.length} students');

      final students = result.map((row) => {
        'id': row[0],
        'name': row[1],
        'email': row[2],
        'parentPhone': row[3],
        'attendance': row[4], 
      }).toList();

      print('✅ Students data: $students');

      return Response.ok(
        jsonEncode({'students': students}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error fetching group students: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch students'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _saveAttendance(Request req, String groupId) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = jsonDecode(await req.readAsString()) as Map<String, dynamic>;
      final attendanceList = body['attendance'] as List<dynamic>;
      final lessonDate = body['lessonDate'] as String?;

      
      final groupResult = await connection.execute(
        Sql.named('SELECT main_teacher_id FROM groups WHERE id = @groupId'),
        parameters: {'groupId': int.parse(groupId)},
      );

      if (groupResult.isEmpty) {
        return Response.notFound(
          jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = groupResult.first[0];
      final actualLessonDate = lessonDate ?? DateTime.now().toIso8601String().split('T')[0];

      
      for (var record in attendanceList) {
        final studentId = record['studentId'] as int;
        final status = record['status'] as String; 
        final attended = status == 'P' || status == 'E'; 

        
        final existingRecord = await connection.execute(
          Sql.named('''
            SELECT id FROM attendance_records 
            WHERE group_id = @groupId 
              AND student_id = @studentId 
              AND lesson_date = @lessonDate
          '''),
          parameters: {
            'groupId': int.parse(groupId),
            'studentId': studentId,
            'lessonDate': actualLessonDate,
          },
        );

        if (existingRecord.isNotEmpty) {
          
          await connection.execute(
            Sql.named('''
              UPDATE attendance_records 
              SET attended = @attended, 
                  status = @status, 
                  teacher_id = @teacherId,
                  recorded_at = NOW()
              WHERE group_id = @groupId 
                AND student_id = @studentId 
                AND lesson_date = @lessonDate
            '''),
            parameters: {
              'groupId': int.parse(groupId),
              'studentId': studentId,
              'teacherId': teacherId,
              'attended': attended,
              'status': status,
              'lessonDate': actualLessonDate,
            },
          );
        } else {
          
          await connection.execute(
            Sql.named('''
              INSERT INTO attendance_records 
                (group_id, student_id, teacher_id, attended, status, lesson_date, teacher_present)
              VALUES 
                (@groupId, @studentId, @teacherId, @attended, @status, @lessonDate, true)
            '''),
            parameters: {
              'groupId': int.parse(groupId),
              'studentId': studentId,
              'teacherId': teacherId,
              'attended': attended,
              'status': status,
              'lessonDate': actualLessonDate,
            },
          );
        }
      }

      return Response.ok(
        jsonEncode({'success': true, 'message': 'Attendance saved successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error saving attendance: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to save attendance'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _substituteLessonTeacher(Request req, String groupId) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = jsonDecode(body);
      final substituteTeacherId = data['substituteTeacherId'];
      final lessonDate = data['lessonDate'];

      
      await connection.execute(
        Sql.named('''
          INSERT INTO schedule_exceptions (group_id, teacher_id, start_time, reason, additional)
          SELECT 
            @groupId, 
            @substituteTeacherId, 
            (@lessonDate::date + g.start_time::time)::timestamptz,
            'Substitute teacher assigned',
            false
          FROM groups g 
          WHERE g.id = @groupId
        '''),
        parameters: {
          'groupId': int.parse(groupId),
          'substituteTeacherId': int.parse(substituteTeacherId),
          'lessonDate': lessonDate,
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Substitute teacher assigned successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error assigning substitute: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to assign substitute teacher'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _cancelLesson(Request req, String groupId) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = jsonDecode(body);
      final lessonDate = data['lessonDate'];
      final reason = data['reason'] ?? 'Cancelled by admin';

      
      await connection.execute(
        Sql.named('''
          INSERT INTO schedule_exceptions (group_id, start_time, reason, additional)
          SELECT 
            @groupId, 
            (@lessonDate::date + g.start_time::time)::timestamptz,
            @reason,
            false
          FROM groups g 
          WHERE g.id = @groupId
        '''),
        parameters: {
          'groupId': int.parse(groupId),
          'lessonDate': lessonDate,
          'reason': reason,
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Lesson cancelled successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error cancelling lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to cancel lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _rescheduleLesson(Request req, String groupId) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = jsonDecode(body);
      final newDate = data['newDate'];
      final newTime = data['newTime'];
      final originalDate = data['originalDate'];

      
      await connection.execute(
        Sql.named('''
          INSERT INTO schedule_exceptions (group_id, start_time, reason, additional)
          VALUES (
            @groupId, 
            (@newDate::date + @newTime::time)::timestamptz,
            'Rescheduled from ' || @originalDate,
            false
          )
        '''),
        parameters: {
          'groupId': int.parse(groupId),
          'newDate': newDate,
          'newTime': newTime,
          'originalDate': originalDate,
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Lesson rescheduled successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error rescheduling lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to reschedule lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _createLesson(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = jsonDecode(await req.readAsString()) as Map<String, dynamic>;
      
      final groupId = body['group_id'];
      final className = body['class_name'];
      final teacherId = body['teacher_id'];
      final hallId = body['hall_id'];
      final startTime = body['start_time'];
      final durationMinutes = body['duration_minutes'] ?? 90;

      if (groupId == null || className == null || startTime == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'Missing required fields: group_id, class_name, start_time'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final result = await connection.execute(
        Sql.named('''
          INSERT INTO lessons (group_id, class_name, teacher_id, hall_id, start_time, duration_minutes)
          VALUES (@groupId, @className, @teacherId, @hallId, @startTime, @durationMinutes)
          RETURNING id
        '''),
        parameters: {
          'groupId': groupId,
          'className': className,
          'teacherId': teacherId,
          'hallId': hallId,
          'startTime': startTime,
          'durationMinutes': durationMinutes,
        },
      );

      final lessonId = result.first[0];

      return Response.ok(
        jsonEncode({'message': 'Lesson created successfully', 'lesson_id': lessonId}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to create lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to create lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _updateLesson(Request req, String lessonIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final lessonId = int.tryParse(lessonIdParam);
    if (lessonId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid lesson id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = jsonDecode(await req.readAsString()) as Map<String, dynamic>;
      
      final updateFields = <String>[];
      final parameters = <String, dynamic>{'lessonId': lessonId};

      if (body.containsKey('class_name')) {
        updateFields.add('class_name = @className');
        parameters['className'] = body['class_name'];
      }

      if (body.containsKey('teacher_id')) {
        updateFields.add('teacher_id = @teacherId');
        parameters['teacherId'] = body['teacher_id'];
      }

      if (body.containsKey('hall_id')) {
        updateFields.add('hall_id = @hallId');
        parameters['hallId'] = body['hall_id'];
      }

      if (body.containsKey('start_time')) {
        updateFields.add('start_time = @startTime');
        parameters['startTime'] = body['start_time'];
      }

      if (body.containsKey('duration_minutes')) {
        updateFields.add('duration_minutes = @durationMinutes');
        parameters['durationMinutes'] = body['duration_minutes'];
      }

      if (updateFields.isEmpty) {
        return Response(
          400,
          body: jsonEncode({'error': 'No fields to update'}),
          headers: {'content-type': 'application/json'},
        );
      }

      await connection.execute(
        Sql.named('UPDATE lessons SET ${updateFields.join(', ')} WHERE id = @lessonId'),
        parameters: parameters,
      );

      return Response.ok(
        jsonEncode({'message': 'Lesson updated successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to update lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to update lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _deleteLesson(Request req, String lessonIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'admin') {
      return Response.forbidden(
        jsonEncode({'error': 'Admin access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final lessonId = int.tryParse(lessonIdParam);
    if (lessonId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid lesson id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      await connection.execute(
        Sql.named('DELETE FROM lessons WHERE id = @lessonId'),
        parameters: {'lessonId': lessonId},
      );

      return Response.ok(
        jsonEncode({'message': 'Lesson deleted successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to delete lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to delete lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _getRescheduleRequests(Request request) async {
    try {
      final result = await connection.execute(
        Sql.named('''
          SELECT 
            rr.id,
            l.group_id,
            g.name as group_name,
            l.teacher_id,
            u.name as teacher_name,
            rr.original_start_time,
            rr.new_start_time,
            rr.reason,
            rr.status,
            rr.admin_response,
            rr.created_at,
            l.class_name
          FROM reschedule_requests rr
          JOIN lessons l ON rr.lesson_id = l.id
          JOIN groups g ON l.group_id = g.id
          JOIN users u ON l.teacher_id = u.id
          ORDER BY rr.created_at DESC
        ''')
      );

      final requests = result.map((row) => {
        'id': row[0],
        'group_id': row[1],
        'group_name': row[2],
        'teacher_id': row[3],
        'teacher_name': row[4],
        'original_start_time': row[5].toString(),
        'new_start_time': row[6].toString(),
        'reason': row[7],
        'status': row[8],
        'admin_response': row[9],
        'created_at': row[10].toString(),
        'class_name': row[11],
      }).toList();

      return Response.ok(
        jsonEncode({'requests': requests}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to get reschedule requests: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to get reschedule requests'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _approveRescheduleRequest(Request request, String requestId) async {
    final body = await request.readAsString();
    final data = jsonDecode(body) as Map<String, dynamic>;

    try {
      await connection.execute(
        Sql.named('''
          UPDATE reschedule_requests 
          SET status = 'approved', admin_response = @comment
          WHERE id = @requestId
        '''),
        parameters: {
          'requestId': int.parse(requestId),
          'comment': data['comment'] ?? ''
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Reschedule request approved successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to approve reschedule request: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to approve reschedule request'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  
  Future<Response> _rejectRescheduleRequest(Request request, String requestId) async {
    final body = await request.readAsString();
    final data = jsonDecode(body) as Map<String, dynamic>;

    try {
      await connection.execute(
        Sql.named('''
          UPDATE reschedule_requests 
          SET status = 'rejected', admin_response = @comment
          WHERE id = @requestId
        '''),
        parameters: {
          'requestId': int.parse(requestId),
          'comment': data['comment'] ?? ''
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Reschedule request rejected successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to reject reschedule request: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to reject reschedule request'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }
}
