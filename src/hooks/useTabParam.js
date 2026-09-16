import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Tab state that stays in sync with the `?tab=` query parameter, so a tab is
 * deep-linkable and the portal sidebar can navigate straight to it.
 *
 * The first entry of `validTabs` is the default tab; an unknown or missing
 * `?tab=` value falls back to it, and selecting the default clears the
 * parameter again (keeping URLs clean).
 *
 * Used by StudentDashboard and TeacherDashboard — previously both carried an
 * identical copy of this logic.
 *
 * @param {string[]} validTabs Non-empty list of tab ids, default tab first.
 * @returns {[string, (id: string) => void]} [activeTab, changeTab]
 */
export function useTabParam(validTabs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaultTab] = validTabs;
  const requested = searchParams.get('tab');

  const [tab, setTab] = useState(validTabs.includes(requested) ? requested : defaultTab);

  const changeTab = (id) => {
    setTab(id);
    const params = new URLSearchParams(searchParams);
    if (id === defaultTab) params.delete('tab');
    else params.set('tab', id);
    setSearchParams(params, { replace: true });
  };

  return [tab, changeTab];
}

export default useTabParam;