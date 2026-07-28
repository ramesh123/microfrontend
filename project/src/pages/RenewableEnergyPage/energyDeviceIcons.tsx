import type { SVGProps } from 'react';

export type EnergyDeviceIconProps = SVGProps<SVGSVGElement>;

const C = {
  blue: '#6EC4F8',
  blueDeep: '#4FAEE8',
  blueDark: '#1E5098',
  highlight: '#A8DDFB',
  yellow: '#FFC830',
  orange: '#FF9800',
  green: '#66BB6A',
  gray: '#90A4AE',
  grayDark: '#546E7A',
  grayLight: '#CFD8DC',
  white: '#FFFFFF',
  slate: '#455A64',
  purple: '#7E57C2',
  amber: '#FFB300',
};

function IconBase({ children, ...props }: EnergyDeviceIconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {children}
    </svg>
  );
}

/** Wall-mount PV inverter — reference hardware style. */
export function InverterIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="1.5" width="9" height="5.5" rx="1.8" fill={C.gray} />
      <circle cx="13.5" cy="4.2" r="1.3" fill={C.grayLight} />
      <rect x="30" y="1.5" width="9" height="5.5" rx="1.8" fill={C.gray} />
      <circle cx="34.5" cy="4.2" r="1.3" fill={C.grayLight} />
      <rect x="5.5" y="7" width="37" height="34" rx="4.5" fill={C.blue} />
      <rect x="7" y="9" width="3" height="30" rx="1.5" fill={C.highlight} />
      <rect x="35.5" y="12" width="3.5" height="9" rx="1.5" fill={C.grayLight} />
      <rect x="35.5" y="26" width="3.5" height="9" rx="1.5" fill={C.grayLight} />
      {[13, 18.5, 24, 29.5].map((y) => (
        <g key={y}>
          <rect x="39.5" y={y} width="7" height="3.2" rx="1" fill={C.slate} />
          <rect x="43.5" y={y + 0.6} width="3.5" height="2" rx="0.6" fill={C.grayLight} />
        </g>
      ))}
      <rect x="12.5" y="13.5" width="19" height="19" rx="3.5" fill={C.blueDark} />
      <path d="M22 18.5 19.5 26h2.2l-1.2 6.5 6.8-9.5H24.8l2.2-4.5H22Z" fill={C.yellow} />
      <rect x="9" y="41" width="9" height="5.5" rx="1.8" fill={C.gray} />
      <rect x="30" y="41" width="9" height="5.5" rx="1.8" fill={C.gray} />
    </IconBase>
  );
}

/** Solar table / string — tilted panel array on a rack. */
export function TableStingIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="34" width="40" height="3" rx="1" fill={C.grayDark} />
      <rect x="8" y="30" width="2.5" height="6" rx="0.8" fill={C.gray} />
      <rect x="37" y="30" width="2.5" height="6" rx="0.8" fill={C.gray} />
      <g transform="rotate(-8 24 22)">
        <rect x="7" y="14" width="10" height="14" rx="1.2" fill={C.orange} stroke={C.amber} strokeWidth="0.8" />
        <rect x="19" y="12" width="10" height="14" rx="1.2" fill={C.orange} stroke={C.amber} strokeWidth="0.8" />
        <rect x="31" y="14" width="10" height="14" rx="1.2" fill={C.orange} stroke={C.amber} strokeWidth="0.8" />
        <path d="M9 17h6M9 20h6M21 15h6M21 18h6M33 17h6M33 20h6" stroke={C.white} strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
      </g>
      <rect x="20" y="32" width="8" height="2.5" rx="0.6" fill={C.blueDark} />
      <circle cx="24" cy="33.2" r="0.8" fill={C.yellow} />
    </IconBase>
  );
}

/** SMB — compact comm module with antenna. */
export function SmbIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="11" y="16" width="26" height="18" rx="2.5" fill={C.slate} />
      <rect x="13" y="18" width="22" height="10" rx="1.5" fill={C.grayDark} />
      <path d="M15 23h4M21 23h4M27 23h4" stroke={C.green} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="13" y="30" width="4" height="2" rx="0.5" fill={C.grayLight} />
      <rect x="18.5" y="30" width="4" height="2" rx="0.5" fill={C.grayLight} />
      <rect x="24" y="30" width="4" height="2" rx="0.5" fill={C.grayLight} />
      <rect x="29.5" y="30" width="4" height="2" rx="0.5" fill={C.yellow} />
      <path d="M24 8v7" stroke={C.gray} strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="7" r="2.2" fill={C.green} />
      <path d="M24 11c2.5 0 4.5 1.6 4.5 3.6" stroke={C.yellow} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24 9.5c3.8 0 6.8 2.4 6.8 5.4" stroke={C.yellow} strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </IconBase>
  );
}

/** UPS — tall tower with battery segments. */
export function UpsIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="15" y="6" width="18" height="36" rx="2.5" fill={C.grayDark} />
      <rect x="17" y="8" width="14" height="5" rx="1" fill={C.blueDark} />
      <path d="M19 10.5h10" stroke={C.yellow} strokeWidth="1" strokeLinecap="round" />
      <rect x="18" y="15" width="3" height="18" rx="0.8" fill={C.green} />
      <rect x="22.5" y="15" width="3" height="18" rx="0.8" fill={C.green} opacity="0.7" />
      <rect x="27" y="15" width="3" height="18" rx="0.8" fill={C.green} opacity="0.45" />
      <rect x="17" y="35" width="14" height="4.5" rx="1" fill={C.slate} />
      <path d="M20 37.2h8" stroke={C.yellow} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="24" cy="11.5" r="1" fill={C.green} />
    </IconBase>
  );
}

/** PCSS — wide control cabinet with dual meters. */
export function PcssIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="10" width="40" height="28" rx="3" fill={C.blue} />
      <rect x="6" y="12" width="36" height="24" rx="2" fill={C.blueDeep} opacity="0.35" />
      <rect x="7" y="13" width="4" height="22" rx="1" fill={C.highlight} />
      <circle cx="16" cy="20" r="4" fill={C.blueDark} stroke={C.white} strokeWidth="0.8" />
      <path d="M16 17.5v2.5l1.8 1.8" stroke={C.yellow} strokeWidth="1" strokeLinecap="round" />
      <circle cx="32" cy="20" r="4" fill={C.blueDark} stroke={C.white} strokeWidth="0.8" />
      <path d="M30.5 21.2c.9-.9 2.2-1 3-.1" stroke={C.yellow} strokeWidth="1" strokeLinecap="round" />
      <rect x="10" y="28" width="28" height="6" rx="1" fill={C.blueDark} />
      <path d="M13 31h3M19 31h3M25 31h3M31 31h3" stroke={C.white} strokeWidth="1" strokeLinecap="round" />
      <rect x="4" y="38" width="40" height="2.5" rx="0.8" fill={C.gray} />
    </IconBase>
  );
}

/** PES — pad-mount transformer with bushings. */
export function PesIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="30" width="32" height="4" rx="1" fill={C.gray} />
      <rect x="10" y="14" width="28" height="18" rx="2.5" fill={C.amber} stroke={C.orange} strokeWidth="0.8" />
      <rect x="12" y="16" width="24" height="14" rx="1.5" fill={C.orange} opacity="0.55" />
      <path
        d="M16 20c0-2 1.5-3.5 3.2-3.5h9.6C30.5 16.5 32 18 32 20v7H16v-7z"
        stroke={C.blueDark}
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M18 24h12" stroke={C.white} strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
      <rect x="14" y="8" width="3" height="8" rx="1.2" fill={C.grayDark} />
      <rect x="22.5" y="6" width="3" height="10" rx="1.2" fill={C.grayDark} />
      <rect x="31" y="8" width="3" height="8" rx="1.2" fill={C.grayDark} />
      <circle cx="15.5" cy="7.5" r="1.5" fill={C.yellow} />
      <circle cx="24" cy="5.5" r="1.5" fill={C.yellow} />
      <circle cx="32.5" cy="7.5" r="1.5" fill={C.yellow} />
    </IconBase>
  );
}

/** Distribution transformer — core with dual coils and bushings. */
export function TransformerIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="10" y="34" width="28" height="3" rx="1" fill={C.grayDark} />
      <rect x="12" y="12" width="24" height="22" rx="2.5" fill={C.amber} stroke={C.orange} strokeWidth="0.8" />
      <rect x="14" y="14" width="20" height="18" rx="1.5" fill={C.orange} opacity="0.35" />
      <rect x="15" y="16" width="7" height="14" rx="1.2" fill={C.blueDark} />
      <rect x="26" y="16" width="7" height="14" rx="1.2" fill={C.blueDark} />
      <path d="M18.5 18v10M21.5 18v10M29.5 18v10M32.5 18v10" stroke={C.yellow} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M16 23h5M27 23h5" stroke={C.white} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      <rect x="17" y="7" width="2.5" height="7" rx="1" fill={C.grayDark} />
      <rect x="28.5" y="7" width="2.5" height="7" rx="1" fill={C.grayDark} />
      <circle cx="18.2" cy="6.5" r="1.4" fill={C.yellow} />
      <circle cx="29.7" cy="6.5" r="1.4" fill={C.yellow} />
      <path d="M21 30h6" stroke={C.slate} strokeWidth="1.2" strokeLinecap="round" />
    </IconBase>
  );
}

/** HT breaker — high-tension switchgear with insulators. */
export function HtBreakerIcon(props: EnergyDeviceIconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="32" width="30" height="4" rx="1" fill={C.grayDark} />
      <rect x="11" y="10" width="26" height="24" rx="2.5" fill={C.slate} />
      <rect x="13" y="12" width="22" height="20" rx="1.5" fill={C.grayDark} />
      <rect x="15" y="14" width="18" height="8" rx="1" fill={C.blueDark} />
      <circle cx="24" cy="18" r="2.2" fill="#E53935" />
      <path d="M24 14.5v7" stroke={C.white} strokeWidth="1" strokeLinecap="round" />
      <rect x="20" y="24" width="8" height="6" rx="1" fill={C.gray} />
      <path d="M24 24v-2" stroke={C.yellow} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="17" y="5" width="2.5" height="7" rx="1" fill={C.grayLight} />
      <rect x="28.5" y="5" width="2.5" height="7" rx="1" fill={C.grayLight} />
      <circle cx="18.2" cy="4.5" r="1.3" fill={C.white} />
      <circle cx="29.7" cy="4.5" r="1.3" fill={C.white} />
      <path d="M16 28h16" stroke={C.highlight} strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
    </IconBase>
  );
}

export type EnergyDeviceIconComponent = typeof TableStingIcon;
