import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getPortraitAsset, portraitAssetKey } from '../../runtime/characters/portraitAssets.js';

const loadedImages = new Map();
function loadPortrait(src) {
  if (loadedImages.has(src)) return loadedImages.get(src);
  const pending = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => { loadedImages.delete(src); resolve(false); };
    image.src = src;
  });
  loadedImages.set(src, pending);
  return pending;
}

export default function Portrait({ person, size = 'normal', eager = false }) {
  const holder = useRef(null);
  const [visible, setVisible] = useState(eager || typeof IntersectionObserver === 'undefined');
  const [loaded, setLoaded] = useState(null);
  const asset = useMemo(() => getPortraitAsset(person), [person]);
  const original = useMemo(() => getPortraitAsset(person, { preferOriginal: true }), [person]);
  const key = portraitAssetKey(asset);
  const identity = asset?.identityId || person?.id || '';
  useEffect(() => {
    if (visible || !holder.current) return undefined;
    const observer = new IntersectionObserver((changes) => {
      if (changes.some((change) => change.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '180px' });
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible || !asset) return undefined;
    let cancelled = false;
    loadPortrait(asset.src).then(async (success) => {
      if (cancelled) return;
      if (success) { setLoaded({ key, asset, failed: false }); return; }
      const fallbackReady = original && asset.src !== original.src && await loadPortrait(original.src);
      if (!cancelled) setLoaded((previous) => ({ key, asset: fallbackReady ? original : previous?.asset?.identityId === identity ? previous.asset : null, failed: true }));
    });
    return () => { cancelled = true; };
  }, [asset, original, key, identity, visible]);
  const shown = loaded?.asset?.identityId === identity ? loaded.asset : null;
  const pending = Boolean(asset && visible && loaded?.key !== key);
  const missing = Boolean(asset?.missingVariant || (loaded?.key === key && loaded.failed));
  const deceased = person?.portraitState?.lifeStatus === 'deceased' || person?.alive === false || Boolean(person?.diedAt);
  const label = asset?.label || `${person?.name || 'Okänd person'} · porträtt saknas`;
  const initials = String(person?.name || '?').split(/\s+/).slice(0, 2).map((word) => word[0]).join('');
  return <div ref={holder} className={`char-portrait char-portrait--${size}${deceased ? ' char-portrait--deceased' : ''}`}
    role="img" aria-label={`${label}${missing ? ' · tillfällig bild' : ''}`} aria-busy={pending}
    title={`${label}${pending ? ' · porträttet uppdateras' : missing ? ' · bildvarianten är inte tillgänglig ännu' : ''}`}
    data-family={person?.familyId || ''} data-portrait-identity={identity} data-portrait-state={person?.portraitState?.visualState || 'healthy'}
    data-portrait-kind={shown?.kind || 'placeholder'} data-portrait-loading={pending ? 'true' : undefined} data-portrait-fallback={missing ? 'true' : undefined}>
    <svg className="char-portrait-placeholder" viewBox="0 0 100 100" focusable="false" aria-hidden="true"><path d="M19 89c2-21 13-31 31-31s29 10 31 31" /><circle cx="50" cy="36" r="19" /><path className="char-portrait-laurel" d="M20 61C7 38 14 16 32 8M80 61c13-23 6-45-12-53M17 47l-8-7m8-5-6-9m9-3-3-10m66 34 8-7m-8-5 6-9m-9-3 3-10" /></svg>
    {shown?.kind === 'atlas' && <svg className="char-portrait-atlas" viewBox={`${shown.rect.x} ${shown.rect.y} ${shown.rect.width} ${shown.rect.height}`} preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true"><image href={shown.src} width={shown.width} height={shown.height} /></svg>}
    {shown?.kind === 'image' && <img key={shown.src} src={shown.src} alt="" aria-hidden="true" />}
    {!shown && <span aria-hidden="true">{initials}</span>}
    {deceased && <i className="char-portrait-mourning" aria-hidden="true" />}
  </div>;
}
