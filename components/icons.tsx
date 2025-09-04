import React from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  GripVertical,
  FilePenLine,
  Sun,
  Moon,
  Repeat,
  CalendarPlus,
  Calendar,
  List,
  BarChart3,
  Minimize2,
  Maximize2,
  Download,
  Upload,
  Settings,
  CloudUpload,
  CloudDownload,
  Loader2,
  Clock,
  LogOut,
  Archive,
  AlarmClockOff,
  CalendarX2,
  Link,
  Check,
} from 'lucide-react';

// Note: The original components had specific classNames.
// These wrappers replicate that, but allow overriding via props for flexibility.

export const PlusIcon = (props: LucideProps) => <Plus className="h-6 w-6" {...props} />;

export const TrashIcon = (props: LucideProps) => <Trash2 className="h-5 w-5" {...props} />;

export const ChevronDownIcon = ({ className = "h-5 w-5", ...props }: LucideProps) => <ChevronDown className={className} {...props} />;

export const ChevronUpIcon = ({ className = "h-5 w-5", ...props }: LucideProps) => <ChevronUp className={className} {...props} />;

export const ChevronDoubleUpIcon = ({ className = "h-5 w-5", ...props }: LucideProps) => <ChevronsUp className={className} {...props} />;

export const ChevronDoubleDownIcon = ({ className = "h-5 w-5", ...props }: LucideProps) => <ChevronsDown className={className} {...props} />;

export const GripVerticalIcon = (props: LucideProps) => <GripVertical className="h-5 w-5 text-gray-400 dark:text-gray-500" {...props} />;

export const EditIcon = (props: LucideProps) => <FilePenLine className="h-5 w-5" {...props} />;

export const SunIcon = (props: LucideProps) => <Sun className="h-6 w-6" {...props} />;

export const MoonIcon = (props: LucideProps) => <Moon className="h-6 w-6" {...props} />;

export const RepeatIcon = (props: LucideProps) => <Repeat className="h-4 w-4" {...props} />;

export const CalendarPlusIcon = (props: LucideProps) => <CalendarPlus className="h-6 w-6" {...props} />;

export const CalendarIcon = ({ className = "h-6 w-6", ...props }: LucideProps) => <Calendar className={className} {...props} />;

export const ListIcon = (props: LucideProps) => <List className="h-6 w-6" {...props} />;

export const BarChartIcon = (props: LucideProps) => <BarChart3 className="h-6 w-6" {...props} />;

export const ArrowsPointingInIcon = (props: LucideProps) => <Minimize2 className="h-5 w-5" {...props} />;

export const ArrowsPointingOutIcon = (props: LucideProps) => <Maximize2 className="h-5 w-5" {...props} />;

export const DownloadIcon = (props: LucideProps) => <Download className="h-6 w-6" {...props} />;

export const UploadIcon = (props: LucideProps) => <Upload className="h-6 w-6" {...props} />;

export const SettingsIcon = (props: LucideProps) => <Settings className="h-6 w-6" {...props} />;

export const CloudUploadIcon = (props: LucideProps) => <CloudUpload className="h-6 w-6" {...props} />;

export const CloudDownloadIcon = (props: LucideProps) => <CloudDownload className="h-6 w-6" {...props} />;

export const SpinnerIcon = (props: LucideProps) => <Loader2 className="animate-spin h-6 w-6" {...props} />;

export const ClockIcon = ({ className = "h-4 w-4", ...props }: LucideProps) => <Clock className={className} {...props} />;

export const LogOutIcon = (props: LucideProps) => <LogOut className="h-6 w-6" {...props} />;

export const ArchiveIcon = (props: LucideProps) => <Archive className="h-6 w-6" {...props} />;

export const LinkIcon = (props: LucideProps) => <Link className="h-4 w-4" {...props} />;

export const SnoozeIcon = ({ className = "h-6 w-6", ...props }: LucideProps) => <AlarmClockOff className={className} {...props} />;

export const CalendarX2Icon = (props: LucideProps) => <CalendarX2 className="h-5 w-5" {...props} />;

export const CheckIcon = (props: LucideProps) => <Check className="h-4 w-4" {...props} />;
