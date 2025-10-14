export interface ProductNavigationEvent {
  productId: string;
  productName: string;
  targetSection?: 'specifications' | 'cost_analysis' | 'technical_description' | 'amazon' | 'video' | 'images' | 'rsgp' | 'overview' | 'description';
}

export const navigateToProduct = (event: ProductNavigationEvent) => {
  window.dispatchEvent(new CustomEvent('navigate-to-product', { detail: event }));
};
