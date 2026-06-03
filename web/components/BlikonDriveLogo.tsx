export function BlikonDriveLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fondo cuadrado redondeado */}
      <rect width="32" height="32" rx="8" fill="#1a73e8" />

      {/* Nube */}
      <path
        d="M22.5 14.2A4.5 4.5 0 0 0 14.1 12a3 3 0 0 0-3.6 2.9A3.5 3.5 0 0 0 11 22h11a3 3 0 0 0 .5-5.8z"
        fill="white"
        opacity="0.9"
      />

      {/* Flecha hacia arriba — upload */}
      <path
        d="M16 18v5M13.5 20.5 16 18l2.5 2.5"
        stroke="#1a73e8"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
