import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';

import '../env.dart';
final _secretKey = Env.require("JWT_SECRET"); 


Middleware jwtAuthorization() {
  return (Handler innerHandler) {
    return (Request request) async {
      
      if (request.url.path.startsWith('auth') || request.url.path.startsWith('debug') || request.url.path == 'health') {
        return innerHandler(request);
      }

      final authHeader = request.headers['Authorization'];
      if (authHeader == null || !authHeader.startsWith('Bearer ')) {
        return Response.forbidden(
          jsonEncode({'error': 'Missing or invalid Authorization header'}),
          headers: {'content-type': 'application/json'},
        );
      }

      final token = authHeader.substring(7);
      try {
        final jwt = JWT.verify(token, SecretKey(_secretKey));

        
        final updated = request.change(context: {'user': jwt.payload});
        return await innerHandler(updated);
      } catch (e) {
        print(' Invalid JWT: $e');
        return Response.forbidden(
          jsonEncode({'error': 'Invalid or expired token'}),
          headers: {'content-type': 'application/json'},
        );
      }
    };
  };
}


String generateJwt(int userId, String role) {
  final jwt = JWT({
    'id': userId,
    'role': role,
    'exp': DateTime.now()
        .add(const Duration(hours: 24))
        .millisecondsSinceEpoch ~/ 1000,
  });

  return jwt.sign(SecretKey(_secretKey));
}
