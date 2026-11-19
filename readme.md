# 🚲 Bike Service & Digital Maintenance Log API

A backend REST API for managing bicycle workshop operations, mechanic schedules, spare parts inventory, and digital maintenance history tied to a bike's unique frame number.

Built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, and **Prisma ORM**.

---

## 🎯 Key Engineering Highlights

* **ACID Transactions & Race-Condition Safe Inventory:** Order creation runs inside a single `prisma.$transaction`. Spare parts stock is decremented atomically using conditional updates (`stockQuantity >= requestedQuantity`), preventing negative inventory even under concurrent booking requests.
* **Conflict-Free Scheduling Engine:** Automatically calculates total service duration from selected tasks, detects overlapping appointments in a mechanic's schedule (`409 Conflict`), and generates available 30-minute booking slots for any given date.
* **Order Lifecycle & Automatic Stock Rollback:** Enforces state transitions (`PENDING` → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`). Cancelling an active order atomically returns reserved parts back to warehouse stock.
* **Historical Price Snapshotting:** Freezes service and part unit prices at the time of booking (`priceAtBooking`), ensuring historical service records remain accurate even when catalog prices change later.
* **Digital Service Book:** Exposes complete maintenance logs, mechanic notes, and replaced parts lookup by a bicycle's unique serial/frame number.
* **Type-Safe Validation:** Validates all request payloads and query parameters at runtime using **Zod** before hitting the service layer.

---

## 🛠 Tech Stack

* **Runtime & Language:** Node.js (v26 LTS), TypeScript
* **Web Framework:** Express.js
* **Database & ORM:** PostgreSQL 17, Prisma ORM
* **Validation:** Zod
* **Infrastructure:** Docker & Docker Compose

---

## 🗄 Database Architecture

The relational schema consists of 7 core models:

* `User` — System users with role-based distinction (`CLIENT`, `MECHANIC`, `ADMIN`).
* `Bike` — Registered bicycles linked to owners via a unique `frameNumber`.
* `ServiceType` — Workshop service catalog with base prices and estimated labor duration (in minutes).
* `Part` — Warehouse inventory tracked by `SKU` with current stock levels and unit prices.
* `ServiceOrder` — Central booking entity linking a bike, assigned mechanic, time window (`scheduledStart`, `scheduledEnd`), status, and total cost.
* `OrderServiceItem` & `OrderPartItem` — Join tables storing booked services, part quantities, and frozen `priceAtBooking` snapshots.

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v22+ or v26 LTS)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/bike-service-api.git
   cd bike-service-api
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/bike_service?schema=public"
   PORT=3000
   ```

3. **Start PostgreSQL via Docker Compose:**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations and seed initial data:**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3000`.

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check and server timestamp |
| `GET` | `/api/catalog` | Fetch all available workshop services and spare parts with stock levels |
| `GET` | `/api/resources` | Fetch registered mechanics and bikes (helper endpoint for testing) |
| `GET` | `/api/orders/availability` | Get free booking slots for a mechanic (`?mechanicId=...&date=YYYY-MM-DD&durationMinutes=60`) |
| `POST` | `/api/orders` | Create a new service order (validates schedule & deducts parts atomically) |
| `PATCH` | `/api/orders/:id/status` | Update order status (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |
| `GET` | `/api/orders/bike/:frameNumber` | Retrieve full digital service history for a specific frame number |

### Example Request: `POST /api/orders`

```json
{
  "bikeId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "mechanicId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "scheduledStart": "2026-11-25T10:00:00.000Z",
  "serviceIds": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ],
  "parts": [
    {
      "partId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "quantity": 1
    }
  ],
  "mechanicNotes": "Full drivetrain degrease and hot wax application"
}
```

---

## 🗺 Roadmap (Next Iterations)

* [ ] **Authentication & RBAC:** JWT-based login/registration with route protection (`CLIENT` vs `MECHANIC` permissions).
* [ ] **Automated Testing:** Integration test suite using **Vitest** and **Supertest** covering concurrency edge cases and schedule conflicts.
* [ ] **PDF Service Reports:** Server-side PDF generation summarizing completed work and parts used.
* [ ] **API Documentation:** Interactive OpenAPI / Swagger UI endpoint (`/api/docs`).