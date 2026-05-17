import bcrypt from "bcrypt";
import ChapterAdmins from "../models/ChapterAdmins.js";
import { ROLES } from "../constants/roles.js";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const INVITE_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS || "24", 10);

const BOOTSTRAP_EMAIL = "tenet@chapter.com";
const BOOTSTRAP_PASSWORD = "tenet123";

const backfillMissingNames = async (): Promise<void> => {
  const missing = await ChapterAdmins.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  }).select("_id email role");

  if (missing.length === 0) return;

  await Promise.all(
    missing.map((doc) => {
      const fallback =
        doc.role === ROLES.TENET
          ? "Bootstrap Tenet"
          : doc.email?.split("@")[0] || "User";
      return ChapterAdmins.updateOne(
        { _id: doc._id },
        { $set: { name: fallback } }
      );
    })
  );
  console.log(`Backfilled name on ${missing.length} legacy admin record(s).`);
};

// Strips the legacy `access` field from old ChapterAdmins documents.
// Access is now resolved at request time from adminGroupId.
const dropLegacyAccessField = async (): Promise<void> => {
  const result = await ChapterAdmins.collection.updateMany(
    { access: { $exists: true } },
    { $unset: { access: 1 } }
  );
  if (result.modifiedCount > 0) {
    console.log(
      `Removed legacy 'access' field from ${result.modifiedCount} admin record(s).`
    );
  }
};

// Logs operators/partners that have no adminGroupId — they'll resolve to empty access.
const warnOrphanedAdmins = async (): Promise<void> => {
  const orphans = await ChapterAdmins.find({
    role: { $ne: ROLES.TENET },
    adminGroupId: null,
  }).select("email role");
  if (orphans.length === 0) return;
  console.warn(
    `[admin-groups] ${orphans.length} non-tenet admin(s) have no adminGroupId and will resolve to empty access:`
  );
  for (const o of orphans) {
    console.warn(`  - ${o.email} (${o.role})`);
  }
};

export const seedTenet = async (): Promise<void> => {
  await backfillMissingNames();
  await dropLegacyAccessField();
  await warnOrphanedAdmins();

  const exists = await ChapterAdmins.exists({ role: ROLES.TENET });
  if (exists) return;

  const password = await bcrypt.hash(BOOTSTRAP_PASSWORD, BCRYPT_ROUNDS);
  const inviteExpiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await ChapterAdmins.create({
    name: "Main Tenet",
    email: BOOTSTRAP_EMAIL,
    password,
    role: ROLES.TENET,
    adminGroupId: null,
    mustChangePassword: true,
    inviteExpiresAt,
  });

  console.log(
    `Bootstrap tenet created: ${BOOTSTRAP_EMAIL} (must change password on first login).`
  );
};
