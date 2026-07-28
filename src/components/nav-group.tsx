import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar'
import * as React from 'react'
import { ChevronRight, ChevronLeft, MousePointer2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import CustomBadge from '@/components/ui/custom-badge'
import { useCollapsedSelection } from '@/components/CollapsedSelectionContext'
// Inline collapsed behavior will be handled without dropdowns or tooltips
import type { NavCollapsible, NavItem, NavLink, NavGroup } from '@/types/sidebar'
import { cn } from '@/lib/utils'

export function NavGroup({ title, children }: NavGroup) {
  const { state } = useSidebar()
  const { pathname } = useLocation()
  const { selectedKey } = useCollapsedSelection()

  return (
    <>
      <SidebarGroup>
      {/* <SidebarGroupLabel>{title}</SidebarGroupLabel> */}
      <SidebarMenu>
        {children.map((item, idx) => {
          const itemKey = `${title}::${item.title}-${item.path}::${idx}`
          const groupItemKey = itemKey

          // If collapsed and a parent is selected, hide all other top-level items
          if (state === 'collapsed' && selectedKey && selectedKey !== groupItemKey) {
            return null
          }

          if (!item.children) return <SidebarMenuLink key={itemKey} item={item} href={pathname} itemKey={itemKey} />

          if (state === 'collapsed') {
            return (
              <SidebarMenuCollapsedInline
                key={itemKey}
                item={item}
                href={pathname}
                groupTitle={title}
                itemKey={itemKey}
              />
            )
          }

          return <SidebarMenuCollapsible key={itemKey} item={item} href={pathname} groupTitle={title} itemKey={itemKey} />
        })}
      </SidebarMenu>
      </SidebarGroup>
    </>
  )
}

const NavBadge = ({ children }: { children: ReactNode }) => (
  <CustomBadge variant="secondary" label={children.toString()} className='rounded-full px-1 py-0 text-xs'></CustomBadge>
)
const darK = false;

const SidebarMenuLink = ({ item, href, itemKey }: { item: NavItem; href: string; itemKey: string }) => {
  const { setOpenMobile, state } = useSidebar()
  const { selectedKey, setSelectedKey } = useCollapsedSelection()
  const showTooltip = state == 'collapsed'
  const ownKey = itemKey

  return (
    <SidebarMenuItem>
      {state === 'collapsed' && selectedKey === ownKey && (
        <div className="flex justify-center mb-2">
          <SidebarMenuButton
            onClick={(e) => {
              e.stopPropagation()
              setSelectedKey(null)
            }}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors"
          >
            <MousePointer2 className="h-4 w-4 text-primary" />
          </SidebarMenuButton>
        </div>
      )}

      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        {...(showTooltip ? { tooltip: item.title } : {})}
      >
        <Link
          to={item.path}
          onClick={() => {
            setOpenMobile(false)
            if (state === 'collapsed') setSelectedKey(ownKey)
          }}
        >
          {item.icon && <item.icon className='text-primary' />}
          <span >{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const SidebarMenuCollapsible = ({
  item,
  href,
  groupTitle,
  itemKey
}: {
  item: NavItem
  href: string
  groupTitle: string
  itemKey: string
}) => {
  const { setOpenMobile } = useSidebar()
  const parentActive = checkIsActive(href, item)
  return (
    <Collapsible
      asChild
      defaultOpen
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={parentActive}>
            {item.icon && <item.icon className='text-primary' />}
            <span >{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.children.map((subItem, sidx) => {
              const subKey = `${itemKey}::${subItem.title}-${subItem.path}::${sidx}`
              const subActive = checkIsActive(href, subItem)
              return (
                <SidebarMenuSubItem key={subKey}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={subActive}
                  >
                    <Link to={subItem.path} onClick={() => setOpenMobile(false)}>
                      {subItem.icon && (
                        <subItem.icon
                          className={cn(
                            'size-4 shrink-0',
                            subActive ? 'text-white' : 'text-muted-foreground'
                          )}
                        />
                      )}
                      <span >{subItem.title}</span>
                      {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

const SidebarMenuCollapsedInline = ({
  item,
  href,
  groupTitle,
  itemKey
}: {
  item: NavItem
  href: string
  groupTitle: string
  itemKey: string
}) => {
  const { setOpenMobile, state } = useSidebar()
  const [open, setOpen] = React.useState(false)
  const { selectedKey, setSelectedKey } = useCollapsedSelection()
  const ownKey = itemKey

  // Ensure local open state doesn't persist when sidebar becomes collapsed.
  // This prevents other groups from rendering their inline children when a different
  // group's parent is selected and then cleared (Back).
  React.useEffect(() => {
    if (state === 'collapsed') setOpen(false)
  }, [state])

  // Close local open when the global selection changes and doesn't match this item.
  React.useEffect(() => {
    if (state === 'collapsed') {
      if (!selectedKey) {
        setOpen(false)
        return
      }

      if (selectedKey !== ownKey) setOpen(false)
    }
  }, [selectedKey, state, ownKey])

  const toggle = (e: React.MouseEvent) => {
    // When collapsed, set global selected parent instead of local toggle
    if (state === 'collapsed') {
      // Always set this parent as the selectedKey when clicked in collapsed mode.
      // Clearing the selection (going "back") is handled only by the explicit back button.
      setSelectedKey(ownKey)
      return
    }

    // don't prevent default — allow normal focus/interaction
    setOpen((v) => !v)
  }

  return (
    
    <SidebarMenuItem>
      {state === 'collapsed' && selectedKey === ownKey && (
        <div className="flex justify-center mb-2">
          <SidebarMenuButton
            onClick={(e) => {
              e.stopPropagation()
              setSelectedKey(null)
            }}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors"
          >
            <MousePointer2 className="h-4 w-4 text-primary" />
          </SidebarMenuButton>
        </div>
      )}
      <SidebarMenuButton
        onClick={toggle}
        isActive={checkIsActive(href, item)}
        {...(state === 'collapsed' ? { tooltip: item.title } : {})}
      >
        {item.icon && <item.icon className='text-primary' />}
        {/* keep title visually hidden in collapsed mode */}
        <span className='sr-only'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
        {state !== 'collapsed' && (
          <MousePointer2 className={`ml-auto transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        )}
        
      </SidebarMenuButton>

      {(open || (state === 'collapsed' && selectedKey === ownKey)) && (
        <div className="flex flex-col items-center mt-2 space-y-2">
              {item.children.map((sub, sidx) => {
                const collapsedSubKey = `${itemKey}::${sub.title}-${sub.path}::${sidx}`
                return (
                  <div key={collapsedSubKey}>
              <SidebarMenuButton
                asChild
                isActive={checkIsActive(href, sub)}
                {...(state === 'collapsed' ? { tooltip: sub.title } : {})}
              >
                <Link
                  to={sub.path}
                  onClick={() => {
                    // Close mobile sidebar on navigation but keep inline children open.
                    setOpenMobile(false)
                  }}
                  className={`flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 transition-colors ${
                    checkIsActive(href, sub) ? 'bg-primary/10' : ''
                  }`}
                  aria-current={checkIsActive(href, sub) ? 'page' : undefined}
                >
                  <div className="flex flex-col items-center">
                    {sub.icon ? <sub.icon className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
                    {state === 'collapsed' && (
                      <span className={`mt-1 block h-[2px] w-4 rounded ${checkIsActive(href, sub) ? 'bg-primary' : 'bg-primary/30'}`} />
                    )}
                  </div>
                </Link>
              </SidebarMenuButton>
              </div>
            )
          })}
        </div>
      )}
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem) {
  const normalizePath = (path?: string) => (path || '').split('?')[0].replace(/\/+$/, '')
  const currentPath = normalizePath(href)
  const itemPath = normalizePath(item.path)
  const isPathActive = (path?: string) => {
    const targetPath = normalizePath(path)
    return !!targetPath && (currentPath === targetPath || currentPath.startsWith(`${targetPath}/`))
  }

  return isPathActive(itemPath) || !!item?.children?.some((child) => isPathActive(child.path))
}


