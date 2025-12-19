import 'dart:convert';

import 'package:postgres/postgres.dart' show Sql;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../db/connection.dart';

class GroupsRoute {
  Router get router {
    final router = Router();

    router.get('/groups/available', _availableGroups);
    router.get('/groups/schedule', _groupSchedule);
    router.get('/groups/filters', _getFilters);
    router.post('/groups/<id>/join', _joinGroup);
    router.post('/groups/<id>/trial', _trialLesson);
    router.post('/groups/<id>/additional-request', _requestAdditionalLesson);

    return router;
  }

  Future<Response> _getFilters(Request req) async {
    try {
      
      final teachersRows = await connection.execute('''
        SELECT DISTINCT u.id, u.name
        FROM users u
        INNER JOIN teachers t ON t.user_id = u.id
        WHERE EXISTS (
          SELECT 1 FROM groups g WHERE g.main_teacher_id = t.id AND g.is_closed = FALSE
        ) OR EXISTS (
          SELECT 1 FROM group_teachers gt
          INNER JOIN groups g ON g.id = gt.group_id
          WHERE gt.teacher_id = t.id AND g.is_closed = FALSE
        )
        ORDER BY u.name;
      ''');

      
      final hallsRows = await connection.execute('''
        SELECT DISTINCT h.id, h.name
        FROM halls h
        WHERE EXISTS (
          SELECT 1 FROM groups g WHERE g.hall_id = h.id AND g.is_closed = FALSE
        )
        ORDER BY h.name;
      ''');

      final teachers = teachersRows.map((row) => {
        'id': row[0],
        'name': row[1],
      }).toList();

      final halls = hallsRows.map((row) => {
        'id': row[0],
        'name': row[1],
      }).toList();

      return Response.ok(
        jsonEncode({
          'teachers': teachers,
          'halls': halls,
        }),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load filters: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load filters'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _availableGroups(Request req) async {
    try {
      final rows = await connection.execute('''
        SELECT
          g.id,
          g.name,
          g.capacity,
          g.start_time,
          g.duration_minutes,
          h.id AS hall_id,
          h.name AS hall_name,
          h.capacity AS hall_capacity,
          (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = g.id AND gs.is_trial = FALSE) AS enrolled,
          array_remove(array_agg(DISTINCT COALESCE(gt.teacher_id, g.main_teacher_id)), NULL) AS teacher_ids,
          array_remove(array_agg(DISTINCT u.name), NULL) AS teacher_names
        FROM groups g
        LEFT JOIN halls h ON h.id = g.hall_id
        LEFT JOIN group_teachers gt ON gt.group_id = g.id
        LEFT JOIN teachers t ON t.id = COALESCE(gt.teacher_id, g.main_teacher_id)
        LEFT JOIN users u ON u.id = t.user_id
        WHERE g.is_closed = FALSE AND g.is_additional = FALSE
        GROUP BY g.id, g.name, g.capacity, g.start_time, g.duration_minutes, h.id, h.name, h.capacity
        ORDER BY g.start_time NULLS LAST, g.id;
      ''');

      final response = rows
          .map((row) {
            final capacity = row[2] as int?;
            final enrolled = row[8] as int;
            final freeSlots = capacity == null ? null : (capacity - enrolled);
            final teacherNames = (row[10] as List?)?.whereType<String>().toList() ?? const <String>[];
            return {
              'id': row[0],
              'name': row[1],
              'capacity': capacity,
              'start_time': row[3]?.toString(),
              'duration_minutes': row[4],
              'hall': row[5] == null
                  ? null
                  : {
                      'id': row[5],
                      'name': row[6],
                      'capacity': row[7],
                    },
              'enrolled': enrolled,
              
              'free_slots': freeSlots,
              'teacher_ids': (row[9] as List?)?.whereType<int>().toList() ?? const <int>[],
              'teacher_names': teacherNames,
            };
          }).toList();

      return Response.ok(
        jsonEncode(response),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load available groups: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load groups'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _groupSchedule(Request req) async {
    final hallIdParam = req.url.queryParameters['hallId'];
    int? hallId;
    if (hallIdParam != null) {
      hallId = int.tryParse(hallIdParam);
      if (hallId == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'hallId must be an integer'}),
          headers: {'content-type': 'application/json'},
        );
      }
    }

    try {
      final baseSchedule = await connection.execute(
        Sql.named('''
          SELECT g.id, g.name, g.start_time, g.duration_minutes, g.is_additional,
                 h.id AS hall_id, h.name AS hall_name
          FROM groups g
          LEFT JOIN halls h ON h.id = g.hall_id
          WHERE (@hallId::INT IS NULL OR g.hall_id = @hallId)
          ORDER BY g.start_time NULLS LAST, g.id;
        '''),
        parameters: {'hallId': hallId},
      );

      final additions = await connection.execute(
        Sql.named('''
          SELECT se.id, se.group_id, se.start_time, se.duration_minutes, se.additional,
                 se.approved, se.requested_by_student, se.reason, h.id, h.name
          FROM schedule_exceptions se
          LEFT JOIN halls h ON h.id = se.hall_id
          WHERE (@hallId::INT IS NULL OR se.hall_id = @hallId)
          ORDER BY se.start_time NULLS LAST, se.id;
        '''),
        parameters: {'hallId': hallId},
      );

      final additionsByGroup = <int, List<Map<String, dynamic>>>{};
      for (final row in additions) {
        final groupId = row[1] as int;
        additionsByGroup.putIfAbsent(groupId, () => []).add({
              'id': row[0],
              'start_time': row[2]?.toString(),
              'duration_minutes': row[3],
              'is_additional': row[4],
              'approved': row[5],
              'requested_by_student': row[6],
              'reason': row[7],
              'hall': row[8] == null
                  ? null
                  : {
                      'id': row[8],
                      'name': row[9],
                    },
            });
      }

      final result = baseSchedule
          .map((row) => {
                'group_id': row[0],
                'group_name': row[1],
                'start_time': row[2]?.toString(),
                'duration_minutes': row[3],
                'is_additional': row[4],
                'hall': row[5] == null
                    ? null
                    : {
                        'id': row[5],
                        'name': row[6],
                      },
                'exceptions': additionsByGroup[row[0]] ?? const [],
              })
          .toList();

      return Response.ok(
        jsonEncode(result),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to load schedule: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to load schedule'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _joinGroup(Request req, String id) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'student') {
      return Response.forbidden(
        jsonEncode({'error': 'Only students may join groups'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final groupId = int.tryParse(id);
    if (groupId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid group id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final studentId = await _resolveStudentId(user['id'] as int);
      if (studentId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final info = await connection.execute(
        Sql.named('''
          SELECT
            capacity,
            is_closed,
            (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = @groupId AND gs.is_trial = FALSE) AS enrolled,
            EXISTS(
              SELECT 1 FROM group_students gs WHERE gs.group_id = @groupId AND gs.student_id = @studentId
            ) AS already_joined
          FROM groups
          WHERE id = @groupId;
        '''),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );

      if (info.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final row = info.first;
      final capacity = row[0] as int;
      final isClosed = row[1] as bool;
      final enrolled = row[2] as int;
      final alreadyJoined = row[3] as bool;

      if (isClosed) {
        return Response(
          409,
          body: jsonEncode({'error': 'Group is closed for enrollment'}),
          headers: {'content-type': 'application/json'},
        );
      }
      
      final groupTime = await connection.execute(
        Sql.named('SELECT start_time, duration_minutes FROM groups WHERE id = @groupId'),
        parameters: {'groupId': groupId},
      );
      if (groupTime.isNotEmpty && groupTime.first[0] != null) {
        final gStart = groupTime.first[0] as DateTime;
        final gDuration = groupTime.first[1] as int? ?? 90;
        final gEnd = gStart.add(Duration(minutes: gDuration));

        final overlap = await connection.execute(
          Sql.named('''
            SELECT gs.group_id FROM group_students gs
            JOIN groups g ON g.id = gs.group_id
            WHERE gs.student_id = @studentId
              AND gs.group_id != @groupId
              AND NOT (
                (g.start_time + (g.duration_minutes * INTERVAL '1 minute')) <= @gStart
                OR g.start_time >= @gEnd
              )
            LIMIT 1;
          '''),
          parameters: {'studentId': studentId, 'groupId': groupId, 'gStart': gStart, 'gEnd': gEnd},
        );

        if (overlap.isNotEmpty) {
          return Response(
            409,
            body: jsonEncode({'error': 'Student has another enrolled group that overlaps in time'}),
            headers: {'content-type': 'application/json'},
          );
        }
      }
      if (alreadyJoined) {
        return Response(
          409,
          body: jsonEncode({'error': 'Student already joined this group'}),
          headers: {'content-type': 'application/json'},
        );
      }
      if (enrolled >= capacity) {
        return Response(
          409,
          body: jsonEncode({'error': 'Group capacity reached'}),
          headers: {'content-type': 'application/json'},
        );
      }

      await connection.execute(
        Sql.named('''
          INSERT INTO group_students (group_id, student_id, is_trial)
          VALUES (@groupId, @studentId, FALSE)
          ON CONFLICT (group_id, student_id) DO UPDATE SET is_trial = FALSE;
        '''),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );

      print('👤 Student $studentId joined group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Student enrolled to group'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to join group: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to join group'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _trialLesson(Request req, String id) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'student') {
      return Response.forbidden(
        jsonEncode({'error': 'Only students may request a trial lesson'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final groupId = int.tryParse(id);
    if (groupId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid group id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final studentId = await _resolveStudentId(user['id'] as int);
      if (studentId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final eligibility = await connection.execute(
        Sql.named('''
          SELECT s.trial_used,
                 EXISTS(
                   SELECT 1 FROM group_students gs WHERE gs.group_id = @groupId AND gs.student_id = s.id
                 ) AS already_joined,
                 g.capacity,
                 g.is_closed,
                 (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = @groupId AND gs.is_trial = FALSE) AS enrolled
          FROM students s
          JOIN groups g ON g.id = @groupId
          WHERE s.id = @studentId;
        '''),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );

      if (eligibility.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student or group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final row = eligibility.first;
      final trialUsed = row[0] as bool;
      final alreadyJoined = row[1] as bool;
      final capacity = row[2] as int;
      final isClosed = row[3] as bool;
      final enrolled = row[4] as int;

      if (trialUsed) {
        return Response(
          409,
          body: jsonEncode({'error': 'Trial lesson already used'}),
          headers: {'content-type': 'application/json'},
        );
      }
      if (alreadyJoined) {
        return Response(
          409,
          body: jsonEncode({'error': 'Student already assigned to this group'}),
          headers: {'content-type': 'application/json'},
        );
      }
      if (isClosed || enrolled >= capacity) {
        return Response(
          409,
          body: jsonEncode({'error': 'Group unavailable for trials'}),
          headers: {'content-type': 'application/json'},
        );
      }

      await connection.execute(
        Sql.named('''
          INSERT INTO group_students (group_id, student_id, is_trial)
          VALUES (@groupId, @studentId, TRUE)
          ON CONFLICT (group_id, student_id) DO UPDATE SET is_trial = TRUE;
        '''),
        parameters: {'groupId': groupId, 'studentId': studentId},
      );
      await connection.execute(
        Sql.named('UPDATE students SET trial_used = TRUE WHERE id = @studentId'),
        parameters: {'studentId': studentId},
      );

      print('🎟️ Student $studentId booked trial for group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Trial lesson booked'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to book trial: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to book trial'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _requestAdditionalLesson(Request req, String id) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null || user['role'] != 'student') {
      return Response.forbidden(
        jsonEncode({'error': 'Only students may request additional lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final groupId = int.tryParse(id);
    if (groupId == null) {
      return Response(
        400,
        body: jsonEncode({'error': 'Invalid group id'}),
        headers: {'content-type': 'application/json'},
      );
    }

    try {
      final body = await req.readAsString();
      final data = body.isEmpty ? <String, dynamic>{} : jsonDecode(body) as Map<String, dynamic>;
      final requestedStart = DateTime.tryParse(data['start_time']?.toString() ?? '');
      final reason = data['reason']?.toString();

      if (requestedStart == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'start_time is required in ISO8601 format'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final studentId = await _resolveStudentId(user['id'] as int);
      if (studentId == null) {
        return Response(
          404,
          body: jsonEncode({'error': 'Student profile not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final groupInfo = await connection.execute(
        Sql.named('SELECT hall_id, duration_minutes FROM groups WHERE id = @groupId'),
        parameters: {'groupId': groupId},
      );

      if (groupInfo.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Group not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      await connection.execute(
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
            NULL,
            @hallId,
            @startTime,
            @duration,
            @reason,
            TRUE,
            FALSE,
            TRUE
          );
        '''),
        parameters: {
          'groupId': groupId,
          'hallId': groupInfo.first[0],
          'startTime': requestedStart,
          'duration': groupInfo.first[1],
          'reason': reason,
        },
      );

      print('📝 Student $studentId requested additional lesson for group $groupId');
      return Response.ok(
        jsonEncode({'message': 'Additional lesson request submitted for review'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to request additional lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to submit additional lesson request'}),
        headers: {'content-type': 'application/json'},
      );
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
}
