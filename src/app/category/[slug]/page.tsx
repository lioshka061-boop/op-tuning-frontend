import { permanentRedirect } from 'next/navigation';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await params;
  const slug = slugParam.toLowerCase();
  permanentRedirect(`/catalog?pcat=${encodeURIComponent(slug)}`);
}
