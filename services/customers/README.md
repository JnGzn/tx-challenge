# Customers Service

Microservicio responsable de la gestión de clientes y cuentas bancarias. Expone una API HTTP REST y consume eventos de Kafka para aplicar movimientos de balance sobre las cuentas.

## Tabla de contenidos

- [Responsabilidades](#responsabilidades)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [API HTTP](#api-http)
- [Eventos Kafka](#eventos-kafka)
- [Idempotencia y DLQ](#idempotencia-y-dlq)
- [Ejecución local](#ejecución-local)

---

## Responsabilidades

- Crear y consultar clientes.
- Crear cuentas bancarias asociadas a un cliente.
- Consultar saldo de una cuenta.
- Procesar eventos `transaction.requested` para aplicar depósitos, retiros y transferencias sobre los balances.
- Publicar el resultado del movimiento como evento `balance.updated`.

---

## Variables de entorno

| Variable           | Requerida | Descripción                                      | Ejemplo                          |
|--------------------|-----------|--------------------------------------------------|----------------------------------|
| `HTTP_PORT`        | Si        | Puerto en el que escucha el servidor HTTP        | `3001`                           |
| `DATABASE_URL`     | Si        | Cadena de conexión PostgreSQL                    | `postgresql://...`               |
| `KAFKA_BROKERS`    | Si        | Lista de brokers Kafka separados por coma        | `localhost:9092`                 |
| `KAFKA_CLIENT_ID`  | Si        | Identificador del cliente Kafka                  | `customers-service`              |
| `KAFKA_GROUP_ID`   | Si        | Consumer group ID                                | `customers-consumer`             |
| `POSTGRES_PASSWORD`| Si        | Contraseña de PostgreSQL (requerida en Docker)   | `supersecret`                    |

Copiar `.env.example` a `.env` y completar los valores.

---

## Base de datos

PostgreSQL gestionado con Prisma. Modelos principales:

### `Client`
| Campo       | Tipo       | Descripción                  |
|-------------|------------|------------------------------|
| `id`        | UUID       | Identificador único          |
| `name`      | String     | Nombre completo              |
| `email`     | String     | Email único                  |
| `createdAt` | DateTime   | Fecha de creación            |
| `updatedAt` | DateTime   | Fecha de última modificación |

### `Account`
| Campo       | Tipo       | Descripción                          |
|-------------|------------|--------------------------------------|
| `id`        | UUID       | Identificador único                  |
| `number`    | String     | Número de cuenta único (`ACC-XXXXXXXXXX`) |
| `balance`   | Decimal    | Saldo actual (20,2)                  |
| `clientId`  | UUID       | FK al cliente propietario            |
| `createdAt` | DateTime   | Fecha de creación                    |
| `updatedAt` | DateTime   | Fecha de última modificación         |

### `ProcessedEvent`
Tabla de inbox para garantizar idempotencia en el procesamiento de eventos Kafka.

---

## API HTTP

Base URL: `http://localhost:{HTTP_PORT}`

### Clientes

#### `POST /clients`
Crea un nuevo cliente.

**Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com"
}
```

**Validaciones:**
- `name`: string, 2–120 caracteres.
- `email`: formato email válido, máx. 180 caracteres.

**Respuesta `201`:**
```json
{
  "id": "uuid",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

#### `GET /clients?email={email}`
Busca un cliente por email.

**Query params:**
- `email` (requerido): email válido.

**Respuesta `200`:** objeto `Client`.
**Respuesta `404`:** cliente no encontrado.

---

#### `GET /clients/accounts?email={email}`
Lista todas las cuentas de un cliente por email.

**Query params:**
- `email` (requerido): email válido.

**Respuesta `200`:** array de objetos `Account`.

---

### Cuentas

#### `POST /accounts`
Crea una nueva cuenta bancaria.

**Body:**
```json
{
  "clientId": "uuid",
  "number": "ACC-1234567890",
  "initialBalance": 500.00
}
```

**Validaciones:**
- `clientId`: UUID requerido. El cliente debe existir.
- `number`: string opcional. Si se omite, se genera automáticamente con formato `ACC-XXXXXXXXXX`.
- `initialBalance`: número opcional, mín. 0, máx. 2 decimales. Default `0`.

**Respuesta `201`:** objeto `Account`.
**Respuesta `404`:** cliente no encontrado.
**Respuesta `400`:** `initialBalance` negativo.

---

#### `GET /accounts/:id`
Obtiene una cuenta por ID.

**Params:**
- `id`: UUID.

**Respuesta `200`:** objeto `Account`.
**Respuesta `404`:** cuenta no encontrada.

---

#### `GET /accounts/:id/balance`
Obtiene el saldo actual de una cuenta.

**Params:**
- `id`: UUID.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "balance": "1500.00"
}
```

---

## Eventos Kafka

### Consumidos

#### `transaction.requested`
Solicitud de movimiento de balance. El servicio valida el payload, resuelve el handler correspondiente al tipo de transacción y aplica el cambio en base de datos dentro de una transacción atómica.

**Payload:**
```json
{
  "id": "uuid",
  "type": "DEPOSIT | WITHDRAWAL | TRANSFER",
  "amount": "100.00",
  "sourceAccountId": "uuid",
  "targetAccountId": "uuid",
  "requestedAt": "ISO8601"
}
```

**Reglas de validación:**
- `DEPOSIT`: requiere `targetAccountId`.
- `WITHDRAWAL`: requiere `sourceAccountId`. La cuenta debe tener saldo suficiente.
- `TRANSFER`: requiere `sourceAccountId` y `targetAccountId` distintos. La cuenta origen debe tener saldo suficiente.

### Publicados

#### `balance.updated`
Resultado del movimiento de balance, exitoso o rechazado.

**Payload (éxito):**
```json
{
  "transactionId": "uuid",
  "type": "DEPOSIT",
  "success": true,
  "movements": [
    {
      "accountId": "uuid",
      "previousBalance": "1000.00",
      "newBalance": "1100.00",
      "delta": "100.00"
    }
  ],
  "updatedAt": "ISO8601"
}
```

**Payload (rechazo):**
```json
{
  "transactionId": "uuid",
  "type": "WITHDRAWAL",
  "success": false,
  "reason": "Insufficient funds",
  "updatedAt": "ISO8601"
}
```

#### `client.created`
Publicado al crear un cliente exitosamente.

#### `account.created`
Publicado al crear una cuenta exitosamente.

---

## Idempotencia y DLQ

- Cada evento consumido se registra en `ProcessedEvent` dentro de la misma transacción de base de datos. Si el evento ya fue procesado (violación de unique constraint `P2002`), se descarta silenciosamente.
- Si ocurre un error **irrecuperable** (payload malformado, cuenta inexistente, amount inválido), el mensaje se enruta al topic `{topic}.dlq` en lugar de reintentar indefinidamente.

---

## Ejecución local

### Con Docker Compose (recomendado)

```bash
# Desde la raíz del proyecto, levantar Kafka primero
docker compose up -d

# Desde este directorio
cp .env.example .env   # editar POSTGRES_PASSWORD
docker compose up -d
```

### En local (sin Docker)

```bash
cp .env.example .env   # ajustar DATABASE_URL y KAFKA_BROKERS=localhost:29092
npm install
npm run prisma:migrate
npm run start:dev
```
