import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';

import 'db/connection.dart';
import 'middleware/drugoi.dart';
import 'middleware/cors.dart';
import 'routes/admin.dart';
import 'routes/auth.dart';
import 'routes/groups.dart';
import 'routes/teachers.dart';
import 'routes/students.dart';
import 'routes/users.dart';
import 'routes/lessons.dart';

Future<void> main() async {
  await connectToDatabase();

  final root = Router();
  
  root.mount('/', AuthRoute().router);
  root.mount('/', GroupsRoute().router);
  root.mount('/', TeachersRoute().router);
  root.mount('/', StudentsRoute().router);
  root.mount('/', AdminRoute().router);
  root.mount('/', UsersRoute().router);
  root.mount('/', LessonsRoute().router);
  
  
  root.get('/health', (Request req) {
    return Response.ok(jsonEncode({'status': 'ok'}), headers: {'content-type': 'application/json'});
  });

  root.get('/debug/routes', (Request req) {
    final routes = [
      '/auth/register',
      '/auth/login',
      '/groups/available',
      '/groups/schedule',
      '/groups/{id}/join',
      '/groups/{id}/trial',
      '/groups/{id}/additional-request',
      '/admin/analytics',
      '/admin/halls/{hallId}/schedule',
      '/admin/groups',
      '/admin/groups/{groupId}/limit',
      '/admin/teachers/{teacherId}/groups/{groupId}',
      '/admin/groups/{groupId}/students/{studentId}',
      '/admin/additional-lessons/{exceptionId}/decision',
      '/admin/halls',
      '/admin/teachers',
      '/students/me'
    ];
    return Response.ok(jsonEncode({'routes': routes}), headers: {'content-type': 'application/json'});
  });

  final handler = Pipeline()
    .addMiddleware(logRequests())
    
    .addMiddleware(cors())
    .addMiddleware(jwtAuthorization())
    .addHandler(root);

  final server = await io.serve(handler, 'localhost', 8080);
  print('✅ Server running on http:
}
