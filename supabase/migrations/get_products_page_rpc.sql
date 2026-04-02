-- =============================================
-- RPC: get_products_page (V3 — SIMPLE & FAST)
-- No COUNT(*), no LATERAL, no correlated subqueries
-- Just: fetch products → fetch variants → merge
-- =============================================

DROP FUNCTION IF EXISTS get_products_page(INT, INT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION get_products_page(
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 20,
    p_search TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_subcategory TEXT DEFAULT NULL,
    p_trending BOOLEAN DEFAULT FALSE,
    p_min_price NUMERIC DEFAULT 0,
    p_max_price NUMERIC DEFAULT 999999
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '8s'
AS $$
DECLARE
    v_offset INT;
    v_product_ids INT[];
    v_products JSONB;
    v_variants JSONB;
    v_result JSONB := '[]'::jsonb;
    v_has_more BOOLEAN := false;
    v_subcategory_ids INT[];
    v_prod RECORD;
    v_prod_variants JSONB;
    v_first_v JSONB;
    v_sale NUMERIC;
    v_reg NUMERIC;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- ── Step 1: Resolve category filter ──
    IF p_subcategory IS NOT NULL THEN
        SELECT ARRAY_AGG(subcategory_id) INTO v_subcategory_ids
        FROM subcategories WHERE LOWER(name) = LOWER(p_subcategory);
    ELSIF p_category IS NOT NULL THEN
        SELECT ARRAY_AGG(sc.subcategory_id) INTO v_subcategory_ids
        FROM subcategories sc
        JOIN categories c ON sc.category_id = c.id
        WHERE LOWER(c.name) = ANY(
            SELECT LOWER(TRIM(cat)) FROM unnest(string_to_array(p_category, ',')) AS cat
        );
    END IF;

    -- ── Step 2: Fetch product IDs (limit + 1 for hasMore peek) ──
    SELECT ARRAY_AGG(product_id ORDER BY product_id DESC)
    INTO v_product_ids
    FROM (
        SELECT mp.product_id
        FROM master_product mp
        WHERE mp."is_Active" = true
          AND (p_search IS NULL OR mp.name ILIKE '%' || p_search || '%' OR mp.sku ILIKE '%' || p_search || '%')
          AND (v_subcategory_ids IS NULL OR mp.subcategory_id = ANY(v_subcategory_ids))
        ORDER BY mp.product_id DESC
        LIMIT p_limit + 1
        OFFSET v_offset
    ) sub;

    -- Empty result
    IF v_product_ids IS NULL OR array_length(v_product_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'data', '[]'::jsonb, 'total', 0,
            'page', p_page, 'limit', p_limit, 'totalPages', 0, 'hasMore', false
        );
    END IF;

    -- hasMore check
    v_has_more := array_length(v_product_ids, 1) > p_limit;
    IF v_has_more THEN
        v_product_ids := v_product_ids[1:p_limit]; -- trim to exact limit
    END IF;

    -- ── Step 3: Fetch all variants for these products (SINGLE query) ──
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'product_id', pv.product_id,
            'variant_id', pv.variant_id,
            'variant_name', pv.variant_name,
            'name', pv.variant_name,
            'sku', pv.sku,
            'saleprice', COALESCE(pv.saleprice, pv.regularprice, 0),
            'salePrice', COALESCE(pv.saleprice, pv.regularprice, 0),
            'regularprice', COALESCE(pv.regularprice, pv.saleprice, 0),
            'regularPrice', COALESCE(pv.regularprice, pv.saleprice, 0),
            'stock', COALESCE(pv.stock, 0),
            'stock_quantity', COALESCE(pv.stock, 0),
            'image_url', pv.image_url,
            'isActive', pv."is_Active",
            'is_Active', pv."is_Active",
            'is_trending', pv.is_trending
        )
    ), '[]'::jsonb) INTO v_variants
    FROM product_variants pv
    WHERE pv.product_id = ANY(v_product_ids) AND pv."is_Active" = true;

    -- ── Step 4: Build final result by merging products + variants ──
    FOR v_prod IN
        SELECT mp.product_id, mp.name, mp.description, mp.image_url,
               mp.sku, mp.rating, mp.review_count, mp.subcategory_id
        FROM master_product mp
        WHERE mp.product_id = ANY(v_product_ids)
        ORDER BY mp.product_id DESC
    LOOP
        -- Get variants for this product
        SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
        INTO v_prod_variants
        FROM jsonb_array_elements(v_variants) AS v
        WHERE (v->>'product_id')::int = v_prod.product_id;

        -- Get first variant with pricing
        SELECT v INTO v_first_v
        FROM jsonb_array_elements(v_prod_variants) AS v
        WHERE (v->>'saleprice')::numeric > 0 OR (v->>'regularprice')::numeric > 0
        LIMIT 1;

        IF v_first_v IS NULL AND jsonb_array_length(v_prod_variants) > 0 THEN
            v_first_v := v_prod_variants->0;
        END IF;

        v_sale := COALESCE((v_first_v->>'saleprice')::numeric, 0);
        v_reg := COALESCE((v_first_v->>'regularprice')::numeric, 0);

        -- Price filter
        IF (p_min_price > 0 OR p_max_price < 999999) AND (v_sale < p_min_price OR v_sale > p_max_price) THEN
            CONTINUE;
        END IF;

        -- Trending filter
        IF p_trending AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_prod_variants) AS tv
            WHERE (tv->>'is_trending')::boolean = true
        ) THEN
            CONTINUE;
        END IF;

        v_result := v_result || jsonb_build_object(
            'id', v_prod.product_id,
            'product_id', v_prod.product_id,
            'name', v_prod.name,
            'product_name', v_prod.name,
            'title', v_prod.name,
            'description', v_prod.description,
            'image_url', COALESCE(v_first_v->>'image_url', v_prod.image_url),
            'imageUrl', COALESCE(v_first_v->>'image_url', v_prod.image_url),
            'rating', COALESCE(v_prod.rating, 0),
            'review_count', COALESCE(v_prod.review_count, 0),
            'sku', COALESCE(v_first_v->>'sku', v_prod.sku),
            'price', v_sale, 'saleprice', v_sale, 'salePrice', v_sale,
            'original_price', v_reg, 'regularprice', v_reg, 'regularPrice', v_reg,
            'variant_id', (v_first_v->>'variant_id')::int,
            'subcategory_id', v_prod.subcategory_id,
            'subcategory_name', '-', 'subcategoryName', '-',
            'has_pricing', (v_sale > 0 OR v_reg > 0),
            'isActive', true, 'is_Active', true,
            'variants', v_prod_variants
        );
    END LOOP;

    -- ── Return ──
    RETURN jsonb_build_object(
        'data', v_result,
        'total', CASE WHEN v_has_more THEN (p_page * p_limit) + 1 ELSE (p_page - 1) * p_limit + jsonb_array_length(v_result) END,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CASE WHEN v_has_more THEN p_page + 1 ELSE p_page END,
        'hasMore', v_has_more
    );
END;
$$;
