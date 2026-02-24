import { NextResponse } from "next/server";
import { loadProduct } from "src/lib/products";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ article: string }> },
) {
  const { article: articleParam } = await params;
  const raw = decodeURIComponent(articleParam);
  const article = raw.includes("--") ? raw.split("--").pop() || raw : raw;
  if (!article) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const product = await loadProduct(article, { revalidate: 300 });
  const path = product?.path;
  if (!path || !path.startsWith("/item/")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.redirect(new URL(path, request.url), 301);
}
