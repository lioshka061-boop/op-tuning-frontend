import { NextRequest, NextResponse } from 'next/server';
import { loadProduct } from '../../../lib/products';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ article: string; slug: string }> },
) {
  const { article } = await params;
  const decoded = decodeURIComponent(article);
  const product = await loadProduct(decoded, { revalidate: 300 });

  if (!product?.path) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.redirect(new URL(product.path, request.url), 301);
}
