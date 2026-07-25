import { Building2, Component, type LucideIcon } from 'lucide-react';

import {
  HtBreakerIcon,
  InverterIcon,
  PesIcon,
  PcssIcon,
  SmbIcon,
  TableStingIcon,
  TransformerIcon,
  UpsIcon,
  type EnergyDeviceIconComponent,
} from './energyDeviceIcons';

export type EnergyCategory =
  | 'GENERATION'
  | 'STORAGE'
  | 'CONVERSION'
  | 'CONTROL'
  | 'POWER'
  | 'COMMUNICATION'
  | 'OTHER';

export type EnergyCategoryMeta = {
  abbr: string;
  label: string;
  badgeColor: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
};

export const ENERGY_CATEGORY_META: Record<EnergyCategory, EnergyCategoryMeta> = {
  GENERATION: {
    abbr: 'G',
    label: 'Generation',
    badgeColor: 'bg-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-950/50',
    iconColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  STORAGE: {
    abbr: 'S',
    label: 'Storage',
    badgeColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  CONVERSION: {
    abbr: 'C',
    label: 'Conversion',
    badgeColor: 'bg-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-950/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  CONTROL: {
    abbr: 'CP',
    label: 'Control Systems',
    badgeColor: 'bg-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-950/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  POWER: {
    abbr: 'P',
    label: 'Power Systems',
    badgeColor: 'bg-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-950/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  COMMUNICATION: {
    abbr: 'CM',
    label: 'Communication',
    badgeColor: 'bg-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-900/50',
    iconColor: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  OTHER: {
    abbr: 'O',
    label: 'Other Assets',
    badgeColor: 'bg-gray-500',
    iconBg: 'bg-gray-100 dark:bg-gray-900/50',
    iconColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
};

export const ENERGY_CATEGORY_ORDER: EnergyCategory[] = [
  'GENERATION',
  'STORAGE',
  'CONVERSION',
  'POWER',
  'CONTROL',
  'COMMUNICATION',
  'OTHER',
];

export type EnergyNodeIcon = EnergyDeviceIconComponent | LucideIcon;

export type EnergyNodeConfig = {
  icon: EnergyNodeIcon;
  category: EnergyCategory;
} & EnergyCategoryMeta;

function normalizeNodeKey(deviceType: string): string {
  return deviceType.toLowerCase().replace(/_/g, ' ').replace(/\//g, ' ').trim();
}

const resolveCategory = (deviceType: string): EnergyCategory => {
  const type = normalizeNodeKey(deviceType);

  if (type === 'site' || type.includes('location')) return 'CONTROL';
  if (type.includes('table') || type.includes('sting') || type.includes('inverter')) {
    return 'CONVERSION';
  }
  if (type.includes('pcss')) return 'CONTROL';
  if (type.includes('pes') || type.includes('pess') || type.includes('transformer')) return 'POWER';
  if (type.includes('breaker') || type.includes('ht breaker')) return 'POWER';
  if (type.includes('smb')) return 'COMMUNICATION';
  if (type.includes('ups')) return 'OTHER';

  return 'OTHER';
};

const ENERGY_DEVICE_ICON_MAP: Record<string, EnergyDeviceIconComponent> = {
  TableStingIcon,
  tablestingicon: TableStingIcon,
  InverterIcon,
  invertericon: InverterIcon,
  SmbIcon,
  smbicon: SmbIcon,
  UpsIcon,
  upsicon: UpsIcon,
  PcssIcon,
  pcssicon: PcssIcon,
  PesIcon,
  pesicon: PesIcon,
  TransformerIcon,
  transformericon: TransformerIcon,
  HtBreakerIcon,
  htbreakericon: HtBreakerIcon,
};

export function resolveIconByName(deviceIcon: string): EnergyDeviceIconComponent | null {
  const trimmed = deviceIcon.trim();
  if (!trimmed) return null;

  const direct = ENERGY_DEVICE_ICON_MAP[trimmed] ?? ENERGY_DEVICE_ICON_MAP[trimmed.toLowerCase()];
  if (direct) return direct;

  const withSuffix = trimmed.endsWith('Icon') ? trimmed : `${trimmed}Icon`;
  return ENERGY_DEVICE_ICON_MAP[withSuffix] ?? ENERGY_DEVICE_ICON_MAP[withSuffix.toLowerCase()] ?? null;
}

const resolveIcon = (deviceType: string): EnergyNodeIcon => {
  const type = normalizeNodeKey(deviceType);
  const compact = type.replace(/\s+/g, '');

  if (type === 'site' || type.includes('location')) return Building2;
  if (compact === 'tablesting' || type.includes('table') || type.includes('sting')) return TableStingIcon;
  if (compact === 'smb' || type.includes('smb')) return SmbIcon;
  if (compact === 'inverter' || type.includes('inverter')) return InverterIcon;
  if (compact === 'ups' || type.includes('ups')) return UpsIcon;
  if (compact === 'pcss' || type.includes('pcss')) return PcssIcon;
  if (compact === 'pes' || compact === 'pess' || type.includes('pes')) return PesIcon;
  if (compact === 'transformer' || type.includes('transformer')) return TransformerIcon;
  if (compact === 'htbreaker' || type.includes('ht breaker') || type.includes('breaker')) return HtBreakerIcon;

  return Component;
};

export function getEnergyNodeConfig(deviceType: string, deviceIcon?: string): EnergyNodeConfig {
  const category = resolveCategory(deviceType);
  const meta = ENERGY_CATEGORY_META[category];
  const iconFromApi = deviceIcon ? resolveIconByName(deviceIcon) : null;

  return {
    icon: iconFromApi ?? resolveIcon(deviceType),
    category,
    ...meta,
  };
}

export function isIllustratedDeviceType(deviceType: string, deviceIcon?: string): boolean {
  if (deviceIcon && resolveIconByName(deviceIcon)) return true;

  const type = normalizeNodeKey(deviceType);
  if (type === 'site' || type.includes('location')) return false;
  return (
    type.includes('table') ||
    type.includes('sting') ||
    type.includes('smb') ||
    type.includes('inverter') ||
    type.includes('ups') ||
    type.includes('pcss') ||
    type.includes('pes') ||
    type.includes('pess') ||
    type.includes('transformer') ||
    type.includes('breaker')
  );
}

/** Icons for inventory count keys (ups, transformer, smbCount, etc.). */
export function getDeviceCountConfig(countKey: string): EnergyNodeConfig {
  const key = normalizeNodeKey(countKey);

  if (key.includes('smb')) return getEnergyNodeConfig('SMB');
  if (key.includes('ups')) return getEnergyNodeConfig('UPS');
  if (key.includes('inverter')) return getEnergyNodeConfig('Inverter');
  if (key.includes('pcss')) return getEnergyNodeConfig('PCSS');
  if (key.includes('pes')) return getEnergyNodeConfig('PES');
  if (key.includes('transformer')) return getEnergyNodeConfig('Transformer');
  if (key.includes('breaker')) return getEnergyNodeConfig('HT breaker');

  return getEnergyNodeConfig('other');
}
