import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  alt?: string
  initials?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl'
}

export default function Avatar({ src, alt, initials, size = 'md', className }: AvatarProps) {
  return (
    <div className={cn(
      "relative rounded-full overflow-hidden bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold",
      sizeClasses[size],
      className
    )}>
      {src ? (
        <img 
          src={src} 
          alt={alt || 'Avatar'} 
          className="w-full h-full object-cover"
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <span>?</span>
      )}
    </div>
  )
}
