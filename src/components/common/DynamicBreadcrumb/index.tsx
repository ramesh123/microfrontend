import React, { Fragment } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useAllRoutes, RouteConfig } from '@/router';

interface BreadcrumbInfo {
  path: string;
  title: string;
}

const generateBreadcrumbs = (
  routes: RouteConfig[],
  pathname: string,
  parentPath: string = ''
): BreadcrumbInfo[] => {
  for (const route of routes) {
    // The `hide` property is now ignored to show all path segments.
    const currentPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');

    if (pathname.startsWith(currentPath)) { 
      const breadcrumbs: BreadcrumbInfo[] = [];

      if (route.title) {
        breadcrumbs.push({ path: currentPath, title: route.title });
      }

      if (pathname === currentPath) {
        // If it's an exact match, we might still have a more specific index route.
        if (route.children) {
          const indexChild = route.children.find(c => c.index && !c.path);
          if (indexChild) {
            const childCrumbs = generateBreadcrumbs([indexChild], pathname, currentPath);
            return [...breadcrumbs, ...childCrumbs];
          }
        }
        return breadcrumbs;
      }

      if (route.children) {
        const childBreadcrumbs = generateBreadcrumbs(
          route.children,
          pathname,
          currentPath
        );
        if (childBreadcrumbs.length > 0) {
          return [...breadcrumbs, ...childBreadcrumbs];
        }
      }
    }
  }
  return [];
};

const DynamicBreadcrumb: React.FC = () => {
  const location = useLocation();
  const breadcrumbs = generateBreadcrumbs(useAllRoutes(), location.pathname);

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <Fragment key={crumb.path}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path}>{crumb.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default DynamicBreadcrumb;
