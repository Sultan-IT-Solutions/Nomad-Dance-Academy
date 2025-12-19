import 'package:postgres/postgres.dart';

import '../env.dart';

late Connection connection;

Future<void> connectToDatabase() async {
  final host = Env.require('DB_HOST');
  final port = int.parse(Env.require('DB_PORT'));
  final dbName = Env.require('DB_NAME');
  final user = Env.require('DB_USER');
  final password = Env.get('DB_PASSWORD') ?? '';

  print('🔌 Attempting to connect to PostgreSQL...');
  print('   Host: $host, Port: $port, Database: $dbName, User: $user');

  try {
    
    print('💡 Trying Unix socket connection...');
    connection = await Connection.open(
      Endpoint(
        host: '/tmp',  
        database: dbName,
        username: user,
      ),
      settings: const ConnectionSettings(sslMode: SslMode.disable),
    );
    print('✅ Connected to PostgreSQL via Unix socket!');
  } catch (e) {
    print('❌ Failed to connect via Unix socket: $e');
    print('💡 Trying TCP connection on port $port...');
    
    try {
      connection = await Connection.open(
        Endpoint(
          host: host,
          port: port,
          database: dbName,
          username: user,
          password: password.isEmpty ? null : password,
        ),
        settings: const ConnectionSettings(sslMode: SslMode.disable),
      );
      print('✅ Connected to PostgreSQL successfully!');
    } catch (e2) {
      print('❌ Failed to connect to PostgreSQL on port $port');
      print('Error: $e2');
      print('');
      print('🔧 Troubleshooting tips:');
      print('1. Make sure PostgreSQL is running');
      print('2. Fix Postgres.app permissions (see https:
      print('3. Try: open -a Postgres → Preferences → App Permissions');
      rethrow;
    }
  }

  await _bootstrapSchema();
}

Future<void> _bootstrapSchema() async {
  
  await connection.execute('''
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ''');
  
  
  await connection.execute('''
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS halls (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      capacity INT NOT NULL CHECK (capacity > 0)
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      hourly_rate NUMERIC(10,2),
      bio TEXT
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      parent_phone TEXT NOT NULL,
      comment TEXT,
      trial_used BOOLEAN NOT NULL DEFAULT FALSE,
      subscription_until DATE
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      hall_id INT REFERENCES halls(id) ON DELETE SET NULL,
      main_teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
      start_time TIMESTAMPTZ,
      duration_minutes INT NOT NULL DEFAULT 90,
      capacity INT NOT NULL DEFAULT 12,
      is_additional BOOLEAN NOT NULL DEFAULT FALSE,
      is_closed BOOLEAN NOT NULL DEFAULT FALSE
    );
  ''');

  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 90;
  ''');
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 12;
  ''');
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS is_additional BOOLEAN NOT NULL DEFAULT FALSE;
  ''');
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;
  ''');

  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS recurring_days TEXT;
  ''');
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS recurring_until DATE;
  ''');
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS class_name TEXT;
  ''');
  
  await connection.execute('''
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      class_name TEXT NOT NULL,
      teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
      hall_id INT REFERENCES halls(id) ON DELETE SET NULL,
      start_time TIMESTAMPTZ NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 90,
      is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
      is_rescheduled BOOLEAN NOT NULL DEFAULT FALSE,
      substitute_teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ''');

  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_lessons_group_time 
      ON lessons(group_id, start_time);
  ''');
  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_lessons_teacher 
      ON lessons(teacher_id);
  ''');
  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_lessons_hall_time 
      ON lessons(hall_id, start_time);
  ''');

  await connection.execute('''
    ALTER TABLE schedule_exceptions
      ADD COLUMN IF NOT EXISTS class_name TEXT;
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS group_teachers (
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, teacher_id)
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS group_students (
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      is_trial BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, student_id)
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS schedule_exceptions (
      id SERIAL PRIMARY KEY,
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
      hall_id INT REFERENCES halls(id) ON DELETE SET NULL,
      start_time TIMESTAMPTZ NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 90,
      class_name TEXT,
      reason TEXT,
      additional BOOLEAN NOT NULL DEFAULT FALSE,
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      requested_by_student BOOLEAN NOT NULL DEFAULT FALSE
    );
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS attendance_records (
      id BIGSERIAL PRIMARY KEY,
      group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
      attended BOOLEAN NOT NULL,
      teacher_present BOOLEAN NOT NULL DEFAULT TRUE,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ''');

  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_group_students_group
      ON group_students(group_id);
  ''');
  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_attendance_group
      ON attendance_records(group_id);
  ''');
  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_attendance_teacher
      ON attendance_records(teacher_id);
  ''');

  await connection.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('group_scheduled', 'group_cancelled', 'group_rescheduled')),
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ''');

  await connection.execute('''
    CREATE INDEX IF NOT EXISTS idx_notifications_student
      ON notifications(student_id);
  ''');

  print('✅ Database schema verified.');
}
