-- Function to safely decrement stock
create or replace function decrement_stock(p_variant_id bigint, p_quantity int)
returns void
language plpgsql
security definer
as $$
begin
  update product_variants
  set stock = stock - p_quantity
  where variant_id = p_variant_id;
  
  if not found then
    raise exception 'Product variant not found';
  end if;
end;
$$;
