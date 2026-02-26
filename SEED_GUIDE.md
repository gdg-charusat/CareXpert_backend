# 🌱 Database Seeding Guide

This guide explains how to populate your CareXpert database with sample data for development and testing.

## Quick Start

```bash
# Run the seed script
npm run seed
```

That's it! Your database will be populated with realistic sample data.

## What Gets Seeded

The database seed creates a complete test environment with:

### Users (11 total)
- **1 Admin User** - Administrative access with full permissions
- **5 Doctors** - Different specialties with varied experience levels
- **5 Patients** - With medical histories and symptoms

### Clinical Data
- **7 Time Slots** - Available appointment slots across doctors
- **5 Appointments** - Various statuses (pending, confirmed, completed, cancelled)
- **3 Prescriptions** - Medical prescriptions linked to appointments
- **2 Patient History Records** - Medical visit documentation
- **2 Medical Reports** - Uploaded patient reports (X-ray, blood test)

### Communication
- **2 Chat Rooms** - Community discussion rooms
- **3 Chat Messages** - Sample messages in rooms
- **3 Notifications** - Appointment and system notifications

### AI Features
- **2 AI Chat Records** - Symptom analysis examples

## Usage Instructions

### Method 1: Using npm Script (Recommended)

```bash
npm run seed
```

### Method 2: Using Prisma CLI

```bash
npx prisma db seed
```

### Method 3: Direct TypeScript Execution

```bash
ts-node prisma/seed.ts
```

## Sample Test Credentials

After seeding, use these credentials to test the full system:

### Admin Account
```
Email: admin@carexpert.com
Password: password123
Role: ADMIN
Permissions: Full system access
```

### Doctor Accounts

**Dr. Sarah Johnson - Cardiology**
```
Email: dr.sarah@carexpert.com
Password: password123
Specialty: Cardiology
Experience: 12 years
Location: 123 Medical Center, New York, NY
Status: Verified
```

**Dr. Michael Chen - Dermatology**
```
Email: dr.michael@carexpert.com
Password: password123
Specialty: Dermatology
Experience: 8 years
Location: 456 Skin Care Clinic, Los Angeles, CA
Status: Verified
```

**Dr. Emily Rodriguez - Pediatrics**
```
Email: dr.emily@carexpert.com
Password: password123
Specialty: Pediatrics
Experience: 10 years
Location: 789 Children's Hospital, Chicago, IL
Status: Verified
```

**Dr. James Wilson - Orthopedics**
```
Email: dr.james@carexpert.com
Password: password123
Specialty: Orthopedics
Experience: 15 years
Location: 321 Sports Medicine, Houston, TX
Status: Verified
```

**Dr. Lisa Anderson - Psychiatry**
```
Email: dr.lisa@carexpert.com
Password: password123
Specialty: Psychiatry
Experience: 11 years
Location: 654 Mental Health Center, Boston, MA
Status: Verified
```

### Patient Accounts

**John Smith**
```
Email: john.smith@example.com
Password: password123
Location: New York, NY
Medical History: Hypertension, family history of diabetes
Symptoms: Chest pain, shortness of breath during exercise
```

**Emma Wilson**
```
Email: emma.wilson@example.com
Password: password123
Location: Los Angeles, CA
Medical History: Asthma, penicillin allergy
Symptoms: Persistent cough, difficulty breathing at night
```

**Michael Johnson**
```
Email: michael.johnson@example.com
Password: password123
Location: Chicago, IL
Medical History: Type 2 Diabetes (5 years)
Symptoms: Increased thirst, fatigue
```

**Sarah Davis**
```
Email: sarah.davis@example.com
Password: password123
Location: Houston, TX
Medical History: No significant history
Symptoms: Headaches, insomnia
```

**Robert Brown**
```
Email: robert.brown@example.com
Password: password123
Location: Boston, MA
Medical History: Mild arthritis, previous sports injuries
Symptoms: Joint pain, morning stiffness
```

## Testing Workflows

### Doctor Workflow
```bash
1. Login as Dr. Sarah: dr.sarah@carexpert.com / password123
2. View time slots already created
3. View pending appointments
4. Confirm or respond to appointment requests
5. Add prescriptions to completed appointments
6. Check notifications
```

### Patient Workflow
```bash
1. Login as John: john.smith@example.com / password123
2. Search for doctors (e.g., Cardiology in New York)
3. View available time slots
4. Book an appointment
5. View upcoming appointments
6. Check prescriptions
7. Upload medical reports
8. Use AI symptom checker
```

### Admin Workflow
```bash
1. Login as admin: admin@carexpert.com / password123
2. View all users
3. Check dashboard statistics
4. Verify doctor accounts
5. Manage user roles
```

## Resetting the Database

To clear all data and reseed:

```bash
# Complete reset - removes all data and reruns all migrations
npx prisma migrate reset

# Then optionally reseed
npm run seed
```

⚠️ **Warning**: This command deletes all data in the database!

## Configuration

### Seed Script Location
```
backend/prisma/seed.ts
```

### Environment Requirements
The seed script uses:
- **Database**: PostgreSQL (via DATABASE_URL env variable)
- **Dependencies**: @prisma/client, bcrypt
- **Node Version**: 14+ recommended

### Customizing the Seed

Edit `prisma/seed.ts` to modify seeded data:

```typescript
// Change doctor information
{
  name: "Dr. Your Name",
  email: "doctor@yourmail.com",
  specialty: "Your Specialty",
  clinicLocation: "Your Location",
  experience: "20 years",
  // ... more fields
}

// Add more test users
// Modify appointment statuses
// Change time slot dates
```

After editing, run the seed again:
```bash
npm run seed
```

## Troubleshooting

### Issue: Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running
```bash
# If using Docker Compose
docker-compose up

# Or check your PostgreSQL service is running
```

### Issue: Missing Dependencies
```
Cannot find module 'bcrypt'
```

**Solution**: Install dependencies
```bash
npm install
```

### Issue: TypeScript Compilation Error
```
Cannot find name 'PrismaClient'
```

**Solution**: Generate Prisma Client
```bash
npm run generate
# or
npx prisma generate
```

### Issue: Seed Script Already Ran
If you get unique constraint errors:
```bash
# Reset the database and reseed
npx prisma migrate reset
```

## Performance Considerations

- **First Run**: ~2-3 seconds (database creation)
- **Subsequent Runs**: ~0.5-1 second (after reset)
- **Data Volume**: ~50 records total (lightweight for dev)

## Integration with Development Workflow

### When Starting Development
```bash
# Fresh start with latest code
git pull origin main
npx prisma migrate deploy
npm run seed
npm run dev
```

### When Switching Branches
```bash
# If schema changed, migrations handle it
npx prisma migrate dev
# Data is preserved if seed isn't re-run
```

### Continuous Integration
If using CI/CD, add to pipeline:
```bash
npm run seed  # Populate test database
npm test      # Run tests against seed data
```

## API Testing with Seeded Data

Use the Postman collection with seed credentials:

1. Import `postman/carexpert-collection.json`
2. Login with any seed credential
3. All referenced IDs in Postman will work with seed data
4. Test complete workflows from doctor/patient perspective

**See**: [postman/README.md](../../postman/README.md)

## Advanced Seed Customization

### Add More Doctors
```typescript
const doctors = await Promise.all([
  // ... existing doctors ...
  prisma.user.create({
    data: {
      name: "Dr. New Doctor",
      email: "new.doctor@carexpert.com",
      password: hashedPassword,
      role: "DOCTOR",
      doctor: {
        create: {
          specialty: "Your Specialty",
          clinicLocation: "Your Location",
          // ... other fields
        },
      },
    },
  }),
]);
```

### Modify Time Slots
```typescript
const timeSlots = await Promise.all([
  prisma.timeSlot.create({
    data: {
      doctorId: doctors[0].doctor!.id,
      startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      consultationFee: 150, // Custom fee
      status: "AVAILABLE",
    },
  }),
]);
```

### Add Sample Reports
```typescript
const reports = await Promise.all([
  prisma.report.create({
    data: {
      patientId: patients[0].patient!.id,
      filename: "lab_report_2025.pdf",
      fileUrl: "https://example.com/reports/lab_report.pdf",
      extractedText: "Custom lab results...",
      summary: "Your custom summary",
      status: "COMPLETED",
      // ... other fields
    },
  }),
]);
```

## Maintenance

### Regular Seeding Schedule
- **Development**: On branch creation or after major schema changes
- **Testing**: Before running full test suite
- **Demo**: Fresh seed for each demo/presentation

### Backup Before Reset
```bash
# Backup current data (if needed)
pg_dump careXpert > backup_$(date +%Y%m%d_%H%M%S).sql

# Then reset
npx prisma migrate reset
npm run seed
```

## Support & Contributing

- **Issues**: Report seed-related issues on GitHub
- **Improvements**: Submit PRs to enhance seed data
- **Documentation**: Update this guide for new features

---

**Last Updated**: February 26, 2025
**Seed Version**: 1.0.0
**Maintained By**: CareXpert Development Team
