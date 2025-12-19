









import 'package:postgres/postgres.dart';
import 'package:bcrypt/bcrypt.dart';
import '../db/connection.dart';

Future<void> main() async {
  print('🔐 Starting password hashing migration...\n');

  try {
    
    await connectToDatabase();
    
    
    final users = await connection.execute(
      Sql.named('SELECT id, email, password FROM users'),
    );

    print('Found ${users.length} users in database.\n');

    int migratedCount = 0;
    int alreadyHashedCount = 0;

    for (final user in users) {
      final userId = user[0] as int;
      final email = user[1] as String;
      final currentPassword = user[2] as String;

      
      if (currentPassword.startsWith('\$2')) {
        print('  ⏭️  User $email - already hashed, skipping');
        alreadyHashedCount++;
        continue;
      }

      
      final hashedPassword = BCrypt.hashpw(currentPassword, BCrypt.gensalt());

      
      await connection.execute(
        Sql.named('UPDATE users SET password = @password WHERE id = @id'),
        parameters: {
          'password': hashedPassword,
          'id': userId,
        },
      );

      print('  ✅ User $email - password hashed successfully');
      migratedCount++;
    }

    print('\n========================================');
    print('Migration complete!');
    print('  - Passwords hashed: $migratedCount');
    print('  - Already hashed (skipped): $alreadyHashedCount');
    print('========================================\n');

  } catch (e) {
    print('❌ Migration failed: $e');
    rethrow;
  }
}
