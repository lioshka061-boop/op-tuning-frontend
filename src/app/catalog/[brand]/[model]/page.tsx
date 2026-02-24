import type { Metadata } from "next";
import { cache } from "react";
import {
  loadCarCategories,
  loadModelCategories,
  loadProductCategories,
  findBrand,
  findModel,
} from "src/lib/categories";
import {
  loadProducts,
  loadProductsWithMeta,
  plainText,
} from "src/lib/products";
import { equalsSlug, slugify } from "src/lib/slug";
import { ProductInfiniteGrid } from "src/components/ProductInfiniteGrid";

const SEO_TITLE = "Каталог тюнінгу та автотоварів";

// Cache data loading functions to prevent duplicate requests
const cachedLoadCarCategories = cache(loadCarCategories);
const cachedLoadProductCategories = cache(loadProductCategories);
const cachedLoadModelCategories = cache(loadModelCategories);
const cachedLoadProductsWithMeta = cache(loadProductsWithMeta);
const cachedLoadProducts = cache(loadProducts);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string; model: string }>;
  searchParams?: Promise<{ pcat?: string; page?: string; perPage?: string }>;
}): Promise<Metadata> {
  // Generate metadata from params only - no blocking API calls
  const { brand, model } = await params;
  const brandSlug = brand.toLowerCase();
  const modelSlug = model.toLowerCase();
  const resolvedSearchParams = await searchParams;
  const page = Number.parseInt(resolvedSearchParams?.page || "1", 10) || 1;
  const perPage =
    Number.parseInt(resolvedSearchParams?.perPage || "24", 10) || 24;
  const hasFilters =
    Boolean(resolvedSearchParams?.pcat) || page > 1 || perPage !== 24;

  // Use slug-based title as fallback - actual metadata will be set by page component
  const title = `${modelSlug} - ${brandSlug}`;
  const description = "";

  return {
    title,
    description,
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string; model: string }>;
  searchParams?: Promise<{ pcat?: string; page?: string; perPage?: string }>;
}) {
  const { brand, model } = await params;
  const brandSlug = brand.toLowerCase();
  const modelSlug = model.toLowerCase();
  const resolvedSearchParams = await searchParams;
  const page = Math.max(
    Number.parseInt(resolvedSearchParams?.page || "1", 10) || 1,
    1,
  );
  const perPage = (() => {
    const v = Number.parseInt(resolvedSearchParams?.perPage || "24", 10);
    if ([12, 24, 30].includes(v)) return v;
    return 24;
  })();
  const offset = (page - 1) * perPage;
  const activeCategorySlug = (resolvedSearchParams?.pcat || "").toLowerCase();

  // Start modelCategories loading in parallel (non-blocking, for hints only)
  const modelCategoriesPromise = cachedLoadModelCategories(
    { brand: brandSlug, model: modelSlug },
    { revalidate: 900 },
  ).catch(() => [] as string[]);

  // Load critical data first (blocking)
  const [carCategories, productCategories, { items, total }] =
    await Promise.all([
      cachedLoadCarCategories({ revalidate: 900 }),
      cachedLoadProductCategories({ revalidate: 900 }),
      cachedLoadProductsWithMeta(
        {
          brand: brandSlug,
          model: modelSlug,
          category: activeCategorySlug || undefined,
          limit: perPage,
          offset,
          compact: true,
        },
        { revalidate: 300 },
      ),
    ]);

  const brandNode = findBrand(carCategories, brandSlug, slugify);
  const modelNode = findModel(brandNode, modelSlug, slugify);
  const brandName = plainText(brandNode?.name || brandSlug);
  const modelName = plainText(modelNode?.name || modelSlug);

  // Build model list from tree first
  const modelsFromTree = brandNode?.children || [];
  const modelMap = new Map<string, string>();
  modelsFromTree.forEach((m) => {
    const name = plainText(m.name);
    const slug = m.slug || slugify(name);
    if (slug) modelMap.set(slug, name);
  });

  // Only load brandProducts if we don't have models from tree (non-blocking)
  let brandProducts: Awaited<ReturnType<typeof cachedLoadProducts>> = [];
  if (modelsFromTree.length === 0) {
    brandProducts = await cachedLoadProducts(
      { brand: brandSlug, limit: 30, offset: 0, compact: true },
      { revalidate: 300 },
    );
    brandProducts.forEach((p) => {
      const name = plainText(p.model);
      const slug = slugify(name);
      if (slug && !modelMap.has(slug)) modelMap.set(slug, name);
    });
  }

  const models = Array.from(modelMap.values()).sort((a, b) =>
    a.localeCompare(b),
  );
  const categories = productCategories
    .filter((c) => Boolean(c.name))
    .map((c) => ({
      name: plainText(c.name),
      slug: c.slug || slugify(c.name),
    }));

  const activeCategoryName =
    categories.find((c) => c.slug === activeCategorySlug)?.name || "";

  const paramsNext = new URLSearchParams();
  if (activeCategorySlug) paramsNext.set("pcat", activeCategorySlug);
  paramsNext.set("perPage", perPage.toString());
  paramsNext.set("page", (page + 1).toString());
  const nextHref =
    items.length + offset < total
      ? `/catalog/${brandSlug}/${modelSlug}?${paramsNext.toString()}`
      : null;

  const resetKey = JSON.stringify({
    brandSlug,
    modelSlug,
    pcat: activeCategorySlug,
    perPage,
    page,
  });

  // Get category hints (non-blocking, will show empty if not loaded yet)
  // This promise was started in parallel with critical data, so it may already be resolved
  const modelCategories = await modelCategoriesPromise;
  const categoryHints = modelCategories
    .filter(Boolean)
    .slice(0, 3)
    .map((c) => plainText(c))
    .join(", ");

  return (
    <main className="page catalog-page">
      <section className="catalog-layout">
        <aside className="catalog-sidebar">
          <div className="sidebar-head">
            <p className="eyebrow">Каталог</p>
            <h2>{SEO_TITLE}</h2>
            <p className="muted">
              {brandName} / {modelName}
              {categoryHints ? ` • популярні: ${categoryHints}` : ""}
            </p>
          </div>

          <details className="filter-block filter-accordion" open>
            <summary className="filter-summary">
              <span className="filter-summary-main">
                <span className="filter-title">Марки та моделі</span>
                <a className="filter-back" href={`/catalog/${brandSlug}`}>
                  ← До бренду
                </a>
              </span>
              <span className="filter-chevron" aria-hidden="true"></span>
            </summary>
            <div className="filter-list">
              <span className="filter-link active">{brandName}</span>
              {models.map((model) => (
                <a
                  key={model}
                  className={`filter-link ${equalsSlug(model, modelSlug) ? "active" : ""}`}
                  href={`/catalog/${brandSlug}/${slugify(model)}`}
                >
                  {plainText(model)}
                </a>
              ))}
              {models.length === 0 && (
                <span className="muted">Моделі ще не додані.</span>
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
                  href={`/catalog/${brandSlug}/${modelSlug}?pcat=${encodeURIComponent(cat.slug)}`}
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
            <a href="/catalog">Каталог</a>
            <span>/</span>
            <a href={`/catalog/${brandSlug}`}>{brandName}</a>
            <span>/</span>
            <span>{modelName}</span>
          </nav>

          <div className="catalog-summary">
            <div>
              <h1>{modelName}</h1>
              <p className="muted">Знайдено товарів: {total}</p>
            </div>
            <div className="filter-chips">
              <a className="filter-chip" href={`/catalog/${brandSlug}`}>
                {brandName}
              </a>
              <a
                className="filter-chip"
                href={`/catalog/${brandSlug}/${modelSlug}`}
              >
                {modelName}
              </a>
              {activeCategoryName && (
                <a
                  className="filter-chip"
                  href={`/catalog/${brandSlug}/${modelSlug}`}
                >
                  {activeCategoryName}
                </a>
              )}
              <a
                className="chip-clear"
                href={`/catalog/${brandSlug}/${modelSlug}`}
              >
                Скинути фільтри
              </a>
            </div>
          </div>

          <ProductInfiniteGrid
            initialItems={items}
            total={total}
            perPage={perPage}
            initialOffset={offset}
            query={{
              brand: brandSlug,
              model: modelSlug,
              category: activeCategorySlug || undefined,
              compact: true,
            }}
            resetKey={resetKey}
            nextHref={nextHref}
            emptyTitle="Порожньо"
            emptyText="Для цієї моделі поки немає товарів за вибраними фільтрами."
          />
        </div>
      </section>
    </main>
  );
}
