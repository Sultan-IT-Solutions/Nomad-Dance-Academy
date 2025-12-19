import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:postgres/postgres.dart';
import '../db/connection.dart';
import '../middleware/role_guard.dart';

class LessonsRoute {
  Router get router {
    final router = Router();

    
    router.post('/lessons', (Request req) => _withAuth(req, _createLesson));
    
    
    router.get('/lessons/teacher', (Request req) => _withAuth(req, _getTeacherLessons));
    
    
    router.get('/lessons/student', (Request req) => _withAuth(req, _getStudentLessons));
    
    
    router.post('/lessons/<id>/reschedule', (Request req, String id) => _withAuth(req, (authReq) => _createRescheduleRequest(authReq, id)));
    
    
    router.get('/reschedule-requests', (Request req) => _withAuth(req, _getRescheduleRequests));
    
    
    router.post('/reschedule-requests/<id>/respond', (Request req, String id) => _withAuth(req, (authReq) => _respondToRescheduleRequest(authReq, id)));
    
    
    router.get('/halls', _getHalls);
    
    
    router.get('/groups', _getGroups);

    return router;
  }

  Future<Response> _withAuth(Request req, Future<Response> Function(Request) handler) async {
    final authHeader = req.headers['authorization'];
    if (authHeader == null || !authHeader.startsWith('Bearer ')) {
      return Response.forbidden(
        jsonEncode({'error': 'Authentication required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final token = authHeader.substring(7);
    final userData = verifyJwt(token);
    
    if (userData == null) {
      return Response.forbidden(
        jsonEncode({'error': 'Invalid or expired token'}),
        headers: {'content-type': 'application/json'},
      );
    }

    
    final updatedRequest = req.change(context: {'user': userData});
    return handler(updatedRequest);
  }

  Future<Response> _createLesson(Request req) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final userRole = userData['role'] as String;
      if (userRole != 'teacher' && userRole != 'admin') {
        return Response.forbidden(
          jsonEncode({'error': 'Teacher or admin role required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final userId = userData['id'] as int;
      final body = await req.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;

      
      if (data['type'] == null || data['date'] == null || data['startTime'] == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'Missing required fields: type, date, startTime'}),
          headers: {'content-type': 'application/json'},
        );
      }

      int teacherId;
      
      if (userRole == 'admin') {
        
        if (data['teacher'] == null) {
          return Response(
            400,
            body: jsonEncode({'error': 'Teacher selection is required for admin users'}),
            headers: {'content-type': 'application/json'},
          );
        }
        teacherId = int.parse(data['teacher']);
      } else {
        
        final teacherResult = await connection.execute(
          Sql.named('SELECT id FROM teachers WHERE user_id = @userId'),
          parameters: {'userId': userId},
        );
        
        if (teacherResult.isEmpty) {
          return Response(
            400,
            body: jsonEncode({'error': 'User is not registered as a teacher'}),
            headers: {'content-type': 'application/json'},
          );
        }
        
        teacherId = teacherResult.first[0] as int;
      }

      
      final dateStr = data['date'] as String;
      final timeStr = data['startTime'] as String;
      final startDateTime = DateTime.parse('${dateStr}T$timeStr');

      final lessonData = {
        'group_id': data['group'] != null ? int.tryParse(data['group']) : null,
        'class_name': data['topic'] ?? 'Урок',
        'teacher_id': teacherId,
        'hall_id': data['hall'] != null ? int.tryParse(data['hall']) : null,
        'start_time': startDateTime.toIso8601String(),
        'duration_minutes': int.tryParse(data['duration'] ?? '60') ?? 60,
        'lesson_type': data['type'] ?? 'group',
        'topic': data['topic'],
        'comment': data['comment'],
        'direction': data['direction'],
        'repeat_frequency': data['repeat'] ?? 'none',
        'is_additional': data['additional'] == true,
      };

      final result = await connection.execute(
        Sql.named('''
          INSERT INTO lessons (
            group_id, class_name, teacher_id, hall_id, start_time, 
            duration_minutes, lesson_type, topic, comment, direction, 
            repeat_frequency, is_additional
          ) VALUES (
            @group_id, @class_name, @teacher_id, @hall_id, @start_time,
            @duration_minutes, @lesson_type, @topic, @comment, @direction,
            @repeat_frequency, @is_additional
          ) RETURNING id
        '''),
        parameters: lessonData,
      );

      final lessonId = result.first[0] as int;

      return Response.ok(
        jsonEncode({
          'message': 'Lesson created successfully',
          'lesson_id': lessonId
        }),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('Error creating lesson: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to create lesson: ${e.toString()}'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getTeacherLessons(Request req) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final userRole = userData['role'] as String;
      if (userRole != 'teacher' && userRole != 'admin') {
        return Response.forbidden(
          jsonEncode({'error': 'Teacher role required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final teacherId = userData['id'];

      final result = await connection.execute(
        Sql.named('''
          SELECT 
            l.id, l.class_name, l.start_time, l.duration_minutes,
            l.lesson_type, l.topic, l.comment, l.direction,
            l.is_additional, l.is_cancelled, l.is_rescheduled,
            g.name as group_name,
            h.name as hall_name
          FROM lessons l
          LEFT JOIN groups g ON l.group_id = g.id
          LEFT JOIN halls h ON l.hall_id = h.id
          WHERE l.teacher_id = @teacher_id
          ORDER BY l.start_time ASC
        '''),
        parameters: {'teacher_id': teacherId},
      );

      final lessons = result.map((row) => {
        'id': row[0],
        'class_name': row[1],
        'start_time': row[2],
        'duration_minutes': row[3],
        'lesson_type': row[4],
        'topic': row[5],
        'comment': row[6],
        'direction': row[7],
        'is_additional': row[8],
        'is_cancelled': row[9],
        'is_rescheduled': row[10],
        'group_name': row[11],
        'hall_name': row[12],
      }).toList();

      return Response.ok(
        jsonEncode({'lessons': lessons}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('Error fetching teacher lessons: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getStudentLessons(Request req) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final userRole = userData['role'] as String;
      if (userRole != 'student') {
        return Response.forbidden(
          jsonEncode({'error': 'Student role required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final userId = userData['id'];

      final result = await connection.execute(
        Sql.named('''
          SELECT 
            l.id, l.class_name, l.start_time, l.duration_minutes,
            l.lesson_type, l.topic, l.comment, l.direction,
            l.is_cancelled, l.is_rescheduled,
            g.name as group_name,
            h.name as hall_name,
            u.name as teacher_name
          FROM lessons l
          LEFT JOIN groups g ON l.group_id = g.id
          LEFT JOIN halls h ON l.hall_id = h.id
          LEFT JOIN users u ON l.teacher_id = u.id
          LEFT JOIN group_students gs ON g.id = gs.group_id
          LEFT JOIN students s ON gs.student_id = s.id
          WHERE s.user_id = @user_id
          ORDER BY l.start_time ASC
        '''),
        parameters: {'user_id': userId},
      );

      final lessons = result.map((row) => {
        'id': row[0],
        'class_name': row[1],
        'start_time': row[2],
        'duration_minutes': row[3],
        'lesson_type': row[4],
        'topic': row[5],
        'comment': row[6],
        'direction': row[7],
        'is_cancelled': row[8],
        'is_rescheduled': row[9],
        'group_name': row[10],
        'hall_name': row[11],
        'teacher_name': row[12],
      }).toList();

      return Response.ok(
        jsonEncode({'lessons': lessons}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('Error fetching student lessons: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch lessons'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _createRescheduleRequest(Request req, String lessonId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null) {
        return Response.forbidden(
          jsonEncode({'error': 'Authentication required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;

      if (data['newDate'] == null || data['newTime'] == null || data['reason'] == null) {
        return Response(
          400,
          body: jsonEncode({'error': 'Missing required fields: newDate, newTime, reason'}),
          headers: {'content-type': 'application/json'},
        );
      }

      
      final newDateStr = data['newDate'] as String;
      final newTimeStr = data['newTime'] as String;
      final newStartTime = DateTime.parse('${newDateStr}T$newTimeStr');

      
      final lessonResult = await connection.execute(
        Sql.named('SELECT start_time FROM lessons WHERE id = @lesson_id'),
        parameters: {'lesson_id': int.parse(lessonId)},
      );

      if (lessonResult.isEmpty) {
        return Response(
          404,
          body: jsonEncode({'error': 'Lesson not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final originalStartTime = lessonResult.first[0] as DateTime;

      
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
          'lesson_id': int.parse(lessonId),
          'requested_by': userData['id'],
          'original_start_time': originalStartTime.toIso8601String(),
          'new_start_time': newStartTime.toIso8601String(),
          'reason': data['reason'],
        },
      );

      return Response.ok(
        jsonEncode({'message': 'Reschedule request submitted successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('Error creating reschedule request: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to create reschedule request'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getRescheduleRequests(Request req) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null || userData['role'] != 'admin') {
        return Response.forbidden(
          jsonEncode({'error': 'Admin role required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final result = await connection.execute(
        Sql.named('''
          SELECT 
            rr.id, rr.lesson_id, rr.original_start_time, rr.new_start_time,
            rr.reason, rr.status, rr.admin_response, rr.created_at,
            l.class_name,
            u.name as requested_by_name
          FROM reschedule_requests rr
          LEFT JOIN lessons l ON rr.lesson_id = l.id
          LEFT JOIN users u ON rr.requested_by = u.id
          ORDER BY rr.created_at DESC
        '''),
      );

      final requests = result.map((row) => {
        'id': row[0],
        'lesson_id': row[1],
        'original_start_time': row[2],
        'new_start_time': row[3],
        'reason': row[4],
        'status': row[5],
        'admin_response': row[6],
        'created_at': row[7],
        'class_name': row[8],
        'requested_by_name': row[9],
      }).toList();

      return Response.ok(
        jsonEncode({'requests': requests}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch reschedule requests'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _respondToRescheduleRequest(Request req, String requestId) async {
    try {
      final userData = req.context['user'] as Map<String, dynamic>?;
      if (userData == null || userData['role'] != 'admin') {
        return Response.forbidden(
          jsonEncode({'error': 'Admin role required'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final body = await req.readAsString();
      final data = jsonDecode(body) as Map<String, dynamic>;

      final status = data['status'] as String; 
      final response = data['response'] as String?;

      
      await connection.execute(
        Sql.named('''
          UPDATE reschedule_requests 
          SET status = @status, admin_response = @response, updated_at = CURRENT_TIMESTAMP
          WHERE id = @request_id
        '''),
        parameters: {
          'status': status,
          'response': response,
          'request_id': int.parse(requestId),
        },
      );

      
      if (status == 'approved') {
        final requestResult = await connection.execute(
          Sql.named('SELECT lesson_id, new_start_time FROM reschedule_requests WHERE id = @request_id'),
          parameters: {'request_id': int.parse(requestId)},
        );

        if (requestResult.isNotEmpty) {
          final lessonId = requestResult.first[0];
          final newStartTime = requestResult.first[1];

          await connection.execute(
            Sql.named('''
              UPDATE lessons 
              SET start_time = @new_start_time, is_rescheduled = true, updated_at = CURRENT_TIMESTAMP
              WHERE id = @lesson_id
            '''),
            parameters: {
              'new_start_time': newStartTime,
              'lesson_id': lessonId,
            },
          );
        }
      }

      return Response.ok(
        jsonEncode({'message': 'Reschedule request ${status == 'approved' ? 'approved' : 'denied'} successfully'}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to respond to reschedule request'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getHalls(Request req) async {
    try {
      final result = await connection.execute(
        Sql.named('SELECT id, name, capacity FROM halls ORDER BY name'),
      );

      final halls = result.map((row) => {
        'id': row[0],
        'name': row[1],
        'capacity': row[2],
      }).toList();

      return Response.ok(
        jsonEncode({'halls': halls}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch halls'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }

  Future<Response> _getGroups(Request req) async {
    try {
      final result = await connection.execute(
        Sql.named('''
          SELECT g.id, g.name, g.capacity, h.name as hall_name
          FROM groups g
          LEFT JOIN halls h ON g.hall_id = h.id
          ORDER BY g.name
        '''),
      );

      final groups = result.map((row) => {
        'id': row[0],
        'name': row[1],
        'capacity': row[2],
        'hall_name': row[3],
      }).toList();

      return Response.ok(
        jsonEncode({'groups': groups}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      return Response.internalServerError(
        body: jsonEncode({'error': 'Failed to fetch groups'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }
}