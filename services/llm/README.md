# LLM Service

Microservicio responsable de generar explicaciones en lenguaje natural sobre transacciones bancarias y resúmenes de actividad de cuentas, utilizando un modelo de lenguaje (Gemini). Consume eventos de Kafka para persistir el historial de transacciones y expone una API HTTP para consultar explicaciones bajo demanda.

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

- Escuchar los eventos `transaction.completed` y `transaction.rejected` y persistir su payload como historial.
- Generar una explicación en español de una transacción específica usando el LLM.
- Generar un resumen en español de la actividad reciente de una cuenta usando el LLM.

---

## Variables de entorno

| Variable           | Requerida | Descripción                                                    | Ejemplo               |
|--------------------|-----------|----------------------------------------------------------------|-----------------------|
| `HTTP_PORT`        | Si        | Puerto en el que escucha el servidor HTTP                      | `3003`                |
| `DATABASE_URL`     | Si        | Cadena de conexión PostgreSQL                                  | `postgresql://...`    |
| `KAFKA_BROKERS`    | Si        | Lista de brokers Kafka separados por coma                      | `localhost:9092`      |
| `KAFKA_CLIENT_ID`  | Si        | Identificador del cliente Kafka                                | `llm-service`         |
| `KAFKA_GROUP_ID`   | Si        | Consumer group ID                                              | `llm-consumer`        |
| `POSTGRES_PASSWORD`| Si        | Contraseña de PostgreSQL (requerida en Docker)                 | `supersecret`         |
| `GEMINI_API_KEY`   | Si        | API key de Google Gemini                                       | `AIza...`             |
| `GEMINI_MODEL`     | Si        | Modelo Gemini a utilizar                                       | `gemini-2.0-flash`    |
| `LLM_TEMPERATURE`  | No        | Temperatura de muestreo del LLM (0–2). Default `0.2`          | `0.2`                 |
| `LLM_HISTORY_LIMIT`| No        | Máximo de eventos cargados para el resumen de cuenta. Default `25` | `25`             |

Copiar `.env.example` a `.env` y completar los valores.

---

## Base de datos

PostgreSQL gestionado con Prisma.

### `Event`
Almacena el historial de eventos de transacciones recibidos desde Kafka.

| Campo           | Tipo            | Descripción                                      |
|-----------------|-----------------|--------------------------------------------------|
| `id`            | UUID            | Identificador interno                            |
| `eventId`       | String (unique) | Identificador del evento Kafka (`topic:partition:offset`) |
| `eventType`     | String          | Topic del evento (`transaction.completed`, etc.) |
| `transactionId` | UUID (nullable) | ID de la transacción relacionada                 |
| `accountId`     | UUID (nullable) | ID de la cuenta relacionada (origen o destino)   |
| `payload`       | JSON            | Payload completo del evento                      |
| `createdAt`     | DateTime        | Fecha de persistencia                            |

### `ProcessedEvent`
Tabla de inbox para garantizar idempotencia en el procesamiento de eventos Kafka.

---

## API HTTP

Base URL: `http://localhost:{HTTP_PORT}`

### `GET /explanations/transaction/:transactionId`
Genera una explicación en lenguaje natural de una transacción.

**Params:**
- `transactionId`: UUID de la transacción.

El servicio recupera todos los eventos persistidos para esa transacción, toma el más reciente y genera una explicación con el LLM:
- Si el evento es `transaction.completed`: confirmación concisa y amigable.
- Si el evento es `transaction.rejected`: explicación empática con el motivo y un siguiente paso sugerido.

**Respuesta `200`:**
```json
{
  "transactionId": "uuid",
  "explanation": "Tu depósito de $100.00 fue procesado exitosamente...",
  "events": [
    {
      "eventId": "transaction.completed:0:42",
      "eventType": "transaction.completed",
      "createdAt": "ISO8601"
    }
  ]
}
```

**Respuesta `404`:** no hay eventos para esa transacción.

---

### `GET /explanations/account/:accountId/summary`
Genera un resumen en lenguaje natural de la actividad reciente de una cuenta.

**Params:**
- `accountId`: UUID de la cuenta.

El servicio carga los últimos `LLM_HISTORY_LIMIT` eventos asociados a la cuenta (ordenados por fecha descendente) y genera un resumen con el LLM conservando los montos exactos.

**Respuesta `200`:**
```json
{
  "accountId": "uuid",
  "summary": "En los últimos días tu cuenta registró 3 depósitos por un total de $750.00..."
}
```

**Respuesta `404`:** no hay historial para esa cuenta.

---

## Eventos Kafka

### Consumidos

#### `transaction.completed`
Publicado por el servicio `transactions`. Se persiste el payload en la tabla `Event`.

#### `transaction.rejected`
Publicado por el servicio `transactions`. Se persiste el payload en la tabla `Event`.

**Payload común:**
```json
{
  "transactionId": "uuid",
  "type": "DEPOSIT | WITHDRAWAL | TRANSFER",
  "amount": "100.00",
  "sourceAccountId": "uuid",
  "targetAccountId": "uuid",
  "reason": "Insufficient funds",
  "completedAt": "ISO8601",
  "rejectedAt": "ISO8601"
}
```

---

## Idempotencia y DLQ

- El `eventId` se construye como `{topic}:{partition}:{offset}`, garantizando unicidad absoluta por mensaje Kafka.
- Si el offset no está disponible, el evento se enruta al DLQ como error irrecuperable para evitar romper la garantía de idempotencia.
- Cada evento se registra en `ProcessedEvent` dentro de la misma transacción de base de datos. Si ya fue procesado, se descarta.
- Errores irrecuperables (payload malformado, offset ausente) se enrutan al topic `{topic}.dlq`.

---

## Ejecución local

### Con Docker Compose (recomendado)

```bash
# Desde la raíz del proyecto, levantar Kafka primero
docker compose up -d

# Desde este directorio
cp .env.example .env   # editar POSTGRES_PASSWORD y GEMINI_API_KEY
docker compose up -d
```

### En local (sin Docker)

```bash
cp .env.example .env   # ajustar DATABASE_URL, KAFKA_BROKERS=localhost:29092 y GEMINI_API_KEY
npm install
npm run prisma:migrate
npm run start:dev
```
