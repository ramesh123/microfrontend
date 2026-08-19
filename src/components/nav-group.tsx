import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuCollapsible,
  SidebarMenuCollapsibleContent,
  SidebarMenuCollapsibleTrigger,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar'
import * as React from 'react'
import { ChevronRight, MousePointer2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import CustomBadge from '@/components/ui/custom-badge'
import { useCollapsedSelection } from '@/components/CollapsedSelectionContext'
import type { NavItem, NavGroup } from '@/types/sidebar'
import { cn } from '@/lib/utils'

export function NavGroup({ title, children }: NavGroup) {
  const { pathname } = useLocation()
  const { state } = useSidebar()
  const { selectedKey } = useCollapsedSelection()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {children.map((item, idx) => {
          const itemKey = `${title}::${item.title}-${item.path}::${idx}`

          if (state === 'collapsed' && selectedKey && selectedKey !== itemKey) {
            return null
          }

          if (!item.children) {
            return (
              <SidebarMenuLink
                key={itemKey}
                item={item}
                href={pathname}
                itemKey={itemKey}
              />
            )
          }

          if (state === 'collapsed') {
            return (
              <SidebarMenuCollapsedInline
                key={itemKey}
                item={item}
                href={pathname}
                itemKey={itemKey}
              />
            )
          }

          return (
            <NavCollapsibleMenuItem
              key={itemKey}
              item={item}
              href={pathname}
              itemKey={itemKey}
            />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

const NavBadge = ({ children }: { children: ReactNode }) => (
  <CustomBadge variant="secondary" label={children.toString()} className='rounded-full px-1 py-0 text-xs'></CustomBadge>
)

function CollapsedBackButton() {
  const { setSelectedKey } = useCollapsedSelection()

  return (
    <div className="mb-2 flex justify-center">
      <SidebarMenuButton
        onClick={(e) => {
          e.stopPropagation()
          setSelectedKey(null)
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-primary/10 transition-colors"
        aria-label="Back to all menu items"
      >
        <MousePointer2 className="h-4 w-4 text-primary" />
      </SidebarMenuButton>
    </div>
  )
}

const SidebarMenuLink = ({
  item,
  href,
  itemKey,
}: {
  item: NavItem
  href: string
  itemKey: string
}) => {
  const { setOpenMobile, state } = useSidebar()
  const { selectedKey, setSelectedKey } = useCollapsedSelection()
  const showTooltip = state === 'collapsed'
  const isDrilledIn = state === 'collapsed' && selectedKey === itemKey

  return (
    <SidebarMenuItem>
      {isDrilledIn && <CollapsedBackButton />}

      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        {...(showTooltip && !isDrilledIn ? { tooltip: item.title } : {})}
      >
        <Link
          to={item.path}
          onClick={() => {
            setOpenMobile(false)
            if (state === 'collapsed') {
              setSelectedKey(itemKey)
            }
          }}
        >
          {item.icon && <item.icon className='text-primary' />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const NavCollapsibleMenuItem = ({
  item,
  href,
  itemKey,
}: {
  item: NavItem
  href: string
  itemKey: string
}) => {
  const { setOpenMobile } = useSidebar()
  const parentActive = checkIsActive(href, item)

  return (
    <SidebarMenuCollapsible asChild defaultOpen className='group/collapsible'>
      <SidebarMenuItem>
        <SidebarMenuCollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={parentActive}>
            {item.icon && <item.icon className='text-primary' />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </SidebarMenuCollapsibleTrigger>
        <SidebarMenuCollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.children!.map((subItem, sidx) => {
              const subKey = `${itemKey}::${subItem.title}-${subItem.path}::${sidx}`
              const subActive = checkIsActive(href, subItem)
              return (
                <SidebarMenuSubItem key={subKey}>
                  <SidebarMenuSubButton asChild isActive={subActive}>
                    <Link to={subItem.path} onClick={() => setOpenMobile(false)}>
                      {subItem.icon && (
                        <subItem.icon
                          className={cn(
                            'size-4 shrink-0',
                            subActive ? 'text-white' : 'text-muted-foreground'
                          )}
                        />
                      )}
                      <span>{subItem.title}</span>
                      {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </SidebarMenuCollapsibleContent>
      </SidebarMenuItem>
    </SidebarMenuCollapsible>
  )
}

const SidebarMenuCollapsedInline = ({
  item,
  href,
  itemKey,
}: {
  item: NavItem
  href: string
  itemKey: string
}) => {
  const { setOpenMobile, state } = useSidebar()
  const { selectedKey, setSelectedKey } = useCollapsedSelection()
  const isDrilledIn = selectedKey === itemKey

  const handleParentClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedKey(itemKey)
  }

  return (
    <SidebarMenuItem>
      {isDrilledIn && <CollapsedBackButton />}

      <SidebarMenuButton
        onClick={handleParentClick}
        isActive={checkIsActive(href, item)}
        {...(!isDrilledIn ? { tooltip: item.title } : {})}
      >
        {item.icon && <item.icon className='text-primary' />}
        <span className='sr-only'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
      </SidebarMenuButton>

      {isDrilledIn && (
        <div className="mt-2 flex flex-col items-center space-y-2">
          {item.children!.map((sub, sidx) => {
            const subActive = checkIsActive(href, sub)
            return (
              <SidebarMenuButton
                key={`${itemKey}::${sub.title}-${sub.path}::${sidx}`}
                asChild
                isActive={subActive}
                tooltip={sub.title}
              >
                <Link
                  to={sub.path}
                  onClick={() => {
                    setOpenMobile(false)
                    setSelectedKey(itemKey)
                  }}
                  className="flex items-center justify-center"
                  aria-current={subActive ? 'page' : undefined}
                >
                  {sub.icon ? (
                    <sub.icon className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <span className="sr-only">{sub.title}</span>
                </Link>
              </SidebarMenuButton>
            )
          })}
        </div>
      )}
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item?: NavItem | null) {
  if (!item) return false
  const normalizePath = (path?: string) => (path || '').split('?')[0].replace(/\/+$/, '')
  const currentPath = normalizePath(href)
  const itemPath = normalizePath(item.path)
  const isPathActive = (path?: string) => {
    const targetPath = normalizePath(path)
    return !!targetPath && (currentPath === targetPath || currentPath.startsWith(`${targetPath}/`))
  }

  return isPathActive(itemPath) || !!item.children?.some((child) => child && isPathActive(child.path))
}
