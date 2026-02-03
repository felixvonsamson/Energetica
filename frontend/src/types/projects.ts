import { ApiSchema } from "@/types/api-helpers";

export type ProjectType = ApiSchema<"ProjectOut">["type"];
export type Requirement = ApiSchema<"RequirementOut">;
export type ExtractionFacility = ApiSchema<"ExtractionFacilityCatalogOut">;
