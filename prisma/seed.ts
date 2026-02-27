import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data
  console.log("🧹 Cleaning up existing data...");
  await prisma.notification.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.patientHistory.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.timeSlot.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.aiChat.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.symptom.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("📊 Seeding database...");

  // Generate hashed passwords
  const hashedPassword = await bcrypt.hash("password123", 10);

  // ADMIN USERS
  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@carexpert.com",
      password: hashedPassword,
      role: "ADMIN",
      isEmailVerified: true,
      admin: {
        create: {
          permissions: {
            canManageUsers: true,
            canManageDoctors: true,
            canManagePatients: true,
            canViewAnalytics: true,
            canManageSystem: true,
          },
        },
      },
    },
    include: { admin: true },
  });

  console.log(`✅ Created 1 admin user`);

  // DOCTORS
  const doctorUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: "Dr. Sarah Johnson",
        email: "dr.sarah@carexpert.com",
        password: hashedPassword,
        role: "DOCTOR",
        profilePicture: "https://api.example.com/avatars/doctor1.jpg",
        isEmailVerified: true,
        doctor: {
          create: {
            specialty: "Cardiology",
            clinicLocation: "123 Medical Center, New York, NY",
            experience: "12 years",
            education:
              "MD from Harvard Medical School, Board Certified Cardiologist",
            bio: "Experienced cardiologist with a focus on preventive care and patient education.",
            languages: ["English", "Spanish"],
            isVerified: true,
          },
        },
      },
      include: { doctor: true },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Michael Chen",
        email: "dr.michael@carexpert.com",
        password: hashedPassword,
        role: "DOCTOR",
        profilePicture: "https://api.example.com/avatars/doctor2.jpg",
        isEmailVerified: true,
        doctor: {
          create: {
            specialty: "Dermatology",
            clinicLocation: "456 Skin Care Clinic, Los Angeles, CA",
            experience: "8 years",
            education:
              "MD from Stanford, Dermatology Residency at Johns Hopkins",
            bio: "Specializing in cosmetic and surgical dermatology.",
            languages: ["English", "Mandarin"],
            isVerified: true,
          },
        },
      },
      include: { doctor: true },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Emily Rodriguez",
        email: "dr.emily@carexpert.com",
        password: hashedPassword,
        role: "DOCTOR",
        profilePicture: "https://api.example.com/avatars/doctor3.jpg",
        isEmailVerified: true,
        doctor: {
          create: {
            specialty: "Pediatrics",
            clinicLocation: "789 Children's Hospital, Chicago, IL",
            experience: "10 years",
            education:
              "MD from University of Chicago, Pediatrics Fellowship",
            bio: "Dedicated pediatrician committed to child health and development.",
            languages: ["English", "Portuguese"],
            isVerified: true,
          },
        },
      },
      include: { doctor: true },
    }),
    prisma.user.create({
      data: {
        name: "Dr. James Wilson",
        email: "dr.james@carexpert.com",
        password: hashedPassword,
        role: "DOCTOR",
        profilePicture: "https://api.example.com/avatars/doctor4.jpg",
        isEmailVerified: true,
        doctor: {
          create: {
            specialty: "Orthopedics",
            clinicLocation: "321 Sports Medicine, Houston, TX",
            experience: "15 years",
            education:
              "MD from University of Texas, Sports Medicine Specialist",
            bio: "Expert in sports injuries and orthopedic surgery.",
            languages: ["English"],
            isVerified: true,
          },
        },
      },
      include: { doctor: true },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Lisa Anderson",
        email: "dr.lisa@carexpert.com",
        password: hashedPassword,
        role: "DOCTOR",
        profilePicture: "https://api.example.com/avatars/doctor5.jpg",
        isEmailVerified: true,
        doctor: {
          create: {
            specialty: "Psychiatry",
            clinicLocation: "654 Mental Health Center, Boston, MA",
            experience: "11 years",
            education: "MD from Harvard, Psychiatry Residency at MGH",
            bio: "Compassionate psychiatrist focusing on mental health and wellness.",
            languages: ["English", "French"],
            isVerified: true,
          },
        },
      },
      include: { doctor: true },
    }),
  ]);

  console.log(`✅ Created ${doctorUsers.length} doctor(s)`);

  // PATIENTS
  const patientUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: "John Smith",
        email: "john.smith@example.com",
        password: hashedPassword,
        role: "PATIENT",
        profilePicture: "https://api.example.com/avatars/patient1.jpg",
        isEmailVerified: true,
        patient: {
          create: {
            location: "New York, NY",
            medicalHistory:
              "Hypertension, managed with medication. Family history of diabetes.",
            symptoms: {
              create: [
                { symptomText: "Occasional chest pain" },
                { symptomText: "Shortness of breath during exercise" },
              ],
            },
          },
        },
      },
      include: { patient: true },
    }),
    prisma.user.create({
      data: {
        name: "Emma Wilson",
        email: "emma.wilson@example.com",
        password: hashedPassword,
        role: "PATIENT",
        profilePicture: "https://api.example.com/avatars/patient2.jpg",
        isEmailVerified: true,
        patient: {
          create: {
            location: "Los Angeles, CA",
            medicalHistory: "Asthma since childhood. Allergic to penicillin.",
            symptoms: {
              create: [
                { symptomText: "Persistent cough" },
                { symptomText: "Difficulty breathing at night" },
              ],
            },
          },
        },
      },
      include: { patient: true },
    }),
    prisma.user.create({
      data: {
        name: "Michael Johnson",
        email: "michael.johnson@example.com",
        password: hashedPassword,
        role: "PATIENT",
        profilePicture: "https://api.example.com/avatars/patient3.jpg",
        isEmailVerified: true,
        patient: {
          create: {
            location: "Chicago, IL",
            medicalHistory: "Diabetes Type 2 diagnosed 5 years ago.",
            symptoms: {
              create: [
                { symptomText: "Increased thirst" },
                { symptomText: "Fatigue" },
              ],
            },
          },
        },
      },
      include: { patient: true },
    }),
    prisma.user.create({
      data: {
        name: "Sarah Davis",
        email: "sarah.davis@example.com",
        password: hashedPassword,
        role: "PATIENT",
        profilePicture: "https://api.example.com/avatars/patient4.jpg",
        isEmailVerified: true,
        patient: {
          create: {
            location: "Houston, TX",
            medicalHistory: "No significant medical history. Active lifestyle.",
            symptoms: {
              create: [
                { symptomText: "Headaches" },
                { symptomText: "Insomnia" },
              ],
            },
          },
        },
      },
      include: { patient: true },
    }),
    prisma.user.create({
      data: {
        name: "Robert Brown",
        email: "robert.brown@example.com",
        password: hashedPassword,
        role: "PATIENT",
        profilePicture: "https://api.example.com/avatars/patient5.jpg",
        isEmailVerified: true,
        patient: {
          create: {
            location: "Boston, MA",
            medicalHistory: "Mild arthritis. Previous sports injuries.",
            symptoms: {
              create: [
                { symptomText: "Joint pain" },
                { symptomText: "Stiffness in the morning" },
              ],
            },
          },
        },
      },
      include: { patient: true },
    }),
  ]);

  console.log(`✅ Created ${patientUsers.length} patient(s)`);

  // TIME SLOTS for doctors
  const now = new Date();
  const timeSlots = await Promise.all([
    // Dr. Sarah (Cardiology)
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[0].doctor!.id,
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now, 9:00 AM
        endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour slot
        consultationFee: 100,
        status: "AVAILABLE",
      },
    }),
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[0].doctor!.id,
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 3 days, 11:00 AM
        endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        consultationFee: 100,
        status: "AVAILABLE",
      },
    }),
    // Dr. Michael (Dermatology)
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[1].doctor!.id,
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 2 days, 10:00 AM
        endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        consultationFee: 80,
        status: "AVAILABLE",
      },
    }),
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[1].doctor!.id,
        startTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 4 days, 2:00 PM
        endTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        consultationFee: 80,
        status: "AVAILABLE",
      },
    }),
    // Dr. Emily (Pediatrics)
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[2].doctor!.id,
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 2 days, 2:00 PM
        endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
        consultationFee: 70,
        status: "AVAILABLE",
      },
    }),
    // Dr. James (Orthopedics)
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[3].doctor!.id,
        startTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // 5 days, 9:00 AM
        endTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        consultationFee: 110,
        status: "AVAILABLE",
      },
    }),
    // Dr. Lisa (Psychiatry)
    prisma.timeSlot.create({
      data: {
        doctorId: doctorUsers[4].doctor!.id,
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 3 days, 10:00 AM
        endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        consultationFee: 120,
        status: "AVAILABLE",
      },
    }),
  ]);

  console.log(`✅ Created ${timeSlots.length} time slot(s)`);

  // APPOINTMENTS
  const appointments = await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: patientUsers[0].patient!.id,
        doctorId: doctorUsers[0].doctor!.id,
        timeSlotId: timeSlots[0].id,
        date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        time: "09:00 AM",
        appointmentType: "ONLINE",
        status: "CONFIRMED",
        consultationFee: 100,
        notes: "Follow-up consultation for heart condition",
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patientUsers[1].patient!.id,
        doctorId: doctorUsers[1].doctor!.id,
        date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        time: "10:00 AM",
        appointmentType: "OFFLINE",
        status: "PENDING",
        consultationFee: 80,
        notes: "Initial skin consultation",
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patientUsers[2].patient!.id,
        doctorId: doctorUsers[2].doctor!.id,
        date: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        time: "02:00 PM",
        appointmentType: "ONLINE",
        status: "COMPLETED",
        consultationFee: 70,
        notes: "Routine pediatric check-up",
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patientUsers[3].patient!.id,
        doctorId: doctorUsers[3].doctor!.id,
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Past appointment
        time: "11:00 AM",
        appointmentType: "OFFLINE",
        status: "CANCELLED",
        consultationFee: 110,
        notes: "Orthopedic consultation - cancelled",
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patientUsers[4].patient!.id,
        doctorId: doctorUsers[4].doctor!.id,
        date: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        time: "03:00 PM",
        appointmentType: "ONLINE",
        status: "PENDING",
        consultationFee: 120,
        notes: "Mental health counseling session",
      },
    }),
  ]);

  console.log(`✅ Created ${appointments.length} appointment(s)`);

  // PRESCRIPTIONS
  const prescriptions = await Promise.all([
    prisma.prescription.create({
      data: {
        doctorId: doctorUsers[0].doctor!.id,
        patientId: patientUsers[0].patient!.id,
        prescriptionText:
          "Aspirin 100mg daily, Lisinopril 10mg daily, Follow-up in 4 weeks",
      },
    }),
    prisma.prescription.create({
      data: {
        doctorId: doctorUsers[1].doctor!.id,
        patientId: patientUsers[1].patient!.id,
        prescriptionText:
          "Tretinoin 0.025% cream at night, Sunscreen SPF 50 daily, Avoid harsh skincare",
      },
    }),
    prisma.prescription.create({
      data: {
        doctorId: doctorUsers[2].doctor!.id,
        patientId: patientUsers[2].patient!.id,
        prescriptionText: "Multivitamins daily, Balanced diet, Regular exercise",
      },
    }),
  ]);

  console.log(`✅ Created ${prescriptions.length} prescription(s)`);

  // PATIENT HISTORY
  const patientHistories = await Promise.all([
    prisma.patientHistory.create({
      data: {
        doctorId: doctorUsers[0].doctor!.id,
        patientId: patientUsers[0].patient!.id,
        appointmentId: appointments[0].id,
        prescriptionId: prescriptions[0].id,
        notes: "Patient shows signs of improving heart condition. Continue current medication and exercise routine.",
      },
    }),
    prisma.patientHistory.create({
      data: {
        doctorId: doctorUsers[2].doctor!.id,
        patientId: patientUsers[2].patient!.id,
        appointmentId: appointments[2].id,
        prescriptionId: prescriptions[2].id,
        notes: "Child is developing normally. All vital signs are healthy.",
      },
    }),
  ]);

  console.log(`✅ Created ${patientHistories.length} patient history record(s)`);

  // ROOMS for chat
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        name: "New York Doctors Network",
        admin: {
          connect: [{ id: doctorUsers[0].id }],
        },
        members: {
          connect: [
            { id: doctorUsers[0].id },
            { id: doctorUsers[1].id },
            { id: patientUsers[0].id },
          ],
        },
      },
    }),
    prisma.room.create({
      data: {
        name: "Pediatric Care Community",
        admin: {
          connect: [{ id: doctorUsers[2].id }],
        },
        members: {
          connect: [
            { id: doctorUsers[2].id },
            { id: patientUsers[1].id },
            { id: patientUsers[2].id },
          ],
        },
      },
    }),
  ]);

  console.log(`✅ Created ${rooms.length} chat room(s)`);

  // CHAT MESSAGES
  const chatMessages = await Promise.all([
    prisma.chatMessage.create({
      data: {
        senderId: doctorUsers[0].id,
        roomId: rooms[0].id,
        message: "Welcome to the New York Doctors Network! Feel free to share your medical insights.",
        messageType: "TEXT",
      },
    }),
    prisma.chatMessage.create({
      data: {
        senderId: patientUsers[0].id,
        roomId: rooms[0].id,
        message: "Thanks! I'm looking forward to connecting with experienced doctors here.",
        messageType: "TEXT",
      },
    }),
    prisma.chatMessage.create({
      data: {
        senderId: doctorUsers[2].id,
        roomId: rooms[1].id,
        message: "Great to have everyone in the pediatric care community. Looking forward to collaborations!",
        messageType: "TEXT",
      },
    }),
  ]);

  console.log(`✅ Created ${chatMessages.length} chat message(s)`);

  // AI CHAT HISTORY
  const aiChats = await Promise.all([
    prisma.aiChat.create({
      data: {
        userId: patientUsers[0].id,
        userMessage: "I'm experiencing chest pain and shortness of breath",
        aiResponse: {
          analysis: "Based on symptoms, possible conditions include angina, asthma, or anxiety disorder.",
        },
        probableCauses: ["Angina Pectoris", "Asthma", "Anxiety Disorder"],
        severity: "HIGH",
        recommendation: "Please consult a cardiologist immediately.",
        disclaimer:
          "This is not medical advice. Always consult with a healthcare professional.",
      },
    }),
    prisma.aiChat.create({
      data: {
        userId: patientUsers[1].id,
        userMessage: "I have a persistent cough and difficulty breathing",
        aiResponse: {
          analysis: "Symptoms suggest possible respiratory condition.",
        },
        probableCauses: ["Asthma", "Bronchitis", "COPD"],
        severity: "MEDIUM",
        recommendation: "Consult a pulmonologist for proper diagnosis.",
        disclaimer:
          "This is not medical advice. Always consult with a healthcare professional.",
      },
    }),
  ]);

  console.log(`✅ Created ${aiChats.length} AI chat record(s)`);

  // NOTIFICATIONS
  const notifications = await Promise.all([
    prisma.notification.create({
      data: {
        userId: patientUsers[0].id,
        type: "appointment_confirmed",
        title: "Appointment Confirmed",
        message:
          "Your appointment with Dr. Sarah Johnson has been confirmed for tomorrow at 09:00 AM",
        isRead: false,
        appointmentId: appointments[0].id,
      },
    }),
    prisma.notification.create({
      data: {
        userId: patientUsers[1].id,
        type: "appointment_pending",
        title: "Appointment Pending",
        message: "Dr. Michael Chen will review and confirm your appointment request.",
        isRead: false,
        appointmentId: appointments[1].id,
      },
    }),
    prisma.notification.create({
      data: {
        userId: doctorUsers[0].id,
        type: "new_appointment",
        title: "New Appointment Request",
        message: "John Smith has requested an appointment with you.",
        isRead: false,
      },
    }),
  ]);

  console.log(`✅ Created ${notifications.length} notification(s)`);

  // REPORTS
  const reports = await Promise.all([
    prisma.report.create({
      data: {
        patientId: patientUsers[0].patient!.id,
        filename: "chest_xray_2025.pdf",
        fileUrl:
          "https://storage.example.com/reports/chest_xray_2025.pdf",
        extractedText:
          "Normal chest X-ray. No abnormalities detected in lungs or heart.",
        summary: "Routine chest X-ray showing normal results.",
        abnormalValues: {},
        possibleConditions: [],
        recommendation: "Continue routine check-ups as scheduled.",
        disclaimer: "This report is for informational purposes only.",
        mimeType: "application/pdf",
        fileSize: 2048000,
        status: "COMPLETED",
      },
    }),
    prisma.report.create({
      data: {
        patientId: patientUsers[2].patient!.id,
        filename: "blood_test_results.pdf",
        fileUrl:
          "https://storage.example.com/reports/blood_test_results.pdf",
        extractedText:
          "Blood glucose: 145 mg/dL (slightly elevated). All other values within normal range.",
        summary: "Blood test showing slightly elevated glucose levels.",
        abnormalValues: { glucose: "145 mg/dL" },
        possibleConditions: ["Pre-diabetes", "Metabolic Syndrome"],
        recommendation: "Consult with an endocrinologist.",
        disclaimer: "Consult your doctor for interpretation.",
        mimeType: "application/pdf",
        fileSize: 1024000,
        status: "COMPLETED",
      },
    }),
  ]);

  console.log(`✅ Created ${reports.length} medical report(s)`);

  console.log("\n✨ Database seeding completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`  - Admin Users: 1`);
  console.log(`  - Doctors: ${doctorUsers.length}`);
  console.log(`  - Patients: ${patientUsers.length}`);
  console.log(`  - Time Slots: ${timeSlots.length}`);
  console.log(`  - Appointments: ${appointments.length}`);
  console.log(`  - Prescriptions: ${prescriptions.length}`);
  console.log(`  - Rooms: ${rooms.length}`);
  console.log(`  - Messages: ${chatMessages.length}`);
  console.log(`  - AI Chats: ${aiChats.length}`);
  console.log(`  - Notifications: ${notifications.length}`);
  console.log(`  - Reports: ${reports.length}`);

  console.log("\n🔑 Sample Credentials:");
  console.log("  Admin:");
  console.log("    Email: admin@carexpert.com");
  console.log("    Password: password123");
  console.log("\n  Doctor (Cardiologist):");
  console.log("    Email: dr.sarah@carexpert.com");
  console.log("    Password: password123");
  console.log("\n  Patient:");
  console.log("    Email: john.smith@example.com");
  console.log("    Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
