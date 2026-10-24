# 🛡️ TrustLens AI
### AI-Powered Digital Trust & Scam Intelligence Platform

TrustLens AI is a web-based platform designed to help users identify potential online scams, phishing attempts, suspicious URLs, and fraudulent messages. It provides risk assessments, explains suspicious indicators, and recommends safety actions.

🌐 **Live Demo:** [TrustLens AI](https://trust-lens-ai-fresh.vercel.app/)

📂 **GitHub Repository:** [TrustLens-AI-Fresh](https://github.com/sandhyabalakumar06-coder/TrustLens-AI-Fresh)

---

## 🎯 Problem Statement

Online scams, phishing websites, fake job offers, and fraudulent messages are becoming increasingly common. Users may find it difficult to distinguish legitimate communications from suspicious ones.

TrustLens AI aims to make scam awareness easier by analyzing submitted content and presenting understandable risk indicators and safety recommendations.

## ✨ Key Features

- 🔐 **User Authentication** — User registration and login.
- 🌐 **Website Scam Scanner** — Analyze URLs for potential suspicious indicators.
- 📧 **Email Phishing Detection** — Identify potentially suspicious email content.
- 💬 **Scam Message Analysis** — Analyze suspicious messages.
- 📱 **QR Code Analysis** — Inspect QR codes for potentially unsafe destinations.
- 📊 **Trust Score & Scam Probability** — Present an estimated risk assessment.
- 🔍 **Explainable Detection** — Display detected indicators and recommended actions.
- 🧾 **Payment Screenshot Analysis** — Extract visible transaction details using OCR and flag inconsistencies for review.
- 🇮🇳 **Multilingual Scam Detection** — Designed to support Tamil, English, and Tanglish scam messages.
- 📜 **Scan History** — Keep track of previous analyses.
- 📈 **Dashboard** — Present scan information and risk insights.

*Feature availability depends on the current implementation.*

## 🛠️ Technology Stack

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS

**Backend**
- Node.js
- Express.js
- TypeScript

**Database**
- PostgreSQL
- Prisma ORM

**Deployment**
- Vercel — Frontend
- Render — Backend
- Neon — PostgreSQL Database

## 🏗️ System Architecture

```text
            User
              |
              v
     Next.js Frontend
        (Vercel)
              |
              v
      Express Backend
        (Render)
              |
              v
      Prisma ORM
              |
              v
      PostgreSQL
         (Neon)
```

## 🚀 Live Deployment

- **Frontend:** https://trust-lens-ai-fresh.vercel.app/
- **Backend:** Hosted on Render.
- **Database:** Hosted on Neon PostgreSQL.

## ⚙️ Local Setup

### Prerequisites

- Node.js
- npm
- PostgreSQL or a configured Neon database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/sandhyabalakumar06-coder/TrustLens-AI-Fresh.git
cd TrustLens-AI-Fresh
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory and configure the required environment variables:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
DATABASE_URL=YOUR_DATABASE_CONNECTION_STRING
JWT_SECRET=YOUR_SECRET_VALUE
JWT_EXPIRES_IN=1d
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
```

Replace the placeholder values with your own configuration. Never commit real credentials or API keys.

Generate the Prisma client and apply database migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend:

```bash
npm run dev
```

### 3. Configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create a `.env.local` file inside `frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Ensure the API URL matches the backend URL and route structure used by your implementation.

Start the frontend:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## 🔒 Security & Responsible Use

- Treat scan results as risk indicators, not absolute proof that a website or message is fraudulent.
- Never enter passwords, OTPs, or banking credentials into suspicious websites.
- Payment screenshots alone cannot establish whether a transaction is genuine.
- Protect database credentials, JWT secrets, and API keys.
- Verify suspicious payment claims directly through the official bank or payment application.

## 🔮 Future Enhancements

- Improved scam detection accuracy.
- Expanded regional-language support.
- More threat-intelligence integrations.
- Enhanced visualization and analytics.
- Additional detection and reporting capabilities.

## 👩‍💻 Project

**TrustLens AI — AI-Powered Digital Trust & Scam Intelligence Platform**

Developed as a software project focused on cybersecurity, AI-assisted scam awareness, and digital safety.

---

⭐ If you find this project interesting, consider giving the repository a star!
