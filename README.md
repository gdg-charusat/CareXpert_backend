# 🩺 Smart Patient Symptom Checker & Appointment Platform – Backend

This is the **backend** of the **Smart Patient Symptom Checker & Appointment Platform**, built with **Node.js**, **Express**, and **TypeScript**. It supports authentication, doctor/patient management, appointment booking, real-time chat, and integrates with an ML-based symptom checker.

---

## 🧰 Tech Stack

- 🟦 Node.js + Express  
- 🌀 TypeScript  
- 🔐 JWT Authentication  
- 🧾 RESTful APIs  
- 📬 Socket.io (for real-time chat)  
- 🛢️ PostgreSQL
- 📦 Dotenv, Bcrypt, Cors, etc.

---

## 📦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/gdg-charusat/CareXpert_backend
cd careXpert_backend
```

PORT=3000

# PostgreSQL
# DATABASE_URL=postgresql://user:password@localhost:5432/careXpert


**new docker setup**
-install docker and do the setup
-then check the .env.example use that env sample and use the same url
-compose up the docker file by right clicking the file(add docker extension too) 
-check your docker container must be running, check for error if there are none then
-npx prisma migrate dev (no new migration files must be created,if created then delete the file and use "npx prisma migrate deploy")
-happy coding
