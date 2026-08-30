import { useState, useEffect } from 'react';
import { X, ZoomIn, Filter } from 'lucide-react';
import { galleryCategories, getImagesByCategory } from '../data/gallery';

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const filteredImages = getImagesByCategory(selectedCategory);

  // Simulate loading
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-bg-soft">
      {/* Header */}
      <section className="container-lg py-32 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-text-main mb-4">Photo Gallery</h1>
        <p className="text-text-muted text-lg max-w-2xl mx-auto">
          Explore life at MBSCET through our collection of campus events, facilities, and celebrations.
        </p>
      </section>

      {/* Category Filter */}
      <section className="container-lg mb-8">
        <div className="flex flex-wrap justify-center gap-3">
          {galleryCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-primary text-white shadow-soft'
                  : 'bg-surface text-text-main hover:bg-bg-soft border border-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="container-lg pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-square bg-surface rounded-soft-lg animate-pulse" />
            ))}
          </div>
        ) : filteredImages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-soft-lg cursor-pointer"
                onClick={() => handleImageClick(image)}
              >
                {/* Placeholder for actual image */}
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="text-text-muted text-sm font-medium">
                    {image.title}
                  </span>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <ZoomIn className="text-white" size={32} />
                </div>

                {/* Image info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <h3 className="text-white font-medium text-sm">{image.title}</h3>
                  <p className="text-white/70 text-xs mt-1">{image.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-text-muted">No images found in this category.</p>
          </div>
        )}
      </section>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
              aria-label="Close modal"
            >
              <X size={32} />
            </button>

            {/* Image container */}
            <div className="bg-surface rounded-soft-lg overflow-hidden">
              {/* Placeholder for actual image */}
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-text-muted font-medium">
                  {selectedImage.title}
                </span>
              </div>

              {/* Image details */}
              <div className="p-6">
                <h2 className="text-2xl font-bold text-text-main mb-2">
                  {selectedImage.title}
                </h2>
                <p className="text-text-muted mb-4">{selectedImage.description}</p>
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-2">
                    <Filter size={16} />
                    {galleryCategories.find(cat => cat.id === selectedImage.category)?.name}
                  </span>
                  <span>•</span>
                  <span>{new Date(selectedImage.date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}