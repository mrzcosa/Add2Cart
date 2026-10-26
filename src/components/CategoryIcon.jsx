const iconShapes = {
  Electronics: <><rect x="6" y="2.5" width="12" height="19" rx="2.4" /><path d="M10 5h4M11 18h2" /></>,
  Fashion: <path d="m16 3 5 2v5l-3-1v12H6V9L3 10V5l5-2 4 3 4-3ZM8 3l1 3m7-3-1 3" />,
  'Home & Garden': <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
  Toys: <><path d="M7 7h10a4 4 0 0 1 3.9 3.1l1 4.1a2 2 0 0 1-3.4 1.9l-2.2-2H7.7l-2.2 2a2 2 0 0 1-3.4-1.9l1-4.1A4 4 0 0 1 7 7Z" /><path d="M7 10v4m-2-2h4m5.5-1h.01M17 13h.01" /></>,
  Sports: <><path d="M2 10v4m4-7v10m12-10v10m4-7v4M6 12h12" /></>,
  Computers: <><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M2 21h20l-2-4H4l-2 4Z" /></>,
  Accessories: <><path d="M8 2.5h8l1 4.5M7 17l1 4.5h8L17 17" /><rect x="4" y="7" width="16" height="10" rx="3" /><path d="M12 9.5V12l2 1" /></>,
}

export default function CategoryIcon({ category }) {
  return <svg className="category-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{iconShapes[category] || <path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 20l-2.6-6.5L3 11l6.4-2.5L12 2Z" />}</svg>
}
