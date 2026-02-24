import type { Metadata } from "next";
import { loadCarCategories, loadProductCategories } from "src/lib/categories";
import {
  loadProducts,
  loadProductsWithMeta,
  plainText,
} from "src/lib/products";
import { slugify } from "src/lib/slug";
import { siteBase } from "src/lib/seo";
import { MobileFilterSheet } from "src/components/MobileFilterSheet";
import { ProductInfiniteGrid } from "src/components/ProductInfiniteGrid";

const SEO_TITLE = "Каталог тюнінгу та автотоварів";
const SEO_DESC =
  "Підбір автотоварів за маркою, моделлю та категорією. Актуальні товари та фільтри.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    pcat?: string;
    brand?: string;
    model?: string;
    gen?: string;
    page?: string;
    perPage?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const base = siteBase();
  const canonicalPath = "/catalog";
  const canonical = base ? `${base}${canonicalPath}` : canonicalPath;
  const brand = (params?.brand || "").trim();
  const model = (params?.model || "").trim();
  const gen = (params?.gen || "").trim();
  const page = Number.parseInt(params?.page || "1", 10) || 1;
  const perPage = Number.parseInt(params?.perPage || "24", 10) || 24;
  const hasFilters =
    Boolean(params?.pcat) ||
    Boolean(brand) ||
    Boolean(model) ||
    Boolean(gen) ||
    page > 1 ||
    perPage !== 24;
  if (hasFilters) {
    return {
      title: SEO_TITLE,
      description: SEO_DESC,
      robots: { index: false, follow: true },
    };
  }
  const { total } = await loadProductsWithMeta(
    { limit: 1, offset: 0, compact: true },
    { revalidate: 300 },
  );
  return {
    title: SEO_TITLE,
    description: SEO_DESC,
    alternates: total > 0 && SEO_DESC.trim() ? { canonical } : undefined,
    robots:
      total > 0 && SEO_DESC.trim()
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    pcat?: string;
    brand?: string;
    model?: string;
    gen?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const brandSlug = (params?.brand || "").toLowerCase();
  const modelSlug = (params?.model || "").toLowerCase();
  const genSlug = (params?.gen || "").toLowerCase();
  const page = Math.max(Number.parseInt(params?.page || "1", 10) || 1, 1);
  const perPage = (() => {
    const v = Number.parseInt(params?.perPage || "24", 10);
    if ([12, 24, 30].includes(v)) return v;
    return 24;
  })();
  const offset = (page - 1) * perPage;
  const activeCategorySlug = (params?.pcat || "").toLowerCase();

  const [{ items, total }, carCategories, productCategories, brandProducts] =
    await Promise.all([
      loadProductsWithMeta(
        {
          limit: perPage,
          offset,
          category: activeCategorySlug || undefined,
          brand: brandSlug || undefined,
          model: modelSlug || undefined,
          compact: true,
        },
        { revalidate: 300 },
      ),
      loadCarCategories({ revalidate: 900 }),
      loadProductCategories({ revalidate: 900 }),
      loadProducts({ limit: 30, compact: true }, { revalidate: 300 }),
    ]);

  const brandMap = new Map<string, string>();
  carCategories.forEach((c) => {
    const name = plainText(c.name);
    const slug = c.slug || slugify(name);
    if (slug) brandMap.set(slug, name);
  });
  brandProducts.forEach((p) => {
    const name = plainText(p.brand);
    const slug = slugify(name);
    if (slug && !brandMap.has(slug)) brandMap.set(slug, name);
  });
  const brands = Array.from(brandMap.entries())
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categories = productCategories
    .filter((c) => Boolean(c.name))
    .map((c) => ({
      name: plainText(c.name),
      slug: c.slug || slugify(c.name),
      path: c.path,
    }));

  const activeCategoryName =
    categories.find((c) => c.slug === activeCategorySlug)?.name || "";

  const urlParams = new URLSearchParams();
  if (activeCategorySlug) urlParams.set("pcat", activeCategorySlug);
  if (brandSlug) urlParams.set("brand", brandSlug);
  if (modelSlug) urlParams.set("model", modelSlug);
  if (genSlug) urlParams.set("gen", genSlug);
  urlParams.set("perPage", perPage.toString());
  urlParams.set("page", (page + 1).toString());
  const nextHref =
    items.length + offset < total ? `/catalog?${urlParams.toString()}` : null;

  const resetKey = JSON.stringify({
    pcat: activeCategorySlug,
    brand: brandSlug,
    model: modelSlug,
    gen: genSlug,
    perPage,
    page,
  });

  return (
    <main className="page catalog-page">
      <section className="catalog-layout">
        <aside className="catalog-sidebar">
          <div className="sidebar-head">
            <p className="eyebrow">Каталог</p>
            <h2>{SEO_TITLE}</h2>
            <p className="muted">
              Обери марку, модель або категорію, щоб швидко знайти потрібні
              товари.
            </p>
          </div>

          <details className="filter-block filter-accordion" open>
            <summary className="filter-summary">
              <span className="filter-title">Марки та моделі</span>
              <span className="filter-chevron" aria-hidden="true"></span>
            </summary>
            <div className="filter-list">
              {brands.map((brand) => (
                <a
                  key={brand.slug}
                  className="filter-link"
                  href={`/catalog/${brand.slug}`}
                >
                  {brand.name}
                </a>
              ))}
              {brands.length === 0 && (
                <span className="muted">Марки ще не додані.</span>
              )}
            </div>
          </details>

          <details className="filter-block filter-accordion" open>
            <summary className="filter-summary">
              <span className="filter-title">Категорії</span>
              <span className="filter-chevron" aria-hidden="true"></span>
            </summary>
            <div className="filter-list">
              {categories.map((cat) => (
                <a
                  key={cat.slug}
                  className={`filter-link ${cat.slug === activeCategorySlug ? "active" : ""}`}
                  href={`/catalog?pcat=${encodeURIComponent(cat.slug)}`}
                >
                  {cat.name}
                </a>
              ))}
              {categories.length === 0 && (
                <span className="muted">Категорії ще не додані.</span>
              )}
            </div>
          </details>
        </aside>

        <div className="catalog-content">
          <nav className="breadcrumbs" aria-label="Breadcrumbs">
            <a href="/">Головна</a>
            <span>/</span>
            <span>Каталог</span>
          </nav>

          <div className="catalog-summary">
            <div>
              <h1>{SEO_TITLE}</h1>
              <p className="muted">Знайдено товарів: {total}</p>
            </div>
            <div className="filter-chips">
              {activeCategoryName && (
                <a className="filter-chip" href="/catalog">
                  {activeCategoryName}
                </a>
              )}
              {activeCategoryName && (
                <a className="chip-clear" href="/catalog">
                  Скинути фільтри
                </a>
              )}
            </div>
          </div>
          <a
            className="filter-trigger filter-trigger--side mobile-only"
            href="#mobile-filters"
            aria-label="Фільтр"
          >
            Фільтр
          </a>
          <MobileFilterSheet
            id="mobile-filters"
            title="Категорії"
            basePath="/catalog"
            activeValue={activeCategorySlug}
            options={categories.map((cat) => ({
              label: cat.name,
              value: cat.slug,
            }))}
          />

          <ProductInfiniteGrid
            initialItems={items}
            total={total}
            perPage={perPage}
            initialOffset={offset}
            query={{
              category: activeCategorySlug || undefined,
              brand: brandSlug || undefined,
              model: modelSlug || undefined,
              compact: true,
            }}
            resetKey={resetKey}
            nextHref={nextHref}
            emptyTitle="Порожньо"
            emptyText="Поки немає товарів за вибраними фільтрами."
          />
        </div>
      </section>
    </main>
  );
}
