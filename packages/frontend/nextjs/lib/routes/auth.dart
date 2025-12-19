import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import 'package:postgres/postgres.dart';
import 'package:bcrypt/bcrypt.dart';
import '../db/connection.dart';
import '../env.dart';

final jwtSecret = Env.require('JWT_SECRET');

class AuthRoute {
  Router get router {
    final router = Router();

    
    router.post('/auth/register', (Request req) async {
      try {
        final body = await req.readAsString();
        final data = jsonDecode(body) as Map<String, dynamic>;

        final fullName = data['full_name'];
        final email = data['email'];
        final phone = data['phone'];
        final password = data['password'];
        final passwordConfirm = data['password_confirm'];

        
        final errors = <String, String>{};
        
        if (fullName == null || fullName.toString().isEmpty) {
          errors['full_name'] = 'Имя обязательно';
        }
        if (email == null || email.toString().isEmpty) {
          errors['email'] = 'Email обязателен';
        }
        
        if (password == null || password.toString().isEmpty) {
          errors['password'] = 'Пароль обязателен';
        }
        if (passwordConfirm == null || passwordConfirm.toString().isEmpty) {
          errors['password_confirm'] = 'Подтверждение пароля обязательно';
        }
        if (password != passwordConfirm) {
          errors['password_confirm'] = 'Пароли не совпадают';
        }

        if (errors.isNotEmpty) {
          return Response(
            400,
            body: jsonEncode({'errors': errors}),
            headers: {'content-type': 'application/json'},
          );
        }

        
        final existing = await connection.execute(
          Sql.named('SELECT id FROM users WHERE email = @email'),
          parameters: {'email': email},
        );

        if (existing.isNotEmpty) {
          return Response(
            400,
            body: jsonEncode({'errors': {'email': 'Email уже зарегистрирован'}}),
            headers: {'content-type': 'application/json'},
          );
        }

        
        final colCheck = await connection.execute(
          Sql.named('SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = @table AND column_name = @column'),
          parameters: {'schema': 'public', 'table': 'users', 'column': 'phone'},
        );
        final hasPhoneColumn = colCheck.isNotEmpty;

        
        final hashedPassword = BCrypt.hashpw(password, BCrypt.gensalt());
    
        
        int userId;
        if (hasPhoneColumn) {
          final userRows = await connection.execute(
            Sql.named('''
              INSERT INTO users (name, email, phone, password, role)
              VALUES (@name, @email, @phone, @password, @role)
              RETURNING id
            '''),
            parameters: {
              'name': fullName,
              'email': email,
              'phone': phone,
              'password': hashedPassword,
              'role': 'student',
            },
          );
          userId = userRows.first[0] as int;
        } else {
          final userRows = await connection.execute(
            Sql.named('''
              INSERT INTO users (name, email, password, role)
              VALUES (@name, @email, @password, @role)
              RETURNING id
            '''),
            parameters: {
              'name': fullName,
              'email': email,
              'password': hashedPassword,
              'role': 'student',
            },
          );
          userId = userRows.first[0] as int;
        }

        
        await connection.execute(
          Sql.named('''
            INSERT INTO students (user_id, parent_phone)
            VALUES (@userId, @parentPhone)
          '''),
          parameters: {
            'userId': userId,
            'parentPhone': phone ?? '',
          },
        );

        print('✅ Registered new student: $email (user_id: $userId)');
        return Response.ok(
          jsonEncode({'message': 'User registered successfully'}),
          headers: {'content-type': 'application/json'},
        );
      } catch (e) {
        print('❌ Error register: $e');
        return Response.internalServerError(
          body: jsonEncode({'error': e.toString()}),
          headers: {'content-type': 'application/json'},
        );
      }
    });

    
    router.post('/auth/login', (Request req) async {
      try {
        final body = await req.readAsString();
        final data = jsonDecode(body) as Map<String, dynamic>;

        final email = data['email'];
        final password = data['password'];

        if (email == null || password == null) {
          return Response(
            400,
            body: jsonEncode({'error': 'Требуются email и пароль'}),
            headers: {'content-type': 'application/json'},
          );
        }

        final result = await connection.execute(
          Sql.named('SELECT id, role, password FROM users WHERE email = @e'),
          parameters: {'e': email},
        );

        if (result.isEmpty) {
          return Response(
            401,
            body: jsonEncode({'error': 'Пользователь не найден'}),
            headers: {'content-type': 'application/json'},
          );
        }

        final storedHash = result.first[2] as String;
        
        
        
        bool passwordValid;
        if (storedHash.startsWith('\$2')) {
          
          passwordValid = BCrypt.checkpw(password, storedHash);
        } else {
          
          passwordValid = storedHash == password;
        }

        if (!passwordValid) {
          return Response(
            401,
            body: jsonEncode({'error': 'Неверный пароль'}),
            headers: {'content-type': 'application/json'},
          );
        }

        final userId = result.first[0];
        final role = result.first[1];

        
        await connection.execute(
          Sql.named('UPDATE users SET last_login = NOW() WHERE id = @userId'),
          parameters: {'userId': userId},
        );

        final jwt = JWT({
          'id': userId,
          'role': role,
          'exp': DateTime.now()
              .add(const Duration(hours: 24))
              .millisecondsSinceEpoch ~/ 1000,
        });

        final token = jwt.sign(SecretKey(jwtSecret));

        return Response.ok(
          jsonEncode({'token': token}),
          headers: {'content-type': 'application/json'},
        );
      } catch (e) {
        print('❌ Error login: $e');
        return Response.internalServerError(
          body: jsonEncode({'error': e.toString()}),
          headers: {'content-type': 'application/json'},
        );
      }
    });

    return router;
  }
}
