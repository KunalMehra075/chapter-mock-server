import { makeAdminCrudController } from "./adminCrudFactory.js";
import { ROLES } from "../constants/roles.js";

export const tenetsController = makeAdminCrudController(ROLES.TENET);
