import { ApiSchema } from "@/types/api-helpers";

export type User = ApiSchema<"UserOut">;

export type UserRole = User["role"];
