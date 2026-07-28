import type { IActionAuth, IStateAuth } from "@/types/auth";
export const initialState: IStateAuth = {
  isAuthenticated: false,
  authInfo: {
    token: "",
    user: {
      permissions: [],
      email: "",
      username: "",
      role: "",
      id: "",
      name: "",
    },
    allowedRoutes: [],
  },
};

const getAllowedRoutesForTheUser = (permissions = []) => {
  const routes = [];

  permissions.forEach((permission) => {
    if (permission.menu_id) {
      routes.push(permission.menu_id);
    }
    if (permission.sub_menu) {
      permission.sub_menu.forEach((sub) => {
        if (sub.sub_menu_id) {
          routes.push(sub.sub_menu_id);
        }
        if (sub.sub_sub_menu) {
          sub.sub_sub_menu.forEach((subSub) => {
            if (subSub.sub_sub_menu_id) {
              routes.push(subSub.sub_sub_menu_id);
            }
          });
        }
      });
    }
  });

  return routes;
};

export const reducer = (state: IStateAuth, action: IActionAuth): IStateAuth => {
  switch (action.type) {
    case "login":
      const allowed = getAllowedRoutesForTheUser(
        action?.payload?.user?.permissions
      );
      return {
        isAuthenticated: !!action.payload,
        authInfo: { ...action.payload, allowedRoutes: allowed },
      };
    case "logout":
      return {
        isAuthenticated: false,
        authInfo: {
          token: "",
          user: {
            permissions: [],
            email: "",
            username: "",
            role: "",
            id: "",
            name: "",
          },
          allowedRoutes: []
        },
      };
    default:
      return state;
  }
};
