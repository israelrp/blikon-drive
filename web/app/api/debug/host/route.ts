import { NextResponse } from "next/server";
import { headers } from "next/headers";

// TEMPORAL — diagnóstico de ruteo por subdominio. Devuelve los headers de host
// que ve el server component en Netlify, para confirmar de dónde sacar el folder.
// Borrar tras diagnosticar.
export async function GET() {
  const h = await headers();
  return NextResponse.json({
    host:              h.get("host"),
    xForwardedHost:    h.get("x-forwarded-host"),
    xNfRequestId:      h.get("x-nf-request-id"),
    xForwardedProto:   h.get("x-forwarded-proto"),
    referer:           h.get("referer"),
  });
}
