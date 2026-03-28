# EcoTrack Backend API — v2.0.0

Node.js + Express + Prisma ORM + **Supabase PostgreSQL**  
Multi-company carbon footprint tracking with full JWT auth and heavy security.

---

## 🗺️ Architecture: Multi-Company Per User

```
User (1) ──────────► Companies (many)
                          │
                          └──► EmissionEntries (many, scoped per company)
                          └──► Reports (generated from entries per company)
```

One user can own unlimited company profiles. All emission data, analytics,
and reports are completely isolated per company — switching companies in the
frontend shows entirely different data.

---

## 🗄️ Database: Supabase PostgreSQL

### Setup Steps

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → Connection string**
3. Copy the **URI** (Transaction mode, port 6543) → `DATABASE_URL`
4. Copy the **URI** (Session mode, port 5432)      → `DIRECT_URL`

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd ecotrack-backend
npm install

# 2. Set environment variables
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, and JWT secrets

# 3. Generate Prisma client
npm run db:generate

# 4. Push schema to Supabase
npm run db:push

# 5. Seed demo data (3 companies, 12 months each)
npm run db:seed

# 6. Start server
npm run dev        # development (nodemon)
npm start          # production
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|----------------|
| JWT access tokens | 15-minute expiry, RS256-equivalent |
| Refresh token rotation | Single-use, DB-stored, 7-day expiry |
| Brute-force protection | Account locked after 5 failed logins (15 min) |
| Helmet.js | Security headers on every response |
| CORS whitelist | Only `FRONTEND_URL` allowed |
| Rate limiting | 200 req/15 min global; 10 req/15 min on auth |
| Input validation | express-validator on all write endpoints |
| Company ownership | Every emission/report endpoint verifies `userId` === company owner |
| Password hashing | bcrypt with 12 salt rounds |
| No email enumeration | Generic "Invalid email or password" on failed login |
| SQL injection | Prisma parameterised queries throughout |
| Request size limit | 2 MB body cap |

---

## 📁 Project Structure

```
ecotrack-backend/
├── prisma/
│   ├── schema.prisma          # Multi-company schema
│   └── seed.js                # Demo data (3 companies)
├── src/
│   ├── config/
│   │   ├── database.js        # Prisma client singleton
│   │   └── jwt.js             # JWT config (throws if secrets missing)
│   ├── controllers/
│   │   ├── authController.js       # register, login (brute-force), refresh, logout, getMe
│   │   ├── companyController.js    # CRUD for companies
│   │   ├── emissionsController.js  # CRUD + analytics (scoped to company)
│   │   └── reportsController.js    # Report generation (scoped to company)
│   ├── middleware/
│   │   ├── auth.js            # JWT verification + company ownership guard
│   │   ├── errorHandler.js    # Global error + 404 handler
│   │   └── validate.js        # express-validator result handler
│   ├── routes/
│   │   ├── auth.js            # /api/auth/*
│   │   ├── companies.js       # /api/companies/*
│   │   ├── emissions.js       # /api/companies/:id/emissions/*
│   │   └── reports.js         # /api/companies/:id/reports/*
│   ├── utils/
│   │   └── carbonCalculator.js     # GHG Protocol emission factors
│   ├── app.js                 # Express app setup
│   └── server.js              # Entry point + graceful shutdown
├── .env.example
└── package.json
```

---

## 🔌 API Reference

### Auth — `/api/auth`

| Method | Path | Body | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/register` | firstName, lastName, email, password | ✗ | Create account |
| POST | `/login`    | email, password | ✗ | Login — returns user + all companies |
| POST | `/refresh`  | refreshToken | ✗ | Rotate access+refresh tokens |
| POST | `/logout`   | refreshToken | ✗ | Revoke refresh token |
| GET  | `/me`       | — | ✓ | Current user + all their companies |

### Companies — `/api/companies`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/`         | ✓ | List all companies for user |
| POST   | `/`         | ✓ | Create a new company profile |
| GET    | `/:id`      | ✓ | Get one company |
| PUT    | `/:id`      | ✓ | Update company |
| DELETE | `/:id`      | ✓ | Soft-delete company |

### Emissions — `/api/companies/:companyId/emissions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/`          | ✓ | All entries for this company |
| POST   | `/`          | ✓ | Create monthly entry |
| GET    | `/monthly`   | ✓ | 12-month chart data |
| GET    | `/breakdown` | ✓ | Scope breakdown for pie chart |
| GET    | `/total`     | ✓ | Current month total |
| GET    | `/yearly`    | ✓ | Year-over-year comparison |
| GET    | `/:id`       | ✓ | Single entry |
| PUT    | `/:id`       | ✓ | Update entry (recalculates) |
| DELETE | `/:id`       | ✓ | Delete entry |

### Reports — `/api/companies/:companyId/reports`

| Method | Path | Query | Auth | Description |
|--------|------|-------|------|-------------|
| GET | `/`        | `month`, `year` | ✓ | Generate report for period |
| GET | `/history` | — | ✓ | List all periods with data |

---

## 📊 GHG Protocol Emission Factors

| Source | Factor |
|--------|--------|
| Diesel | 2.68 kg CO₂e / litre |
| Petrol | 2.31 kg CO₂e / litre |
| Kenya electricity | 0.15 kg CO₂e / kWh |
| South Africa electricity | 0.90 kg CO₂e / kWh |
| Landfill waste | 0.58 kg CO₂e / kg |
| Short-haul flight | 0.15 kg CO₂e / km |
| Long-haul flight (>1500 km) | 0.12 kg CO₂e / km |

---

## 🌱 Demo Credentials

After running `npm run db:seed`:

```
Email:    demo@ecotrack.com
Password: Demo@1234

Companies:
  1. XYZ Traders          — Retail,      Nairobi, Kenya       (50 employees)
  2. GreenTech Solutions  — Technology,  Mombasa, Kenya       (25 employees)
  3. Savanna Hospitality  — Hospitality, Cape Town, S. Africa (120 employees)
```

Each company has 12 months of emission data for the current year.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Supabase pooler URL (port 6543) |
| `DIRECT_URL` | ✅ | — | Supabase direct URL (port 5432) |
| `JWT_SECRET` | ✅ | — | Min 64-char random secret |
| `JWT_EXPIRES_IN` | ✗ | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | ✅ | — | Min 64-char random secret |
| `JWT_REFRESH_EXPIRES_IN` | ✗ | `7d` | Refresh token TTL |
| `PORT` | ✗ | `3000` | Server port |
| `NODE_ENV` | ✗ | `development` | Environment |
| `FRONTEND_URL` | ✗ | `http://localhost:5173` | CORS allowed origin |
| `RATE_LIMIT_MAX` | ✗ | `200` | Global rate limit per 15 min |
| `AUTH_RATE_LIMIT_MAX` | ✗ | `10` | Auth endpoints rate limit |
