import { Box } from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * Purple identity for anything that is a product (a reusable automation).
 * Use it wherever a workflow is an instance of a product.
 */
export function ProductTag({ name, slug, size = 'md', style }: { name?: string; slug?: string; size?: 'sm' | 'md'; style?: CSSProperties }) {
  const inner = (
    <>
      <Box size={size === 'sm' ? 10 : 11} />
      {name ?? 'Product'}
    </>
  );
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: size === 'sm' ? 18 : 22,
    padding: size === 'sm' ? '0 6px' : '0 8px',
    borderRadius: 999,
    fontSize: size === 'sm' ? 10 : 11,
    fontWeight: 500,
    background: 'var(--product-soft)',
    color: 'var(--product-text)',
    border: '1px solid var(--product-border)',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    ...style,
  };
  if (slug) {
    return (
      <a href={`/products/${slug}`} style={base} title={`Instance of the ${name ?? 'product'} product`}>
        {inner}
      </a>
    );
  }
  return <span style={base}>{inner}</span>;
}

/** A tiny purple dot for dense views. */
export function ProductDot({ size = 7 }: { size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--product)', display: 'inline-block', flex: 'none' }} title="Product instance" />;
}
