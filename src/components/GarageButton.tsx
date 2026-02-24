'use client';

import { useEffect, useState } from 'react';

type GarageCar = { brand: string; model?: string };

export function GarageButton() {
  const [count, setCount] = useState(() => {
    try {
      const stored = localStorage.getItem('garageCars');
      if (stored) {
        const parsed = JSON.parse(stored) as GarageCar[];
        return parsed.length;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  return (
    <button
      type="button"
      className="link garage-btn"
      onClick={() => {
        window.dispatchEvent(new Event('garage-open'));
      }}
      title="Гараж (обрані авто)"
    >
      <i className="ri-car-line"></i> Гараж
      {count > 0 && <span className="garage-badge">{count}</span>}
    </button>
  );
}
