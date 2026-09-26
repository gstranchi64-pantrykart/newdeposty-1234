import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProductImageSlider } from '../common/ProductImageSlider';
import { ProductFourImageUploader } from '../common/ProductFourImageUploader';
import { ProductDetailModal } from '../common/ProductDetailModal';
import { AppWindowModal } from '../common/AppWindowModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  Eye,
  ShoppingBag,
  CreditCard,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Barcode,
  Images,
  Maximize2,
  X,
} from 'lucide-react';

export const ProductCatalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Detail / 4-Image Inspection Modal
  const [inspectProduct, setInspectProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'Grains & Flours',
    description: '',
    barcode: '',
    hsn: '1006',
    weightSize: '1 kg',
    mrp: 100,
    sellingPrice: 90,
    discount: 10,
    orderEligibility: 'BOTH' as 'BOTH' | 'PANTRY_ONLY' | 'QUICK_ONLY',
    status: 'PUBLISHED' as Product['status'],
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607349913338-fca6f742960f?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    ] as [string, string, string, string],
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const list = await api.getProducts(false);
      setProducts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const unsubscribe = api.subscribeRealtime(() => {
      fetchProducts();
    });
    return () => unsubscribe();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    const randomBarcode = String(Math.floor(100000000000 + Math.random() * 900000000000));
    setFormData({
      name: '',
      brand: '',
      category: 'Grains & Flours',
      description: '',
      barcode: randomBarcode,
      hsn: '1006',
      weightSize: '1 kg',
      mrp: 100,
      sellingPrice: 90,
      discount: 10,
      orderEligibility: 'BOTH',
      status: 'PUBLISHED',
      images: [
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1607349913338-fca6f742960f?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      ],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    const imagesArray: [string, string, string, string] = [
      p.images[0] || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      p.images[1] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      p.images[2] || 'https://images.unsplash.com/photo-1607349913338-fca6f742960f?w=600&auto=format&fit=crop&q=80',
      p.images[3] || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    ];
    setFormData({
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
      barcode: p.barcode,
      hsn: p.hsn || '1006',
      weightSize: p.weightSize,
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      discount: p.discount || Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100),
      orderEligibility: p.orderEligibility,
      status: p.status,
      images: imagesArray,
    });
    setIsModalOpen(true);
  };

  const handlePriceChange = (mrp: number, sellingPrice: number) => {
    const disc = mrp > 0 && mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
    setFormData((prev) => ({
      ...prev,
      mrp,
      sellingPrice,
      discount: disc,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate 4 images
    const emptyImages = formData.images.some((img) => !img || !img.trim());
    if (emptyImages) {
      alert('All 4 product images are mandatory! Please provide Front, Back, Side, and Packaging details.');
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          ...formData,
          unit: formData.weightSize,
        });
        alert('Product SKU updated successfully with 4 product images!');
      } else {
        await api.createProduct({
          ...formData,
          unit: formData.weightSize,
        });
        alert('Product SKU created successfully with 4 mandatory images!');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    const newStatus: Product['status'] = p.status === 'PUBLISHED' ? 'INACTIVE' : 'PUBLISHED';
    try {
      await api.updateProduct(p.id, { status: newStatus });
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      p.category.toLowerCase().includes(q);

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>Master Product Catalog</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKU metadata, barcodes, 4 mandatory images, dual-order eligibility, and pricing rules.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product SKU</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, brand, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">All Publication Statuses</option>
              <option value="PUBLISHED">Published Only</option>
              <option value="INACTIVE">Inactive / Unpublished</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Product &amp; 4 Images</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category &amp; Brand</th>
                <th className="py-3 px-3">Weight / Unit</th>
                <th className="py-3 px-3 text-right">Pricing (MRP / Sell)</th>
                <th className="py-3 px-3">Eligibility</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No products matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    {/* Name & 4-Image Mini Slider / Thumbs */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setInspectProduct(p)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 relative group cursor-pointer"
                          title="Click to view all 4 images"
                        >
                          <ImageWithFallback src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold">
                            <Eye className="w-4 h-4" />
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white text-[8px] px-1 rounded font-bold">
                            4 imgs
                          </span>
                        </div>
                        <div>
                          <div
                            onClick={() => setInspectProduct(p)}
                            className="font-bold text-slate-900 line-clamp-1 hover:text-emerald-700 cursor-pointer"
                          >
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                            <span>ID: {p.id}</span>
                            <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">
                              4-Angle Gallery ✓
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Barcode className="w-3.5 h-3.5 text-slate-500" />
                        {p.barcode}
                      </span>
                    </td>

                    {/* Category & Brand */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{p.category}</div>
                      <div className="text-[11px] text-slate-500">{p.brand}</div>
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-3 font-medium text-slate-700">{p.weightSize}</td>

                    {/* Pricing */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-slate-900 text-sm">₹{p.sellingPrice}</div>
                      <div className="text-[11px] text-slate-400 line-through">MRP: ₹{p.mrp}</div>
                      {p.discount > 0 && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          {p.discount}% OFF
                        </span>
                      )}
                    </td>

                    {/* Order Eligibility */}
                    <td className="py-3 px-3">
                      {p.orderEligibility === 'BOTH' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Both (Pantry + Quick)
                        </span>
                      ) : p.orderEligibility === 'PANTRY_ONLY' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <CreditCard className="w-3 h-3" /> Pantry Only
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <ShoppingBag className="w-3 h-3" /> Quick COD Only
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectProduct(p)}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Inspect 4 Images & Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit SKU & 4 Images"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`p-1.5 rounded transition cursor-pointer ${
                            p.status === 'PUBLISHED'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={p.status === 'PUBLISHED' ? 'Deactivate Product' : 'Activate Product'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Edit / Create Modal */}
      {isModalOpen && (
        <AppWindowModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? `Edit Master SKU: ${editingProduct.name}` : 'Create New Product Master SKU'}
          subtitle="Manage SKU details, pricing, pantry/quick eligibility, and 4 mandatory packaging angles."
          icon={<Package className="w-5 h-5 text-emerald-600" />}
          size="xl"
        >
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fortune Sunlite Sunflower Refined Oil"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fortune"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oils & Ghee"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode (EAN-13 / UPC) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pack Size / Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 L or 500g"
                    value={formData.weightSize}
                    onChange={(e) => setFormData({ ...formData, weightSize: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    MRP (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.mrp}
                    onChange={(e) => handlePriceChange(Number(e.target.value), formData.sellingPrice)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.sellingPrice}
                    onChange={(e) => handlePriceChange(formData.mrp, Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-emerald-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Track Eligibility
                  </label>
                  <select
                    value={formData.orderEligibility}
                    onChange={(e) => setFormData({ ...formData, orderEligibility: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="BOTH">Both (Pantry Credit + Quick COD)</option>
                    <option value="PANTRY_ONLY">Pantry Credit Only</option>
                    <option value="QUICK_ONLY">Quick COD Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Publication Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="PUBLISHED">PUBLISHED (Active on app)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 4 Mandatory Images Section */}
              <div className="pt-2">
                <ProductFourImageUploader
                  images={formData.images}
                  onChange={(imgs) => setFormData({ ...formData, images: imgs })}
                  required={true}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingProduct ? 'Save SKU Changes' : 'Create Product SKU'}
                </button>
              </div>
            </form>
          </div>
        </AppWindowModal>
      )}

      {/* Inspect 4-Image Details Modal */}
      {inspectProduct && (
        <ProductDetailModal
          product={inspectProduct}
          isOpen={!!inspectProduct}
          onClose={() => setInspectProduct(null)}
          userRole="ADMIN"
        />
      )}
    </div>
  );
};
