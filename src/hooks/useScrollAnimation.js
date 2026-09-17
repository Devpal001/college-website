import { useEffect, useRef, useState } from 'react';

export const useScrollAnimation = (options = {}) => {
  const ref = useRef(null);
  // Under prefers-reduced-motion the element starts visible and no observer
  // is created — content is never hidden behind disabled animation.
  const [isVisible, setIsVisible] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );

  useEffect(() => {
    if (isVisible) return; // reduced-motion path: nothing to observe
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (options.once) {
            observer.unobserve(entry.target);
          }
        } else if (!options.once) {
          setIsVisible(false);
        }
      },
      {
        threshold: options.threshold || 0.1,
        // Fire when the element is ~10% into the viewport rather than only
        // after it is fully inside — reveals begin as content arrives, so
        // entrances feel natural instead of late/sudden.
        rootMargin: options.rootMargin || '0px 0px -10% 0px',
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options.threshold, options.rootMargin, options.once, isVisible]);

  return [ref, isVisible];
};