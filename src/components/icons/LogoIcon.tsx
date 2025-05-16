import type React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Simple representation of a domino tile */}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="currentColor" stroke="none"/>
    <line x1="3" y1="12" x2="21" y2="12" stroke="hsl(var(--primary-foreground))" opacity="0.5" />
    <circle cx="8" cy="8" r="1.5" fill="hsl(var(--primary-foreground))" opacity="0.7" />
    <circle cx="16" cy="16" r="1.5" fill="hsl(var(--primary-foreground))" opacity="0.7" />
  </svg>
);
