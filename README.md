# Jyotron - AI-Powered Astrology Platform

Jyotron is an AI-powered astrology ecosystem delivering personalized consultations, palmistry readings, horoscope predictions, Kundli analysis, and spiritual guidance across iOS, Android, and Web platforms.

## Architecture

```
jyotron/
├── apps/
│   ├── web/          # Next.js 15 web application (TypeScript + Tailwind CSS v4)
│   ├── api/          # NestJS backend with microservices
│   └── mobile/       # React Native mobile app (iOS + Android)
├── packages/
│   └── shared/       # Shared types, constants, and utilities
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Mobile | React Native (iOS + Android) |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL 16 (Prisma ORM) |
| Cache | Redis 7 |
| AI/LLM | OpenAI GPT-4 / Claude, LangChain |
| Vector DB | Pinecone (for RAG) |
| Vision AI | OpenCV, MediaPipe, TensorFlow |
| Payments | Razorpay (UPI, cards, subscriptions) |
| Infrastructure | Docker, AWS EKS |

## Features

- **AI Astrologer Chat** - Specialized AI agents for career, relationships, finance, health, and spiritual guidance
- **Palmistry Reading** - Camera/upload-based AI palm analysis
- **Kundli Generator** - Complete Vedic birth chart with Dasha periods and Yogas
- **Kundli Matching** - Ashtakoota Guna Milan compatibility analysis
- **Daily Horoscope** - Personalized daily, weekly, monthly, yearly predictions
- **Daily Panchang** - Hindu calendar with Tithi, Nakshatra, Rahu Kaal
- **Muhurat Finder** - Auspicious dates for life events
- **Dosha Detection** - Kaal Sarp, Manglik, Pitru Dosha with remedies
- **Premium Reports** - AI-generated PDF reports (Life, Career, Marriage, Wealth)

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/xploroshan/jyotron.git
cd jyotron

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### Development Commands

```bash
npm run dev:web    # Start web app (port 3000)
npm run dev:api    # Start API server (port 3001)
npm run db:migrate # Run Prisma migrations
npm run db:seed    # Seed database
npm run build      # Build all apps
npm run lint       # Lint all apps
```

## API Documentation

Once the API server is running, Swagger docs are available at:
```
http://localhost:3001/api/docs
```

## Monetization

| Revenue Stream | Pricing |
|---------------|---------|
| AI Chat Credits | 10 questions = INR 99, 50 = INR 399, 100 = INR 699 |
| Monthly Plan | INR 499/month (unlimited) |
| Annual Plan | INR 4,999/year (2 months free) |
| Premium Reports | INR 599 - INR 999 |
| Palm Reading | INR 199/scan (premium detail) |

## Environment Variables

See `apps/api/.env.example` and `apps/web/.env.example` for required configuration.

## License

Proprietary - All rights reserved.

## Disclaimer

Jyotron is for entertainment and spiritual guidance purposes only. Not a substitute for professional advice.
