import React, {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { initialState, reducer } from "@/context/auth/authReducer";
import type { IActionAuth, IStateAuth } from "@/types/auth";

/**
 * ContextProps defines the structure of the authentication context,
 * providing the authentication state and a dispatch function for actions.
 */
interface ContextProps {
  state: IStateAuth;
  dispatch: React.Dispatch<IActionAuth>;
}

interface ContextProps {
  state: IStateAuth;
  dispatch: React.Dispatch<IActionAuth>;
  hydrated: boolean;
}

const AuthContext = createContext<ContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    const storedAuth = sessionStorage.getItem("auth");
    if (storedAuth) {
      try {
        const authInfo = JSON.parse(storedAuth);
        dispatch({ type: "login", payload: authInfo });
      } catch (err) {
        console.error("Failed to parse auth from sessionStorage", err);
        sessionStorage.removeItem("auth");
      }
    }
    setHydrated(true); // Mark hydration complete
  }, []);

  useEffect(() => {
    if (state.isAuthenticated) {
      sessionStorage.setItem("auth", JSON.stringify(state.authInfo));
    } else {
      sessionStorage.removeItem("auth");
    }
  }, [state.isAuthenticated, state.authInfo]);

  return (
    <AuthContext.Provider value={{ state, dispatch, hydrated }}>
      {hydrated ? children : null}
    </AuthContext.Provider>
  );
};

export const useAuth = (): ContextProps => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};
