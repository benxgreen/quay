import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/better-auth";

/** Better Auth's endpoints: the Microsoft sign-in, its callback, session and sign-out. */
export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
