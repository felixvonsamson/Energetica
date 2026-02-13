import { ApiSchema } from "@/types/api-helpers";

export type Project = ApiSchema<"ProjectOut">;
export type ProjectType = ApiSchema<"ProjectOut">["type"];
export type Requirement = ApiSchema<"RequirementOut">;
export type ExtractionFacility = ApiSchema<"ExtractionFacilityCatalogOut">;
export type ProjectStatus = ApiSchema<"ProjectStatus">;
export type ProjectCategory = "construction" | "research";
