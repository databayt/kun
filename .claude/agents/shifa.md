---
name: shifa
description: Medical platform reference - appointments, patient records, healthcare workflows
model: opus
version: "Next.js + Prisma + TypeScript"
handoff: [architecture, prisma, authjs]
---

# Shifa Reference Agent

**Scope**: Medical/Healthcare | **Patterns**: Appointments, Patients, Workflows | **Repo**: databayt/shifa

## When to Use

Trigger when user says:
- `like shifa`
- `appointments like shifa`
- `patient flow`
- `healthcare`
- `medical`
- `clinic`
- `doctor scheduling`

## Repository Info

| Field | Value |
|-------|-------|
| **URL** | https://github.com/databayt/shifa |
| **Stack** | Next.js, Prisma, TypeScript |
| **Local** | /Users/abdout/oss/shifa (if cloned) |

## Core Patterns

### 1. Patient Model

```prisma
model Patient {
  id           String   @id @default(cuid())

  // Personal info
  firstName    String
  lastName     String
  dateOfBirth  DateTime
  gender       Gender

  // Contact
  email        String?
  phone        String
  address      String?

  // Medical
  bloodType    BloodType?
  allergies    String[]

  // Relations
  userId       String?  @unique
  user         User?    @relation(fields: [userId], references: [id])

  appointments Appointment[]
  records      MedicalRecord[]
  prescriptions Prescription[]

  createdAt    DateTime @default(now())

  @@index([phone])
  @@index([lastName, firstName])
}
```

### 2. Appointment System

```prisma
model Appointment {
  id           String   @id @default(cuid())

  patientId    String
  patient      Patient  @relation(fields: [patientId], references: [id])
  doctorId     String
  doctor       Doctor   @relation(fields: [doctorId], references: [id])

  dateTime     DateTime
  duration     Int      @default(30)  // minutes
  type         AppointmentType  // CONSULTATION, FOLLOW_UP, PROCEDURE

  status       AppointmentStatus  // SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW

  // Notes
  reason       String?
  notes        String?

  // Reminders
  reminderSent Boolean  @default(false)

  createdAt    DateTime @default(now())

  @@index([doctorId, dateTime])
  @@index([patientId, dateTime])
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}
```

### 3. Doctor Schedule

```prisma
model Doctor {
  id           String   @id @default(cuid())

  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])

  specialization String
  licenseNumber  String  @unique

  // Working hours
  schedule     DoctorSchedule[]

  appointments Appointment[]

  @@index([specialization])
}

model DoctorSchedule {
  id           String   @id @default(cuid())
  doctorId     String
  doctor       Doctor   @relation(fields: [doctorId], references: [id])

  dayOfWeek    Int      // 0-6 (Sunday-Saturday)
  startTime    String   // "09:00"
  endTime      String   // "17:00"
  slotDuration Int      @default(30)  // minutes

  @@unique([doctorId, dayOfWeek])
}

// Get available slots
async function getAvailableSlots(doctorId: string, date: Date) {
  const dayOfWeek = date.getDay()

  const [schedule, appointments] = await Promise.all([
    db.doctorSchedule.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
    }),
    db.appointment.findMany({
      where: {
        doctorId,
        dateTime: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    }),
  ])

  if (!schedule) return []

  return generateTimeSlots(schedule, appointments)
}
```

### 4. Medical Records

```prisma
model MedicalRecord {
  id           String   @id @default(cuid())
  patientId    String
  patient      Patient  @relation(fields: [patientId], references: [id])
  doctorId     String
  doctor       Doctor   @relation(fields: [doctorId], references: [id])
  appointmentId String?
  appointment  Appointment? @relation(fields: [appointmentId], references: [id])

  // Vitals
  bloodPressure String?
  heartRate     Int?
  temperature   Float?
  weight        Float?
  height        Float?

  // Clinical
  symptoms     String[]
  diagnosis    String?
  treatment    String?
  notes        String?

  // Attachments
  attachments  RecordAttachment[]

  createdAt    DateTime @default(now())

  @@index([patientId, createdAt])
}
```

### 5. Prescription System

```prisma
model Prescription {
  id           String   @id @default(cuid())
  patientId    String
  patient      Patient  @relation(fields: [patientId], references: [id])
  doctorId     String
  doctor       Doctor   @relation(fields: [doctorId], references: [id])

  items        PrescriptionItem[]

  validUntil   DateTime
  notes        String?

  createdAt    DateTime @default(now())
}

model PrescriptionItem {
  id             String   @id @default(cuid())
  prescriptionId String
  prescription   Prescription @relation(fields: [prescriptionId], references: [id])

  medication     String
  dosage         String
  frequency      String   // "3 times daily"
  duration       String   // "7 days"
  instructions   String?
}
```

### 6. Notification System

```typescript
// lib/notifications/appointment-reminder.ts
export async function sendAppointmentReminders() {
  const tomorrow = addDays(new Date(), 1)

  const appointments = await db.appointment.findMany({
    where: {
      dateTime: {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow),
      },
      status: 'CONFIRMED',
      reminderSent: false,
    },
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  })

  for (const appointment of appointments) {
    await sendSMS(appointment.patient.phone, {
      template: 'APPOINTMENT_REMINDER',
      data: {
        patientName: appointment.patient.firstName,
        doctorName: appointment.doctor.user.name,
        dateTime: format(appointment.dateTime, 'PPpp'),
      },
    })

    await db.appointment.update({
      where: { id: appointment.id },
      data: { reminderSent: true },
    })
  }
}
```

### 7. Healthcare Workflow

```
app/
  clinic/
    dashboard/
      page.tsx          # Today's appointments, stats
    patients/
      page.tsx          # Patient list
      [id]/
        page.tsx        # Patient profile
        records/page.tsx  # Medical history
    appointments/
      page.tsx          # Appointment calendar
      create/page.tsx   # Book appointment
    doctors/
      page.tsx          # Doctor list
      [id]/
        schedule/page.tsx  # Manage schedule
```

## Reference Checklist

When implementing features "like shifa":

- [ ] Patient with medical info (allergies, blood type)
- [ ] Appointment with status workflow
- [ ] Doctor schedule with time slots
- [ ] Medical records linked to appointments
- [ ] Prescription with items
- [ ] SMS/Email reminders

## Files to Reference

| Pattern | Path in shifa |
|---------|---------------|
| Patient schema | `prisma/models/patient.prisma` |
| Appointment logic | `src/lib/appointments.ts` |
| Schedule slots | `src/lib/scheduling.ts` |
| Notification service | `src/lib/notifications/` |
| Clinic dashboard | `src/app/clinic/` |

## Access Commands

```bash
# Clone locally
git clone https://github.com/databayt/shifa ~/oss/shifa

# Reference via MCP
mcp__github__get_file_contents(owner="databayt", repo="shifa", path="prisma/models/patient.prisma")
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Database schema | `prisma` |
| Authentication | `authjs` |
| Architecture | `architecture` |
