import {
  AlignLeft,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Columns3,
  FileUp,
  Files,
  Globe,
  Hash,
  ImageUp,
  LayoutList,
  ListChecks,
  Lock,
  Map,
  MapPin,
  MapPinned,
  Minus,
  PenLine,
  Send,
  Table2,
  ToggleLeft,
  TrendingUp,
  Type,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormBuilderFieldType } from '../../types';

interface FieldTypeIconProps {
  type: FormBuilderFieldType;
  className?: string;
}

export function FieldTypeIcon({ type, className }: FieldTypeIconProps) {
  const iconClass = cn('h-4 w-4 shrink-0 text-foreground', className);

  switch (type) {
    case 'section_divider':
      return <Minus className={iconClass} aria-hidden />;
    case 'text':
      return <Type className={iconClass} aria-hidden />;
    case 'number':
      return <Hash className={iconClass} aria-hidden />;
    case 'password':
      return <Lock className={iconClass} aria-hidden />;
    case 'textarea':
      return <AlignLeft className={iconClass} aria-hidden />;
    case 'date':
      return <Calendar className={iconClass} aria-hidden />;
    case 'select':
      return <ChevronDown className={iconClass} aria-hidden />;
    case 'multi_select':
      return <ListChecks className={iconClass} aria-hidden />;
    case 'radio':
      return <CircleDot className={iconClass} aria-hidden />;
    case 'checkbox':
      return <CheckSquare className={iconClass} aria-hidden />;
    case 'checkbox_group':
      return <LayoutList className={iconClass} aria-hidden />;
    case 'switch':
      return <ToggleLeft className={iconClass} aria-hidden />;
    case 'segmented':
      return <Columns3 className={iconClass} aria-hidden />;
    case 'file_upload':
      return <FileUp className={iconClass} aria-hidden />;
    case 'image_upload':
      return <ImageUp className={iconClass} aria-hidden />;
    case 'multiple_file_upload':
      return <Files className={iconClass} aria-hidden />;
    case 'signature_pad':
      return <PenLine className={iconClass} aria-hidden />;
    case 'country':
      return <Globe className={iconClass} aria-hidden />;
    case 'state':
      return <Map className={iconClass} aria-hidden />;
    case 'city':
      return <Building2 className={iconClass} aria-hidden />;
    case 'address':
      return <MapPin className={iconClass} aria-hidden />;
    case 'google_maps_location':
      return <MapPinned className={iconClass} aria-hidden />;
    case 'submit_button':
      return <Send className={iconClass} aria-hidden />;
    case 'cancel_button':
      return <X className={iconClass} aria-hidden />;
    case 'big_number':
      return <TrendingUp className={iconClass} aria-hidden />;
    case 'data_table':
      return <Table2 className={iconClass} aria-hidden />;
    default:
      return <Type className={iconClass} aria-hidden />;
  }
}
