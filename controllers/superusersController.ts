import { makeAdminCrudController } from "./adminCrudFactory.js";
import { ROLES } from "../constants/roles.js";

export const superusersController = makeAdminCrudController(ROLES.SUPERUSER);
