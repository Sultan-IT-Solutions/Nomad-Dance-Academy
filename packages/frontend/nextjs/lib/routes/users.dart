import 'dart:convert';

import 'package:postgres/postgres.dart' show Sql;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../db/connection.dart';

class UsersRoute {
  Router get router {
    final router = Router();

    router.get('/users/me', _getMe);

    return router;
  }

  Future<Response> _getMe(Request req) async {
    final user = req.context['user'] as Map<String, dynamic>?;
    if (user == null) {
      return Response.forbidden(
        jsonEncode({'error': 'Authentication required'}),
        headers: {'content-type': 'application/json'},
      );
    }

    final userId = user['id'] as int;
    try {
      final rows = await connection.execute(
        Sql.named('SELECT id, name, email, role, created_at FROM users WHERE id = @userId'),
        parameters: {'userId': userId},
      );

      if (rows.isEmpty) {
        return Response(404,
          body: jsonEncode({'error': 'User not found'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final r = rows.first;
      final userData = {
        'id': r[0],
        'name': r[1],
        'email': r[2],
        'role': r[3],
        'created_at': r[4]?.toString(),
      };

      return Response.ok(
        jsonEncode({'user': userData}),
        headers: {'content-type': 'application/json'},
      );
    } catch (e) {
      print('❌ Failed to fetch user profile: $e');
      return Response.internalServerError(
        body: jsonEncode({'error': 'Unable to load user profile'}),
        headers: {'content-type': 'application/json'},
      );
    }
  }
}