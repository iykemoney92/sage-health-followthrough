import { NextRequest } from "next/server";

export function appUrl(path: string, request: NextRequest) {
  const url = new URL(path, request.url);
  if (url.hostname === "[::]" || url.hostname === "::" || url.hostname === "::1") {
    url.hostname = "localhost";
    url.port = url.port || "3000";
  }
  return url;
}
