import 'package:shelf/shelf.dart';



Middleware cors({String allowedOrigin = '*'}) {
  return (Handler innerHandler) {
    return (Request request) async {
      
      if (request.method.toUpperCase() == 'OPTIONS') {
        final headers = {
          'access-control-allow-origin': allowedOrigin,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'Origin, Content-Type, Authorization',
          'access-control-max-age': '3600',
        };
        return Response.ok('', headers: headers);
      }

      final response = await innerHandler(request);

      final newHeaders = Map<String, String>.from(response.headers);
      newHeaders['access-control-allow-origin'] = allowedOrigin;
      newHeaders['access-control-expose-headers'] = 'Content-Type, Authorization';

      return response.change(headers: newHeaders);
    };
  };
}
