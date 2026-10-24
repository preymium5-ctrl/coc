import dashboard from "../ui/index.html?raw";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(dashboard, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
