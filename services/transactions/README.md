# Transactions Service

Microservicio responsable del ciclo de vida de las transacciones bancarias. Expone una API HTTP REST para crear y consultar transacciones, y consume eventos de Kafka para actualizar su estado según el resultado del procesamiento de balance.

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

- Registrar solicitudes de transacción (depósito, retiro, transferencia) con estado inicial `PENDING`.
- Publicar el evento `transaction.requested` para que el servicio `customers` procese el movimiento de balance.
- Escuchar el evento `balance.updated` y actualizar el estado de la transacción a `COMPLETED` o `REJECTED`.
- Publicar `transaction.completed` o `transaction.rejected` según el resultado.
- Exponer endpoints para consultar transacciones individuales y listarlas con filtros.

---

## Variables de entorno

| Variable                  | Requerida | Descripción                                        | Ejemplo                    |
|---------------------------|-----------|----------------------------------------------------|----------------------------|
| `HTTP_PORT`               | Si        | Puerto en el que escucha el servidor HTTP          | `3002`                     |
| `DATABASE_URL`            | Si        | Cadena de conexión PostgreSQL                      | `postgresql://...`         |
| `KAFKA_BROKERS`           | Si        | Lista de brokers Kafka separados por coma          | `localhost:9092`           |
| `KAFKA_CLIENT_ID`         | Si        | Identificador del cliente Kafka                    | `transactions-service`     |
| `KAFKA_GROUP_ID`          | Si        | Consumer group ID                                  | `transactions-consumer`    |
| `POSTGRES_PASSWORD`       | Si        | Contraseña de PostgreSQL (requerida en Docker)     | `supersecret`              |
| `TRANSACTIONS_LIST_LIMIT` | No        | Máximo de filas en `GET /transactions`. Default `100` | `100`                   |

Copiar `.env.example` a `.env` y completar los valores.

---

## Base de datos

PostgreSQL gestionado con Prisma.

### `Transaction`
| Campo             | Tipo               | Descripción                                      |
|-------------------|--------------------|--------------------------------------------------|
| `id`              | UUID               | Identificador único (puede ser el `idempotencyKey` del cliente) |
| `type`            | Enum               | `DEPOSIT`, `WITHDRAWAL`, `TRANSFER`              |
| `status`          | Enum               | `PENDING`, `COMPLETED`, `REJECTED`               |
| `amount`          | Decimal (20,2)     | Monto de la transacción                          |
| `sourceAccountId` | UUID (nullable)    | Cuenta origen (WITHDRAWAL / TRANSFER)            |
| `targetAccountId` | UUID (nullable)    | Cuenta destino (DEPOSIT / TRANSFER)              |
| `reason`          | String (nullable)  | Motivo de rechazo                                |
| `requestedAt`     | DateTime           | Fecha de creación                                |
| `completedAt`     | DateTime (nullable)| Fecha de completado                              |
| `rejectedAt`      | DateTime (nullable)| Fecha de rechazo                                 |

### `ProcessedEvent`
Tabla de inbox para garantizar idempotencia en el procesamiento de eventos Kafka.

---

## API HTTP

Base URL: `http://localhost:{HTTP_PORT}`

### `POST /transactions`
Crea una nueva solicitud de transacción.

**Body:**
```json
{
  "type": "DEPOSIT",
  "amount": 100.00,
  "targetAccountId": "uuid",
  "idempotencyKey": "uuid"
}
```

**Validaciones:**
- `type`: enum requerido — `DEPOSIT`, `WITHDRAWAL`, `TRANSFER`.
- `amount`: número requerido, mín. `0.01`, máx. 2 decimales.
- `sourceAccountId`: UUID. Requerido para `WITHDRAWAL` y `TRANSFER`.
- `targetAccountId`: UUID. Requerido para `DEPOSIT` y `TRANSFER`.
- `idempotencyKey`: UUID opcional. Si se omite, se genera uno automáticamente. Permite reintentar la misma solicitud sin crear duplicados.
- En `TRANSFER`, `sourceAccountId` y `targetAccountId` deben ser distintos.

**Respuesta `201`:** objeto `Transaction` con `status: "PENDING"`.
**Respuesta `400`:** validación fallida.
**Respuesta `409`:** `idempotencyKey` ya utilizado.

---

### `GET /transactions/:id`
Obtiene una transacción por ID.

**Params:**
- `id`: UUID.

**Respuesta `200`:** objeto `Transaction`.
**Respuesta `404`:** transacción no encontrada.

---

### `GET /transactions`
Lista transacciones con filtros opcionales.

**Query params:**

| Param       | Tipo   | Descripción                                      |
|-------------|--------|--------------------------------------------------|
| `status`    | Enum   | Filtrar por `PENDING`, `COMPLETED`, `REJECTED`   |
| `type`      | Enum   | Filtrar por `DEPOSIT`, `WITHDRAWAL`, `TRANSFER`  |
| `accountId` | UUID   | Filtrar por cuenta origen o destino              |

**Respuesta `200`:** array de objetos `Transaction`. Limitado por `TRANSACTIONS_LIST_LIMIT`.

---

## Eventos Kafka

### Publicados

#### `transaction.requested`
Publicado al crear una transacción. Lo consume el servicio `customers`.

**Payload:**
```json
{
  "id": "uuid",
  "type": "TRANSFER",
  "amount": "250.00",
  "sourceAccountId": "uuid",
  "targetAccountId": "uuid",
  "requestedAt": "ISO8601"
}
```

#### `transaction.completed`
Publicado cuando el balance fue actualizado exitosamente.

**Payload:**
```json
{
  "transactionId": "uuid",
  "type": "TRANSFER",
  "amount": "250.00",
  "sourceAccountId": "uuid",
  "targetAccountId": "uuid",
  "movements": [
    {
      "accountId": "uuid",
      "previousBalance": "1000.00",
      "newBalance": "750.00",
      "delta": "-250.00"
    },
    {
      "accountId": "uuid",
      "previousBalance": "500.00",
      "newBalance": "750.00",
      "delta": "250.00"
    }
  ],
  "completedAt": "ISO8601"
}
```

#### `transaction.rejected`
Publicado cuando el movimiento de balance fue rechazado.

**Payload:**
```json
{
  "transactionId": "uuid",
  "type": "WITHDRAWAL",
  "amount": "5000.00",
  "sourceAccountId": "uuid",
  "reason": "Insufficient funds",
  "rejectedAt": "ISO8601"
}
```

### Consumidos

#### `balance.updated`
Publicado por el servicio `customers`. Actualiza el estado de la transacción y publica el evento de resultado correspondiente.

---

## Idempotencia y DLQ

- El `idempotencyKey` del request HTTP se usa como `id` de la transacción, evitando duplicados ante reintentos del cliente.
- Cada evento `balance.updated` se registra en `ProcessedEvent` con clave `{transactionId}:{updatedAt}`. Si ya fue procesado, se descarta.
- Errores irrecuperables (transacción no encontrada, payload malformado) se enrutan al topic `balance.updated.dlq`.

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
