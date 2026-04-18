# Arkano Challenge — Documentación General

Sistema de banca basado en microservicios. Cada servicio es independiente, tiene su propia base de datos PostgreSQL y se comunica de forma asíncrona a través de Kafka.

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Microservicios](#microservicios)
- [Flujos principales](#flujos-principales)
- [Infraestructura](#infraestructura)
- [Topics Kafka](#topics-kafka)
- [Patrones transversales](#patrones-transversales)
- [Ejecución local](#ejecución-local)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                          Cliente HTTP                           │
└───────────┬─────────────────────┬───────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  customers        │   │  transactions     │   │  llm              │
│  :3001            │   │  :3002            │   │  :3003            │
│                   │   │                   │   │                   │
│  - Clientes       │   │  - Transacciones  │   │  - Explicaciones  │
│  - Cuentas        │   │  - Ciclo de vida  │   │  - Resúmenes      │
│  - Balances       │   │                   │   │  - Historial      │
└────────┬──────────┘   └────────┬──────────┘   └────────┬──────────┘
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │         Kafka           │
                    │   (Apache Kafka KRaft)  │
                    └─────────────────────────┘
         │                       │                        │
┌────────▼──────────┐   ┌────────▼──────────┐   ┌────────▼──────────┐
│  PostgreSQL       │   │  PostgreSQL       │   │  PostgreSQL       │
│  customers DB     │   │  transactions DB  │   │  llm DB           │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Microservicios

| Servicio       | Puerto | Descripción                                                  | README                                    |
|----------------|--------|--------------------------------------------------------------|-------------------------------------------|
| `customers`    | 3001   | Gestión de clientes, cuentas y movimientos de balance        | [README](./services/customers/README.md)  |
| `transactions` | 3002   | Ciclo de vida de transacciones (PENDING → COMPLETED/REJECTED)| [README](./services/transactions/README.md)|
| `llm`          | 3003   | Explicaciones y resúmenes en lenguaje natural con Gemini     | [README](./services/llm/README.md)        |

---

## Flujos principales

### 1. Crear cliente y cuenta

```
Cliente HTTP
    │
    ├─ POST /clients ──────────────────► customers
    │                                       │
    │                                       ├─ Persiste Client en DB
    │                                       └─ Publica client.created
    │
    └─ POST /accounts ─────────────────► customers
                                            │
                                            ├─ Valida que el cliente exista
                                            ├─ Persiste Account en DB
                                            └─ Publica account.created
```

---

### 2. Solicitar una transacción

```
Cliente HTTP
    │
    └─ POST /transactions ─────────────► transactions
                                            │
                                            ├─ Valida reglas de negocio
                                            ├─ Persiste Transaction (PENDING)
                                            └─ Publica transaction.requested
                                                        │
                                                        ▼
                                                   customers
                                                        │
                                                        ├─ Valida payload
                                                        ├─ Aplica movimiento de balance (atómico)
                                                        └─ Publica balance.updated
                                                                    │
                                                                    ▼
                                                              transactions
                                                                    │
                                                                    ├─ Actualiza Transaction (COMPLETED / REJECTED)
                                                                    └─ Publica transaction.completed / transaction.rejected
                                                                                    │
                                                                                    ▼
                                                                                  llm
                                                                                    │
                                                                                    └─ Persiste evento en historial
```

---

### 3. Consultar explicación de una transacción

```
Cliente HTTP
    │
    └─ GET /explanations/transaction/:id ──► llm
                                                │
                                                ├─ Carga eventos del historial
                                                ├─ Llama a Gemini con el payload
                                                └─ Retorna explicación en español
```

---

### 4. Consultar resumen de cuenta

```
Cliente HTTP
    │
    └─ GET /explanations/account/:id/summary ──► llm
                                                    │
                                                    ├─ Carga últimos N eventos de la cuenta
                                                    ├─ Llama a Gemini con el historial
                                                    └─ Retorna resumen en español
```

---

## Infraestructura

Definida en `docker-compose.yml` en la raíz del proyecto.

### Servicios incluidos

| Servicio      | Imagen                | Puerto externo | Descripción                        |
|---------------|-----------------------|----------------|------------------------------------|
| `kafka`       | `apache/kafka:4.1.2`  | 9092, 29092    | Broker Kafka en modo KRaft         |
| `kafka-init`  | `apache/kafka:4.1.2`  | —              | Inicializa topics al arrancar      |

> Las bases de datos PostgreSQL de cada microservicio se definen en los `docker-compose.yml` individuales dentro de cada servicio.

### Levantar la infraestructura

```bash
docker compose up -d
```

Esto levanta Kafka y crea todos los topics necesarios con 6 particiones y retención de 14 días (DLQ: 30 días). La creación automática de topics está deshabilitada (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`) para evitar topics basura por errores tipográficos.

---

## Topics Kafka

| Topic                       | Productor      | Consumidor(es)          | Descripción                                      |
|-----------------------------|----------------|-------------------------|--------------------------------------------------|
| `transaction.requested`     | transactions   | customers               | Solicitud de movimiento de balance               |
| `balance.updated`           | customers      | transactions            | Resultado del movimiento (éxito o rechazo)       |
| `transaction.completed`     | transactions   | llm                     | Transacción completada exitosamente              |
| `transaction.rejected`      | transactions   | llm                     | Transacción rechazada                            |
| `client.created`            | customers      | —                       | Nuevo cliente creado                             |
| `account.created`           | customers      | —                       | Nueva cuenta creada                              |
| `*.dlq`                     | cualquiera     | —                       | Dead Letter Queue para errores irrecuperables    |

---

## Patrones transversales

### Idempotencia (Inbox pattern)
Todos los servicios implementan el patrón Inbox: cada evento consumido se registra en la tabla `ProcessedEvent` dentro de la misma transacción de base de datos. Si el evento ya fue procesado (unique constraint), se descarta silenciosamente sin error.

### Dead Letter Queue (DLQ)
Los errores irrecuperables (payload malformado, entidad no encontrada, formato inválido) no se reintentan. El mensaje se enruta al topic `{topic}.dlq` con metadatos del error para su inspección posterior.

### Validación de entorno
Cada servicio valida sus variables de entorno al arrancar usando `class-validator`. Si falta alguna variable requerida, el proceso falla inmediatamente con un mensaje descriptivo.

### Separación de responsabilidades
- Los **controllers** solo reciben y delegan.
- Los **services** contienen la lógica de negocio.
- Los **repositories** abstraen el acceso a datos (interfaces + implementaciones Prisma).
- Los **consumers** orquestan el flujo de eventos delegando al service correspondiente.

---

## Ejecución local

### Prerrequisitos

- Docker y Docker Compose

### Con Docker Compose (recomendado)

```bash
# 1. Levantar infraestructura (Kafka)
docker compose up -d

# 2. Configurar cada servicio
cd services/customers && cp .env.example .env   # editar POSTGRES_PASSWORD
cd services/transactions && cp .env.example .env # editar POSTGRES_PASSWORD
cd services/llm && cp .env.example .env          # editar POSTGRES_PASSWORD y GEMINI_API_KEY

# 3. Levantar cada servicio
cd services/customers && docker compose up -d
cd services/transactions && docker compose up -d
cd services/llm && docker compose up -d
```

> Cada servicio ejecuta `prisma migrate deploy` automáticamente al arrancar antes de iniciar el servidor.

### En local (sin Docker)

Adicional a Docker, requiere Node.js >= 22 y una instancia PostgreSQL accesible.

```bash
# 1. Levantar infraestructura (Kafka)
docker compose up -d

# 2. Configurar y arrancar cada servicio (en terminales separadas)
cd services/customers
cp .env.example .env   # ajustar DATABASE_URL y KAFKA_BROKERS=localhost:29092
npm install && npm run prisma:migrate && npm run start:dev

cd services/transactions
cp .env.example .env   # ajustar DATABASE_URL y KAFKA_BROKERS=localhost:29092
npm install && npm run prisma:migrate && npm run start:dev

cd services/llm
cp .env.example .env   # ajustar DATABASE_URL, KAFKA_BROKERS=localhost:29092 y GEMINI_API_KEY
npm install && npm run prisma:migrate && npm run start:dev
```

### Puertos

| Servicio       | Puerto |
|----------------|--------|
| `customers`    | 3001   |
| `transactions` | 3002   |
| `llm`          | 3003   |
| Kafka          | 29092  |
