import 'dart:convert';

import 'package:postgres/postgres.dart' show Sql;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../db/connection.dart';

class StudentsRoute {
  Router get router {
    final router = Router();

    router.get('/students/me', _getMe);
    router.post('/students/me', _createOrUpdateMe);
    router.get('/students/my-groups', _getMyGroups);
    router.get('/students/my-attendance', _getMyAttendance);
    router.get('/students/notifications', _getNotifications);
    router.post('/students/notifications/<notificationId>/read', _markNotificationAsRead);

    return router;
  }

  Future<Response> _getMe(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(jsonEncode({'error': 'Authentication required'}), headers: {'content-type': 'application/json'});
    }
    if (user['role'] != 'student') {
      return Response.forbidden(jsonEncode({'error': 'Student role required'}), headers: {'content-type': 'application/json'});
    }

    final userId = user['id'] as int;
    try {
      final rows = await connection.execute(Sql.named('SELECT id, user_id, parent_phone, comment, trial_used, subscription_until FROM students WHERE user_id = @userId'), parameters: {'userId': userId});
      if (rows.isEmpty) {
        return Response(404, body: jsonEncode({'error': 'Student profile not found'}), headers: {'content-type': 'application/json'});
      }
      final r = rows.first;
      final student = {
        'id': r[0],
        'user_id': r[1],
        'parent_phone': r[2],
        'comment': r[3],
        'trial_used': r[4],
        'subscription_until': r[5]?.toString(),
      };
      return Response.ok(jsonEncode({'student': student}), headers: {'content-type': 'application/json'});
    } catch (e) {
      print('❌ Failed to fetch student profile: $e');
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to load profile'}), headers: {'content-type': 'application/json'});
    }
  }

  Future<Response> _createOrUpdateMe(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(jsonEncode({'error': 'Authentication required'}), headers: {'content-type': 'application/json'});
    }
    if (user['role'] != 'student') {
      return Response.forbidden(jsonEncode({'error': 'Student role required'}), headers: {'content-type': 'application/json'});
    }

    final userId = user['id'] as int;
    try {
      final body = await req.readAsString();
      final data = body.isEmpty ? <String, dynamic>{} : jsonDecode(body) as Map<String, dynamic>;
      final parentPhone = data['parent_phone']?.toString();
      final comment = data['comment']?.toString();

      if (parentPhone == null || parentPhone.isEmpty) {
        return Response(400, body: jsonEncode({'error': 'parent_phone is required'}), headers: {'content-type': 'application/json'});
      }

      final rows = await connection.execute(Sql.named('''
        INSERT INTO students (user_id, parent_phone, comment)
        VALUES (@userId, @parentPhone, @comment)
        ON CONFLICT (user_id) DO UPDATE SET parent_phone = EXCLUDED.parent_phone, comment = COALESCE(EXCLUDED.comment, students.comment)
        RETURNING id, user_id, parent_phone, comment, trial_used, subscription_until
      '''), parameters: {'userId': userId, 'parentPhone': parentPhone, 'comment': comment});

      final r = rows.first;
      final student = {
        'id': r[0],
        'user_id': r[1],
        'parent_phone': r[2],
        'comment': r[3],
        'trial_used': r[4],
        'subscription_until': r[5]?.toString(),
      };

      return Response.ok(jsonEncode({'message': 'Profile created/updated', 'student': student}), headers: {'content-type': 'application/json'});
    } catch (e, st) {
      print('❌ Failed to create/update student profile: $e');
      print(st);
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to create/update profile', 'detail': e.toString()}), headers: {'content-type': 'application/json'});
    }
  }

  Future<Response> _getMyGroups(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(jsonEncode({'error': 'Authentication required'}), headers: {'content-type': 'application/json'});
    }
    if (user['role'] != 'student') {
      return Response.forbidden(jsonEncode({'error': 'Student role required'}), headers: {'content-type': 'application/json'});
    }

    final userId = user['id'] as int;
    try {
      final studentId = await _resolveStudentId(userId);
      if (studentId == null) {
        return Response.ok(jsonEncode({'groups': []}), headers: {'content-type': 'application/json'});
      }

      final rows = await connection.execute(
        Sql.named('''
          SELECT
            g.id,
            g.name,
            g.start_time,
            g.duration_minutes,
            h.name AS hall_name,
            u.name AS teacher_name,
            g.capacity,
            (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) AS enrolled,
            g.recurring_days
          FROM group_students gs
          JOIN groups g ON g.id = gs.group_id
          LEFT JOIN halls h ON h.id = g.hall_id
          LEFT JOIN teachers t ON t.id = g.main_teacher_id
          LEFT JOIN users u ON u.id = t.user_id
          WHERE gs.student_id = @studentId
          ORDER BY g.start_time;
        '''),
        parameters: {'studentId': studentId},
      );

      final groups = rows.map((r) {
        final enrolledValue = r[7];
        final enrolled = enrolledValue is num
            ? enrolledValue.toInt()
            : int.tryParse(enrolledValue.toString()) ?? 0;

        final recurringDays = r[8];
        String? recurringDaysFormatted;
        if (recurringDays != null && recurringDays.toString().isNotEmpty) {
          final days = recurringDays.toString().split(',');
          recurringDaysFormatted = days.map((day) {
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
        }

        return {
          'id': r[0],
          'name': r[1],
          'start_time': r[2]?.toString(),
          'duration_minutes': r[3],
          'hall_name': r[4] ?? 'Не указан',
          'teacher_name': r[5] ?? 'Не назначен',
          'capacity': r[6],
          'enrolled': enrolled,
          'free_slots': (r[6] as int?) != null ? (r[6] as int) - enrolled : null,
          'recurring_days': recurringDaysFormatted,
        };
      }).toList();

      return Response.ok(jsonEncode({'groups': groups}), headers: {'content-type': 'application/json'});
    } catch (e, st) {
      print('❌ Failed to fetch student groups: $e');
      print(st);
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to load groups'}), headers: {'content-type': 'application/json'});
    }
  }

  Future<Response> _getNotifications(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(jsonEncode({'error': 'Authentication required'}), headers: {'content-type': 'application/json'});
    }
    if (user['role'] != 'student') {
      return Response.forbidden(jsonEncode({'error': 'Student role required'}), headers: {'content-type': 'application/json'});
    }

    final userId = user['id'] as int;
    try {
      final studentId = await _resolveStudentId(userId);
      if (studentId == null) {
        return Response(404, body: jsonEncode({'error': 'Student profile not found'}), headers: {'content-type': 'application/json'});
      }

      final rows = await connection.execute(Sql.named('''
        SELECT id, type, group_id, title, message, is_read, created_at
        FROM notifications
        WHERE student_id = @studentId
        ORDER BY created_at DESC
        LIMIT 50
      '''), parameters: {'studentId': studentId});

      final notifications = rows.map((r) => {
        'id': r[0],
        'type': r[1],
        'group_id': r[2],
        'title': r[3],
        'message': r[4],
        'is_read': r[5],
        'created_at': r[6]?.toString(),
      }).toList();

      return Response.ok(jsonEncode({'notifications': notifications}), headers: {'content-type': 'application/json'});
    } catch (e) {
      print('❌ Failed to fetch notifications: $e');
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to load notifications'}), headers: {'content-type': 'application/json'});
    }
  }

  Future<Response> _markNotificationAsRead(Request req, String notificationIdParam) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(jsonEncode({'error': 'Authentication required'}), headers: {'content-type': 'application/json'});
    }
    if (user['role'] != 'student') {
      return Response.forbidden(jsonEncode({'error': 'Student role required'}), headers: {'content-type': 'application/json'});
    }

    final notificationId = int.tryParse(notificationIdParam);
    if (notificationId == null) {
      return Response(400, body: jsonEncode({'error': 'Invalid notification id'}), headers: {'content-type': 'application/json'});
    }

    try {
      await connection.execute(Sql.named('''
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = @notificationId
      '''), parameters: {'notificationId': notificationId});

      return Response.ok(jsonEncode({'message': 'Notification marked as read'}), headers: {'content-type': 'application/json'});
    } catch (e) {
      print('❌ Failed to mark notification as read: $e');
      return Response.internalServerError(body: jsonEncode({'error': 'Unable to update notification'}), headers: {'content-type': 'application/json'});
    }
  }

  Future<int?> _resolveStudentId(int userId) async {
    final rows = await connection.execute(
      Sql.named('SELECT id FROM students WHERE user_id = @userId'),
      parameters: {'userId': userId},
    );
    if (rows.isEmpty) {
      return null;
    }
    return rows.first[0] as int;
  }

  Future<Response> _getMyAttendance(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'student') {
      return Response.forbidden(
        jsonEncode({'error': 'Student access required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final userId = user['id'] as int;
    
    try {
      final studentId = await _resolveStudentId(userId);
      if (studentId == null) {
        return Response(404, 
          body: jsonEncode({'error': 'Student profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final result = await connection.execute(
        Sql.named('''
          SELECT
            g.id,
            g.name,
            ar.status,
            ar.lesson_date,
            ar.attended
          FROM attendance_records ar
          JOIN groups g ON g.id = ar.group_id
          WHERE ar.student_id = @studentId
          ORDER BY ar.lesson_date DESC;
        '''),
        parameters: {'studentId': studentId},
      );

      
      final Map<int, Map<String, dynamic>> groupStats = {};
      
      for (var row in result) {
        final groupId = row[0] as int;
        final groupName = row[1] as String;
        final status = row[2] as String?;
        
        if (!groupStats.containsKey(groupId)) {
          groupStats[groupId] = {
            'id': groupId,
            'name': groupName,
            'present': 0,  
            'excused': 0,  
            'late': 0,     
            'absent': 0,   
            'total': 0,
            'points': 0.0, 
          };
        }

        groupStats[groupId]!['total']++;
        
        switch (status) {
          case 'P':
            groupStats[groupId]!['present']++;
            groupStats[groupId]!['points'] += 2.0;
            break;
          case 'E':
            groupStats[groupId]!['excused']++;
            groupStats[groupId]!['points'] += 2.0;
            break;
          case 'L':
            groupStats[groupId]!['late']++;
            groupStats[groupId]!['points'] += 1.0;
            break;
          case 'A':
            groupStats[groupId]!['absent']++;
            break;
        }
      }

      
      final attendanceList = groupStats.values.map((stats) {
        final total = stats['total'] as int;
        final present = stats['present'] as int;
        final excused = stats['excused'] as int;
        final attended = present + excused;
        final percentage = total > 0 ? ((attended / total) * 100).round() : 0;
        final maxPoints = total * 2.0;
        final earnedPoints = stats['points'] as double;

        return {
          'id': stats['id'],
          'groupName': stats['name'],
          'present': present,
          'excused': excused,
          'late': stats['late'],
          'absent': stats['absent'],
          'total': total,
          'percentage': percentage,
          'points': earnedPoints,
          'maxPoints': maxPoints,
        };
      }).toList();

      return Response.ok(
        jsonEncode({'attendance': attendanceList}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Error fetching attendance: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch attendance'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }
}
