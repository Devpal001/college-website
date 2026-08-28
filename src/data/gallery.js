// Gallery data structure for MBSCET
// Images should be stored in src/assets/gallery/ folder
// Replace placeholder URLs with your actual image paths

export const galleryCategories = [
  { id: 'all', name: 'All Photos' },
  { id: 'campus', name: 'Campus' },
  { id: 'events', name: 'Events' },
  { id: 'labs', name: 'Laboratories' },
  { id: 'sports', name: 'Sports' },
  { id: 'cultural', name: 'Cultural' },
];

export const galleryImages = [
  // Campus Images
  {
    id: 1,
    title: 'Main Building',
    category: 'campus',
    src: '/gallery/campus-main-building.jpg', // Replace with actual path
    description: 'The iconic main building of MBSCET campus',
    date: '2024-01-15',
  },
  {
    id: 2,
    title: 'Library',
    category: 'campus',
    src: '/gallery/campus-library.jpg',
    description: 'Modern library with extensive collection',
    date: '2024-02-20',
  },
  {
    id: 3,
    title: 'Auditorium',
    category: 'campus',
    src: '/gallery/campus-auditorium.jpg',
    description: 'State-of-the-art auditorium for events',
    date: '2024-03-10',
  },

  // Events Images
  {
    id: 4,
    title: 'Tech Fest 2024',
    category: 'events',
    src: '/gallery/events-techfest.jpg',
    description: 'Annual technical festival celebration',
    date: '2024-04-05',
  },
  {
    id: 5,
    title: 'Graduation Ceremony',
    category: 'events',
    src: '/gallery/events-graduation.jpg',
    description: 'Class of 2024 graduation ceremony',
    date: '2024-06-15',
  },
  {
    id: 6,
    title: 'Guest Lecture',
    category: 'events',
    src: '/gallery/events-lecture.jpg',
    description: 'Industry expert guest lecture session',
    date: '2024-07-22',
  },

  // Laboratories Images
  {
    id: 7,
    title: 'Computer Lab',
    category: 'labs',
    src: '/gallery/labs-computer.jpg',
    description: 'Advanced computer laboratory',
    date: '2024-01-20',
  },
  {
    id: 8,
    title: 'Electronics Lab',
    category: 'labs',
    src: '/gallery/labs-electronics.jpg',
    description: 'Electronics and communication lab',
    date: '2024-02-15',
  },
  {
    id: 9,
    title: 'Mechanical Workshop',
    category: 'labs',
    src: '/gallery/labs-mechanical.jpg',
    description: 'Mechanical engineering workshop',
    date: '2024-03-25',
  },

  // Sports Images
  {
    id: 10,
    title: 'Crournament Finals',
    category: 'sports',
    src: '/gallery/sports-cricket.jpg',
    description: 'Inter-college cricket tournament finals',
    date: '2024-05-10',
  },
  {
    id: 11,
    title: 'Football Match',
    category: 'sports',
    src: '/gallery/sports-football.jpg',
    description: 'Annual football championship',
    date: '2024-09-18',
  },
  {
    id: 12,
    title: 'Basketball Court',
    category: 'sports',
    src: '/gallery/sports-basketball.jpg',
    description: 'Basketball practice session',
    date: '2024-10-05',
  },

  // Cultural Images
  {
    id: 13,
    title: 'Annual Day',
    category: 'cultural',
    src: '/gallery/cultural-annual-day.jpg',
    description: 'Annual cultural day celebration',
    date: '2024-12-20',
  },
  {
    id: 14,
    title: 'Dance Performance',
    category: 'cultural',
    src: '/gallery/cultural-dance.jpg',
    description: 'Traditional dance performance',
    date: '2024-11-15',
  },
  {
    id: 15,
    title: 'Music Concert',
    category: 'cultural',
    src: '/gallery/cultural-music.jpg',
    description: 'Student music concert',
    date: '2024-10-30',
  },
];

// Helper function to get images by category
export const getImagesByCategory = (category) => {
  if (category === 'all') return galleryImages;
  return galleryImages.filter(img => img.category === category);
};

// Helper function to get category name
export const getCategoryName = (categoryId) => {
  const category = galleryCategories.find(cat => cat.id === categoryId);
  return category ? category.name : 'Unknown';
};