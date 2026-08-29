import "dotenv/config";
import { PrismaClient, RoleName } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

import { PERMISSION_CATALOG, DEFAULT_ROLE_PERMISSIONS } from "../src/config/permissions";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Password123!";

function daysFrom(base: Date, offset: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  console.log("Seeding roles & permissions…");

  // SUPER_ADMIN/ADMINISTRATOR/INSTRUCTOR/ASSESSOR/TRAINEE are retired,
  // non-assignable roles (see ASSIGNABLE_ROLE_NAMES in src/config/permissions.ts)
  // kept here only so existing demo/historical accounts still resolve a valid
  // role — no new user is ever assigned one of these going forward.
  const roleDefs: { name: RoleName; label: string; description: string }[] = [
    { name: "SUPER_ADMIN", label: "Super Administrator", description: "Full system access." },
    { name: "ADMINISTRATOR", label: "Administrator", description: "Operational and training administration." },
    { name: "FRONT_OFFICE_STAFF", label: "Front Office Staff", description: "Day-to-day front office operations." },
    { name: "INSTRUCTOR", label: "Instructor", description: "Trainee monitoring, competency assignment, evaluation." },
    { name: "ASSESSOR", label: "Assessor", description: "Competency assessment and certification." },
    { name: "TRAINEE", label: "Trainee", description: "Trainee self-service access." },
    { name: "SUPERVISOR", label: "Supervisor", description: "Consolidated FOSMS operational supervision — training, assessments, attendance, reports, user management." },
  ];

  const roles = new Map<string, { id: string }>();
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: { label: def.label, description: def.description },
      create: { name: def.name, label: def.label, description: def.description },
    });
    roles.set(def.name, role);
  }

  const permissions = new Map<string, { id: string }>();
  for (const p of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: { key: p.key, module: p.module, description: p.description },
    });
    permissions.set(p.key, permission);
  }

  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = roles.get(roleName)!;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionKeys.map((key) => ({ roleId: role.id, permissionId: permissions.get(key)!.id })),
    });
  }

  console.log("Seeding users…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // `isActive` defaults to true (matches the schema default) so existing calls
  // don't need to change; pass `false` for accounts whose role has been
  // retired — the `update:` clause deliberately re-applies it on every seed
  // run so re-seeding an already-active legacy account still deactivates it.
  async function upsertUser(email: string, firstName: string, lastName: string, roleName: string, isActive = true) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { isActive },
      create: { email, firstName, lastName, passwordHash, isActive },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles.get(roleName)!.id } },
      update: {},
      create: { userId: user.id, roleId: roles.get(roleName)!.id },
    });
    return user;
  }

  // Retired-role demo accounts are kept (isActive: false) rather than deleted —
  // their linked Instructor/Trainee profiles and downstream assessment/attendance
  // data below are real demo data Supervisor/Front Office need to see and manage.
  const superAdmin = await upsertUser("superadmin@fonc2s.local", "Mary Jane", "Dela Cruz", "SUPER_ADMIN", false);
  await upsertUser("admin@fonc2s.local", "Carlos", "Reyes", "ADMINISTRATOR", false);
  await upsertUser("frontdesk@fonc2s.local", "Angela", "Santos", "FRONT_OFFICE_STAFF");
  await upsertUser("supervisor@fonc2s.local", "Alexandra", "Ramos", "SUPERVISOR");
  const instructorUser = await upsertUser("instructor@fonc2s.local", "Roberto", "Villanueva", "INSTRUCTOR", false);
  const assessorUser = await upsertUser("assessor@fonc2s.local", "Liza", "Fernandez", "ASSESSOR", false);
  const traineeUser1 = await upsertUser("trainee1@fonc2s.local", "Juan", "Dela Cruz", "TRAINEE", false);
  const traineeUser2 = await upsertUser("trainee2@fonc2s.local", "Maria", "Garcia", "TRAINEE", false);
  const traineeUser3 = await upsertUser("trainee3@fonc2s.local", "Pedro", "Santos", "TRAINEE", false);
  const traineeUser4 = await upsertUser("trainee4@fonc2s.local", "Carmela", "Lopez", "TRAINEE", false);
  const traineeUser5 = await upsertUser("trainee5@fonc2s.local", "Ramon", "Cruz", "TRAINEE", false);

  console.log("Seeding training program, instructor & trainees…");
  const program = await prisma.program.upsert({
    where: { code: "FO-NC2" },
    update: {},
    create: { code: "FO-NC2", title: "Front Office Servicing NC II", description: "TESDA Front Office Servicing NC II training program." },
  });

  const batch = await prisma.trainingBatch.upsert({
    where: { code: "FO-NC2-2026A" },
    update: {},
    create: { programId: program.id, code: "FO-NC2-2026A", startDate: daysFrom(now, -60), endDate: daysFrom(now, 30) },
  });

  const instructor = await prisma.instructor.upsert({
    where: { userId: instructorUser.id },
    update: {},
    create: { userId: instructorUser.id, specialty: "Front Office Operations" },
  });

  const traineeRecords = [];
  const traineeStatuses: Array<"ACTIVE" | "ON_HOLD" | "COMPLETED"> = [
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "COMPLETED",
    "ON_HOLD",
  ];
  for (const [i, user] of [traineeUser1, traineeUser2, traineeUser3, traineeUser4, traineeUser5].entries()) {
    const trainee = await prisma.trainee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        studentNumber: `FO2026-${String(i + 1).padStart(4, "0")}`,
        programId: program.id,
        batchId: batch.id,
        instructorId: instructor.id,
        status: traineeStatuses[i],
      },
    });
    traineeRecords.push(trainee);
  }

  console.log("Seeding competencies…");
  const competencyDefs = [
    {
      code: "FO-CC1",
      title: "Receive and process reservations",
      description: "Handle reservation inquiries and process bookings accurately.",
      learningOutcomes: "Take reservation requests; process reservations; complete tasks related to reservations.",
      performanceCriteria: "Reservation inquiries are handled promptly; correct room and rate applied; confirmations issued.",
    },
    {
      code: "FO-CC2",
      title: "Operate computerized reservation systems",
      description: "Use property management / reservation systems to manage bookings.",
      learningOutcomes: "Access reservation system; update reservation records; generate reports.",
      performanceCriteria: "System is navigated accurately; records are updated in real time; errors are minimized.",
    },
    {
      code: "FO-CC3",
      title: "Provide accommodation reception services",
      description: "Check guests in and out following standard procedures.",
      learningOutcomes: "Register guests; issue room keys; process check-out and settlement.",
      performanceCriteria: "Guest registration is accurate; keys issued securely; check-out completed with correct billing.",
    },
    {
      code: "FO-CC4",
      title: "Conduct night audit",
      description: "Reconcile daily transactions and prepare the night audit report.",
      learningOutcomes: "Review daily transactions; balance accounts; prepare audit reports.",
      performanceCriteria: "All transactions are reconciled; discrepancies investigated; reports completed accurately.",
    },
    {
      code: "FO-CC5",
      title: "Provide club reception services",
      description: "Register and assist club members and visitors.",
      learningOutcomes: "Verify membership; register visitors; log club activity.",
      performanceCriteria: "Membership verified correctly; visitor records maintained; guest requests logged.",
    },
    {
      code: "FO-CC6",
      title: "Provide concierge and bell/porter services",
      description: "Assist guests with luggage, transportation, and information requests.",
      learningOutcomes: "Handle luggage; arrange transport; respond to information requests.",
      performanceCriteria: "Requests are actioned promptly; guest belongings handled with care; accurate information provided.",
    },
    {
      code: "FO-CC7",
      title: "Provide cashiering services",
      description: "Process guest payments, charges, and daily cashier reconciliation.",
      learningOutcomes: "Process payments; issue receipts; reconcile cashier shift.",
      performanceCriteria: "Transactions recorded accurately; receipts issued; shift reconciled without variance.",
    },
  ];

  const competencies = [];
  for (const [i, def] of competencyDefs.entries()) {
    const competency = await prisma.competency.upsert({
      where: { code: def.code },
      update: {},
      create: {
        code: def.code,
        title: def.title,
        description: def.description,
        learningOutcomes: def.learningOutcomes,
        performanceCriteria: def.performanceCriteria,
        requiredActivities: "Complete simulated front office exercises and submit evidence for assessment.",
        assessmentCriteria: "Assessor observation, evidence review, and oral questioning per TESDA competency standards.",
        displayOrder: i + 1,
      },
    });
    competencies.push(competency);
  }

  // Demo progress so the dashboard's "Core Competencies" panel isn't empty.
  const progressMatrix = [
    [100, 100, 90, 80, 85, 90, 95],
    [80, 70, 60, 40, 50, 60, 55],
    [60, 50, 30, 10, 20, 25, 15],
    [100, 100, 100, 100, 100, 100, 100],
    [40, 30, 20, 10, 15, 10, 5],
  ];
  for (const [tIdx, trainee] of traineeRecords.entries()) {
    for (const [cIdx, competency] of competencies.entries()) {
      const progress = progressMatrix[tIdx][cIdx];
      await prisma.traineeCompetency.upsert({
        where: { traineeId_competencyId: { traineeId: trainee.id, competencyId: competency.id } },
        update: { progress },
        create: {
          traineeId: trainee.id,
          competencyId: competency.id,
          progress,
          status:
            progress >= 100 ? "COMPLETED" : progress >= 80 ? "FOR_ASSESSMENT" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
        },
      });
    }
  }

  console.log("Seeding assessments & attendance…");
  let assessmentSeq = 0;
  async function nextAssessmentNo() {
    assessmentSeq += 1;
    return `AS-${year}-${String(assessmentSeq).padStart(6, "0")}`;
  }

  type AssessmentPlan = {
    trainee: number;
    competency: number;
    status: "SCHEDULED" | "UNDER_REVIEW" | "COMPLETED";
    result: "PENDING" | "COMPETENT" | "NOT_YET_COMPETENT";
    daysAgoSubmitted?: number;
    withEvidence?: boolean;
  };

  const assessmentPlans: AssessmentPlan[] = [
    { trainee: 0, competency: 0, status: "COMPLETED", result: "COMPETENT", daysAgoSubmitted: 5, withEvidence: true },
    { trainee: 0, competency: 1, status: "COMPLETED", result: "COMPETENT", daysAgoSubmitted: 3 },
    { trainee: 1, competency: 0, status: "COMPLETED", result: "NOT_YET_COMPETENT", daysAgoSubmitted: 4 },
    { trainee: 1, competency: 1, status: "UNDER_REVIEW", result: "PENDING", daysAgoSubmitted: 1 },
    { trainee: 2, competency: 0, status: "SCHEDULED", result: "PENDING" },
    { trainee: 3, competency: 3, status: "COMPLETED", result: "COMPETENT", daysAgoSubmitted: 10 },
  ];

  for (const plan of assessmentPlans) {
    const assessmentNo = await nextAssessmentNo();
    const trainee = traineeRecords[plan.trainee];
    const competency = competencies[plan.competency];

    const submittedAt = plan.daysAgoSubmitted !== undefined ? daysFrom(now, -plan.daysAgoSubmitted) : null;
    const reviewedAt = plan.status !== "SCHEDULED" && submittedAt ? daysFrom(submittedAt, 1) : null;
    const finalizedAt = plan.status === "COMPLETED" && reviewedAt ? daysFrom(reviewedAt, 1) : null;

    const existing = await prisma.assessment.findUnique({ where: { assessmentNo } });
    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          assessmentNo,
          traineeId: trainee.id,
          competencyId: competency.id,
          assessorId: assessorUser.id,
          status: plan.status,
          result: plan.result,
          scheduledDate: plan.status === "SCHEDULED" ? daysFrom(now, 3) : submittedAt,
          observations:
            plan.status === "SCHEDULED"
              ? null
              : "Trainee demonstrated the required workflow under simulated front-office conditions.",
          remarks:
            plan.status === "COMPLETED"
              ? plan.result === "COMPETENT"
                ? "Successfully demonstrated the required performance criteria."
                : "Did not consistently meet the performance criteria; retake recommended."
              : null,
          submittedAt,
          reviewedAt,
          reviewedById: reviewedAt ? assessorUser.id : null,
          finalizedAt,
          finalizedById: finalizedAt ? assessorUser.id : null,
          createdById: instructorUser.id,
          createdAt: submittedAt ?? now,
        },
      }));

    if (plan.withEvidence) {
      const hasEvidence = await prisma.assessmentEvidence.findFirst({ where: { assessmentId: assessment.id } });
      if (!hasEvidence) {
        await prisma.assessmentEvidence.create({
          data: {
            assessmentId: assessment.id,
            type: "OBSERVATION",
            description: "Assessor observation checklist completed during the simulated reservation exercise.",
            uploadedById: assessorUser.id,
          },
        });
      }
    }
  }

  await prisma.numberSequence.upsert({
    where: { kind_year: { kind: "assessment", year } },
    update: { lastNumber: assessmentSeq },
    create: { kind: "assessment", year, lastNumber: assessmentSeq },
  });

  const attendanceStatuses: Array<"PRESENT" | "LATE" | "ABSENT"> = ["PRESENT", "PRESENT", "LATE", "PRESENT", "ABSENT"];
  for (const trainee of traineeRecords.slice(0, 3)) {
    for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
      const date = daysFrom(now, -dayOffset);
      date.setHours(0, 0, 0, 0);
      await prisma.attendance.upsert({
        where: { traineeId_date: { traineeId: trainee.id, date } },
        update: {},
        create: { traineeId: trainee.id, date, status: attendanceStatuses[4 - dayOffset] },
      });
    }
  }

  console.log("Seeding financial settings (VAT, discounts, bed rate)…");
  // Editable later via Admin -> System Settings; these are seed defaults, not
  // hardcoded calculation constants (src/lib/pricing-config.ts reads them live).
  const settingDefs: { key: string; value: object }[] = [
    { key: "vat_rate", value: { rate: 0.12 } },
    {
      key: "discount_rates",
      value: {
        SENIOR_CITIZEN: { rate: 0.2, vatExempt: true },
        PWD: { rate: 0.2, vatExempt: true },
        // No legal standard for this one — a reasonable configured default,
        // adjustable via System Settings.
        STAKEHOLDER: { rate: 0.1, vatExempt: false },
      },
    },
    { key: "additional_bed_rate", value: { amount: 500 } },
  ];
  for (const def of settingDefs) {
    await prisma.systemSetting.upsert({
      where: { key: def.key },
      update: {},
      create: { key: def.key, value: def.value },
    });
  }

  console.log("Seeding room types & rooms…");
  const roomTypeDefs = [
    { code: "STD", name: "Standard Room", baseRate: 2200, maxOccupancy: 2, description: "Comfortable standard room with essential amenities." },
    { code: "DLX", name: "Deluxe Room", baseRate: 3200, maxOccupancy: 3, description: "Spacious deluxe room with upgraded amenities." },
    { code: "STE", name: "Suite", baseRate: 5500, maxOccupancy: 4, description: "Premium suite with separate living area." },
  ];
  const roomTypes = [];
  for (const def of roomTypeDefs) {
    const rt = await prisma.roomType.upsert({ where: { code: def.code }, update: {}, create: def });
    roomTypes.push(rt);
  }

  const roomPlan: { number: string; floor: number; roomTypeIdx: number; isSmoking: boolean }[] = [];
  for (let floor = 1; floor <= 3; floor++) {
    for (let i = 1; i <= 6; i++) {
      // Every-other room is smoking, spread across all 3 room types (i=2,4,6
      // map to roomTypeIdx 1,0,2) so the smoking-status picker always has a
      // real room to offer regardless of which room type is selected.
      roomPlan.push({ number: `${floor}0${i}`, floor, roomTypeIdx: (i - 1) % 3, isSmoking: i % 2 === 0 });
    }
  }

  const rooms = [];
  for (const plan of roomPlan) {
    const room = await prisma.room.upsert({
      where: { number: plan.number },
      update: { isSmoking: plan.isSmoking },
      create: {
        number: plan.number,
        floor: plan.floor,
        roomTypeId: roomTypes[plan.roomTypeIdx].id,
        status: "VC",
        isSmoking: plan.isSmoking,
      },
    });
    rooms.push(room);
  }

  console.log("Seeding guests…");
  const guestDefs = [
    { firstName: "Juan", lastName: "Dela Cruz", email: "juan.delacruz@example.com", phone: "0917-100-0001", nationality: "Filipino" },
    { firstName: "Maria", lastName: "Santos", email: "maria.santos@example.com", phone: "0917-100-0002", nationality: "Filipino" },
    { firstName: "Pedro", lastName: "Garcia", email: "pedro.garcia@example.com", phone: "0917-100-0003", nationality: "Filipino" },
    { firstName: "Ana", lastName: "Reyes", email: "ana.reyes@example.com", phone: "0917-100-0004", nationality: "Filipino" },
    { firstName: "Liza", lastName: "Mateo", email: "liza.mateo@example.com", phone: "0917-100-0005", nationality: "Filipino" },
    { firstName: "John", lastName: "Smith", email: "john.smith@example.com", phone: "+1-202-555-0110", nationality: "American" },
    { firstName: "Emma", lastName: "Johnson", email: "emma.johnson@example.com", phone: "+44-20-7946-0011", nationality: "British" },
    { firstName: "Wei", lastName: "Chen", email: "wei.chen@example.com", phone: "+86-138-0013-8000", nationality: "Chinese" },
    { firstName: "Sofia", lastName: "Reyes", email: "sofia.reyes@example.com", phone: "0917-100-0009", nationality: "Filipino" },
    { firstName: "Miguel", lastName: "Torres", email: "miguel.torres@example.com", phone: "0917-100-0010", nationality: "Filipino" },
  ];
  const guests = [];
  for (const def of guestDefs) {
    const existing = await prisma.guest.findFirst({ where: { email: def.email } });
    const guest = existing ?? (await prisma.guest.create({ data: def }));
    guests.push(guest);
  }

  console.log("Seeding reservations…");
  let seqCounter = 0;
  async function nextReservationNo() {
    seqCounter += 1;
    return `FO-${year}-${String(seqCounter).padStart(6, "0")}`;
  }

  type ReservationPlan = {
    guest: number;
    room: number;
    arrival: number;
    departure: number;
    status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
    createdAtOffset: number;
    checkIn?: { offset: number };
    checkOut?: { offset: number };
    roomStatus?: "OCC" | "VC" | "VD" | "OOO";
  };

  const plans: ReservationPlan[] = [
    { guest: 0, room: 0, arrival: 0, departure: 3, status: "CONFIRMED", createdAtOffset: -1 },
    { guest: 1, room: 6, arrival: -1, departure: 2, status: "CHECKED_IN", createdAtOffset: -2, checkIn: { offset: -1 }, roomStatus: "OCC" },
    { guest: 2, room: 7, arrival: -2, departure: 0, status: "CHECKED_IN", createdAtOffset: -3, checkIn: { offset: -2 }, roomStatus: "OCC" },
    { guest: 3, room: 12, arrival: 1, departure: 4, status: "PENDING", createdAtOffset: 0 },
    { guest: 4, room: 1, arrival: -5, departure: -2, status: "CHECKED_OUT", createdAtOffset: -6, checkIn: { offset: -5 }, checkOut: { offset: -2 } },
    { guest: 5, room: 2, arrival: 2, departure: 5, status: "CONFIRMED", createdAtOffset: -1 },
    { guest: 6, room: 8, arrival: -1, departure: 1, status: "CHECKED_IN", createdAtOffset: -1, checkIn: { offset: -1 }, roomStatus: "OCC" },
    { guest: 7, room: 13, arrival: 0, departure: 2, status: "PENDING", createdAtOffset: 0 },
    { guest: 8, room: 3, arrival: -10, departure: -8, status: "CANCELLED", createdAtOffset: -11 },
    { guest: 9, room: 4, arrival: -1, departure: 2, status: "NO_SHOW", createdAtOffset: -3 },
  ];

  for (const plan of plans) {
    const reservationNo = await nextReservationNo();
    const arrivalDate = daysFrom(now, plan.arrival);
    const departureDate = daysFrom(now, plan.departure);

    const reservation = await prisma.reservation.upsert({
      where: { reservationNo },
      update: {},
      create: {
        reservationNo,
        guestId: guests[plan.guest].id,
        roomId: rooms[plan.room].id,
        status: plan.status,
        source: "WALK_IN",
        arrivalDate,
        departureDate,
        numGuests: 2,
        createdById: superAdmin.id,
        createdAt: daysFrom(now, plan.createdAtOffset),
      },
    });

    if (plan.checkIn) {
      await prisma.checkIn.upsert({
        where: { reservationId: reservation.id },
        update: {},
        create: { reservationId: reservation.id, checkedInAt: daysFrom(now, plan.checkIn.offset) },
      });
    }
    if (plan.checkOut) {
      await prisma.checkOut.upsert({
        where: { reservationId: reservation.id },
        update: {},
        create: { reservationId: reservation.id, checkedOutAt: daysFrom(now, plan.checkOut.offset) },
      });
    }
    if (plan.roomStatus) {
      await prisma.room.update({ where: { id: rooms[plan.room].id }, data: { status: plan.roomStatus } });
    }
  }

  // A couple of rooms in dirty/out-of-order for a realistic room-status board.
  await prisma.room.update({ where: { id: rooms[14].id }, data: { status: "VD" } });
  await prisma.room.update({ where: { id: rooms[15].id }, data: { status: "VD" } });
  await prisma.room.update({ where: { id: rooms[17].id }, data: { status: "OOO" } });

  // Never regress the counter: real usage (bookings made after the first seed run) may
  // have already advanced it past seqCounter, and re-running seed must not collide with those.
  const existingSequence = await prisma.reservationSequence.findUnique({ where: { year } });
  if (!existingSequence) {
    await prisma.reservationSequence.create({ data: { year, lastNumber: seqCounter } });
  } else if (existingSequence.lastNumber < seqCounter) {
    await prisma.reservationSequence.update({ where: { year }, data: { lastNumber: seqCounter } });
  }

  console.log("\nSeed complete.");
  console.log("Active demo accounts (all use the same password):");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("  supervisor@fonc2s.local  — Supervisor");
  console.log("  frontdesk@fonc2s.local   — Front Office Staff");
  console.log("(superadmin/admin/instructor/assessor/trainee1-5@fonc2s.local still exist as demo data, but are inactive and cannot log in.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
