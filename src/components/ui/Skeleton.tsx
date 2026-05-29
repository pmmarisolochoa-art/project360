import { cn } from '@/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[10px] bg-gradient-to-r from-bg-elevated via-bg-hover to-bg-elevated bg-[length:200%_100%]',
        className,
      )}
      style={{ animation: 'shimmer 1.6s linear infinite' }}
    />
  );
}
