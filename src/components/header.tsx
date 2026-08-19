import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DynamicBreadcrumb from './common/DynamicBreadcrumb'
import AIimage from '@/assets/images/ai.png'
import algoLogo from '@/assets/images/AlgoLogo.jpeg'
import { ThemeSwitch } from '@/components/theme-switch'
interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

export const Header = ({
  className,
  fixed,
  children,
  ...props
}: HeaderProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const companyMainText = import.meta.env.VITE_COMPANY_MAJOR_TEXT
  const companyMinorText = import.meta.env.VITE_COMPANY_MINOR_TEXT
  const hideSidebar =
    (location.pathname?.startsWith('/workflows/') &&
      !location.pathname.startsWith('/workflows/create')) ||
    location.pathname.startsWith('/draft_workflows/') ||
    location.pathname.startsWith('/api-gateway')
  const isLandingPage = location.pathname === '/landing'

  return (
    // <header
    //   className={cn('flex h-16 overflow-auto gap-3 shrink-0 items-center justify-between border-b backdrop-blur-sm px-4 sticky top-0 z-10',
    //     className
    //   )}
    //   {...props}
    // >
    //   <SidebarTrigger variant='outline' className='scale-125 sm:scale-100' />
    //   <Separator orientation='vertical' className='h-5' />
    //   {children}
    // </header>

    <header
      className={cn(
        /* relative: stay in flex flow with main column — sticky caused overlap with #content */
        'relative z-10 flex min-h-0 items-center gap-2 sm:gap-3 shrink-0 justify-between border-b shadow-2xs bg-background/95 px-3 py-1.5 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      {...props}
    >

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {!hideSidebar && (
          <SidebarTrigger className="h-7 w-7 shrink-0 p-0 text-xs" />
        )}
        {/* Landing page icon – always in top nav bar (e.g. on workflow screen when sidebar hidden) */}
        <button
          type="button"
          onClick={() => navigate(isLandingPage ? '/workflows' : '/landing')}
          title={isLandingPage ? 'Workflows' : 'Landing'}
          className="flex shrink-0 items-center justify-center p-0 border-0 bg-transparent cursor-pointer rounded hover:opacity-80 transition-opacity"
        >
          <img src={AIimage} alt="Landing" className="h-6 w-6 object-contain" />
        </button>

        <Separator orientation="vertical" className="h-4" />

        <div className="min-w-0 text-[11px] leading-none sm:text-xs">
          <DynamicBreadcrumb />
        </div>
        
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-1">
        <div className="flex max-w-full items-center gap-2">
          <div className="min-w-0 text-center leading-none sm:text-left">
            <h1 className="truncate text-base font-semibold tracking-tight text-primary sm:text-lg">
              {companyMainText}
            </h1>
            {companyMinorText ? (
              <p className="mt-0.5 truncate text-[0.6rem] font-medium text-primary/75 sm:text-[0.65rem]">
                {companyMinorText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className='flex shrink-0 gap-0'>
      <div>
        {/* show compact logo when sidebar is collapsed */}
        {(() => {
          try {
            const { state } = useSidebar()
            return state === 'collapsed' ? (
              <></>
            ) : null
          } catch (e) {
            return null
          }
        })()}
      </div>
      

      <div className="flex items-center gap-1">
        {/* <img
          src={algoLogo}
          alt="Algo"
          className="h-6 w-auto max-w-[min(140px,26vw)] shrink-0 object-contain object-left sm:h-7 sm:max-w-[min(160px,28vw)]"
        />
        {children} */}
        <ThemeSwitch />
      </div>
      </div>
    </header>
  )
}


Header.displayName = 'Header'
