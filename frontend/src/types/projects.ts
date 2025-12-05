import { ApiSchema } from "./api-helpers";

export type ProjectType = ApiSchema<"ProjectOut">["type"];
export type Requirement = ApiSchema<"RequirementOut">;
