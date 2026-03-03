# SecurePay DAM - Simplified Version

Versión simplificada de SecurePay con solo 2 microservicios (Auth + Transfer).

## 📁 Estructura

```
securepay-dam/
├── docker-compose.yml
├── database/
│   └── init.sql
├── auth-service/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
└── transfer-service/
    ├── Dockerfile
    ├── package.json
    └── server.js
```

## 🚀 Iniciar

```bash
cd securepay-dam
docker-compose up --build
```

### Acceso

- **Auth Service**: http://localhost:3001
- **Transfer Service**: http://localhost:3002

## 📊 Servicios

### Auth Service (Puerto 3001)
- Registro de usuarios
- Login con JWT
- Verificación de tokens
- Perfil de usuario

### Transfer Service (Puerto 3002)
- Obtener cuentas del usuario
- Crear transferencias
- Historial de transferencias

## 🧪 Credenciales de Prueba

| Username | Password |
|----------|----------|
| john_doe | password |
| jane_smith | password |
| admin | password |

## 📝 Endpoints

### Registro
```bash
POST http://localhost:3001/register
Content-Type: application/json

{
  "username": "new_user",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "Full Name"
}
```

### Login
```bash
POST http://localhost:3001/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password"
}
```

### Obtener Cuentas
```bash
GET http://localhost:3002/accounts
X-User-Id: 2
Authorization: Bearer <token>
```

### Crear Transferencia
```bash
POST http://localhost:3002/create
X-User-Id: 2
Authorization: Bearer <token>
Content-Type: application/json

{
  "from_account_id": 1,
  "to_account_id": 3,
  "amount": 100.50,
  "description": "Payment"
}
```

### Historial de Transferencias
```bash
GET http://localhost:3002/history/1
X-User-Id: 2
Authorization: Bearer <token>
```

## 🐳 Comandos Docker

```bash
# Iniciar
docker-compose up --build

# Detener
docker-compose down

# Ver logs
docker-compose logs -f auth-service
docker-compose logs -f transfer-service

# Acceder a base de datos
docker-compose exec postgres psql -U securepay_user -d securepay
```

## 🔐 Seguridad

- ✓ Autenticación JWT
- ✓ Contraseñas hasheadas (bcryptjs)
- ✓ Queries parametrizadas (prevención SQL injection)
- ✓ Validación de entrada
- ✓ Helmet security headers
- ✓ CORS habilitado

---

**Versión simplificada para DAM/Educación**
