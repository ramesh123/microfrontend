import { MenuItem } from "../rbac"

export interface IStateAuth {
  isAuthenticated: boolean
  authInfo?: {
    token: string
    user: IAuthUser
    allowedRoutes: string[]
  }
}
export type IActionAuth = IActionLogin | IActionLogout

export interface IActionLogin {
  type: 'login' | 'auth-check'
  payload: IAuthPayload
}

export interface IAuthPayload {
  token: string
  user: IAuthUser
}
export interface IAuthUser {
  organizationIds?: any
  role: string
  permissions: IAuthUserPermissions[]
  email: string
  username: string
  id: string
  first_name?: string
  last_name?: string
  is_authenticated?: boolean
  system_role?: string
  allowed_roles?: string[]
  urdhva_role?: string
  region?: string[]
  zone?: string[]
  state?: string[]
  sales_area?: string[]
  location_id?: string[]
  name: string,
  menu_items?: MenuItem[]
  perspectiveIds?: string[]  // Added perspectiveIds property
}

export interface IAuthUserPermissions {
  menu_id: string
  permission_id: string
  sub_menu?: [];
}

export interface IActionLogout {
  type: 'logout'
}
