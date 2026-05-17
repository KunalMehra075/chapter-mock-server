import bcrypt from "bcrypt";
import ChapterAdmins from "../models/ChapterAdmins.js";
import { DEFAULT_ACCESS, ROLES } from "../constants/roles.js";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const INVITE_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS || "24", 10);

const BOOTSTRAP_EMAIL = "operator@chapter.com";
const BOOTSTRAP_PASSWORD = "operator123";

// Backfills `name` for ChapterAdmins documents created before the field was added.
// Without this, save() during completeInvite / resendInvite rejects the doc with a validation error.
const backfillMissingNames = async (): Promise<void> => {
  const missing = await ChapterAdmins.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  }).select("_id email role");

  if (missing.length === 0) return;

  await Promise.all(
    missing.map((doc) => {
      const fallback =
        doc.role === ROLES.OPERATOR
          ? "Bootstrap Operator"
          : doc.email?.split("@")[0] || "User";
      return ChapterAdmins.updateOne(
        { _id: doc._id },
        { $set: { name: fallback } }
      );
    })
  );
  console.log(`Backfilled name on ${missing.length} legacy admin record(s).`);
};

export const seedOperator = async (): Promise<void> => {
  await backfillMissingNames();

  const exists = await ChapterAdmins.exists({ role: ROLES.OPERATOR });
  if (exists) return;

  const password = await bcrypt.hash(BOOTSTRAP_PASSWORD, BCRYPT_ROUNDS);
  const inviteExpiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await ChapterAdmins.create({
    name: "Main Operator",
    email: BOOTSTRAP_EMAIL,
    password,
    role: ROLES.OPERATOR,
    access: DEFAULT_ACCESS[ROLES.OPERATOR],
    mustChangePassword: true,
    inviteExpiresAt,
  });

  console.log(
    `Bootstrap operator created: ${BOOTSTRAP_EMAIL} (must change password on first login).`
  );
};
