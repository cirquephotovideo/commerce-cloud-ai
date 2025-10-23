export const exportProductsWithAttributes = (products: any[]) => {
  const headers = [
    'REFERENCE',
    'GENCOD',
    'MARQUE',
    'CATEGORIE',
    'LIBELLE COURT',
    'DESCRIPTION PRODUIT complète',
    // Attributs Odoo
    'Type de hotte',
    'Mode de fonctionnement',
    'Largeur',
    'Débit d\'air (max) IEC 61591',
    'Niveau sonore (max)',
    'Classe énergétique',
    'Nombre de vitesses',
    'Mode intensif / Booster',
    'Type de commandes',
    'Éclairage',
    'Filtre à graisse',
    'Filtre charbon actif',
    'Diamètre sortie d\'air',
    'Couleur / Finition',
    'Hauteur (plage)',
    'Profondeur (plage)',
    'Cheminée réglable',
    'Connectivité / App'
  ];

  const rows = products.map(p => {
    const odooAttrs = p.odoo_attributes || {};
    return [
      p.supplier_reference || p.reference || '',
      p.ean || '',
      p.analysis_result?.brand || p.additional_data?.brand || '',
      p.mapped_category_name || '',
      p.analysis_result?.productName || p.product_name || '',
      p.description || '',
      // Extraire depuis odoo_attributes
      odooAttrs['Type de hotte'] || '',
      odooAttrs['Mode de fonctionnement'] || '',
      odooAttrs['Largeur'] || '',
      odooAttrs['Débit d\'air (max) IEC 61591'] || '',
      odooAttrs['Niveau sonore (max)'] || '',
      odooAttrs['Classe énergétique'] || '',
      odooAttrs['Nombre de vitesses'] || '',
      odooAttrs['Mode intensif / Booster'] || '',
      odooAttrs['Type de commandes'] || '',
      odooAttrs['Éclairage'] || '',
      odooAttrs['Filtre à graisse'] || '',
      odooAttrs['Filtre charbon actif'] || '',
      odooAttrs['Diamètre sortie d\'air'] || '',
      odooAttrs['Couleur / Finition'] || '',
      odooAttrs['Hauteur (plage)'] || '',
      odooAttrs['Profondeur (plage)'] || '',
      odooAttrs['Cheminée réglable'] || '',
      odooAttrs['Connectivité / App'] || '',
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join('\t'))
    .join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `produits_enrichis_odoo_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};
