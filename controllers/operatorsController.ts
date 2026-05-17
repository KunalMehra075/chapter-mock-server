import { makeAdminCrudController } from "./adminCrudFactory.js";
import { ROLES } from "../constants/roles.js";

export const operatorsController = makeAdminCrudController(ROLES.OPERATOR);
