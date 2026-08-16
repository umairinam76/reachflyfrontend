import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  api,
} from "../api";

const AuthContext =
  createContext(null);

const USER_KEY =
  "reachflyUser";

/*
 * React StrictMode mounts effects twice in development.
 * Reuse the same /auth/me request during the duplicate mount.
 */
let sessionInitializationPromise =
  null;

let sessionInitializationResetTimer =
  null;

function readStoredUser() {
  try {
    const stored =
      localStorage.getItem(
        USER_KEY
      );

    return stored
      ? JSON.parse(stored)
      : null;
  } catch {
    localStorage.removeItem(
      USER_KEY
    );

    return null;
  }
}

function saveStoredUser(user) {
  if (!user) {
    localStorage.removeItem(
      USER_KEY
    );

    sessionStorage.removeItem(
      USER_KEY
    );

    return;
  }

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );
}

function clearStoredSession() {
  api.clearToken();

  localStorage.removeItem(
    USER_KEY
  );

  sessionStorage.removeItem(
    USER_KEY
  );
}

function normalizeRole(value) {
  const role = String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes(
      "sales_representative"
    ) ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) {
    return "caller";
  }

  return role || "caller";
}

function getSessionInitialization() {
  if (!sessionInitializationPromise) {
    sessionInitializationPromise =
      api.me();

    sessionInitializationPromise.finally(
      () => {
        if (
          sessionInitializationResetTimer
        ) {
          window.clearTimeout(
            sessionInitializationResetTimer
          );
        }

        sessionInitializationResetTimer =
          window.setTimeout(
            () => {
              sessionInitializationPromise =
                null;

              sessionInitializationResetTimer =
                null;
            },
            1500
          );
      }
    );
  }

  return sessionInitializationPromise;
}

export function AuthProvider({
  children,
}) {
  const [
    token,
    setTokenState,
  ] = useState(
    () =>
      api.getToken()
  );

  const [
    user,
    setUserState,
  ] = useState(
    () =>
      readStoredUser()
  );

  const [
    initializing,
    setInitializing,
  ] = useState(true);

  const saveSession =
    useCallback(
      (
        payload,
        {
          persistent = true,
        } = {}
      ) => {
        if (
          !payload?.token ||
          !payload?.user
        ) {
          throw new Error(
            "Invalid authentication response."
          );
        }

        api.setToken(
          payload.token,
          {
            persistent,
          }
        );

        saveStoredUser(
          payload.user
        );

        setTokenState(
          payload.token
        );

        setUserState(
          payload.user
        );

        return payload;
      },
      []
    );

  const logout =
    useCallback(() => {
      clearStoredSession();

      sessionInitializationPromise =
        null;

      setTokenState("");
      setUserState(null);
    }, []);

  const login =
    useCallback(
      async (
        data,
        {
          rememberMe = true,
        } = {}
      ) => {
        const payload =
          await api.login(data);

        saveSession(
          payload,
          {
            persistent:
              rememberMe,
          }
        );

        return payload;
      },
      [
        saveSession,
      ]
    );

  const signup =
    useCallback(
      async (
        data,
        {
          rememberMe = true,
        } = {}
      ) => {
        const payload =
          await api.signup(data);

        saveSession(
          payload,
          {
            persistent:
              rememberMe,
          }
        );

        return payload;
      },
      [
        saveSession,
      ]
    );

  const googleAuth =
    useCallback(
      async (
        data,
        {
          rememberMe = true,
        } = {}
      ) => {
        const payload =
          await api.googleAuth(data);

        saveSession(
          payload,
          {
            persistent:
              rememberMe,
          }
        );

        return payload;
      },
      [saveSession]
    );

  const acceptInvite =
    useCallback(
      async (
        data,
        {
          rememberMe = true,
        } = {}
      ) => {
        const payload =
          await api.acceptInvite(
            data
          );

        saveSession(
          payload,
          {
            persistent:
              rememberMe,
          }
        );

        return payload;
      },
      [
        saveSession,
      ]
    );

  const updateUser =
    useCallback(
      (
        nextUserOrUpdater
      ) => {
        setUserState(
          (
            currentUser
          ) => {
            const nextUser =
              typeof nextUserOrUpdater ===
              "function"
                ? nextUserOrUpdater(
                    currentUser
                  )
                : nextUserOrUpdater;

            saveStoredUser(
              nextUser
            );

            return nextUser;
          }
        );
      },
      []
    );

  const refreshUser =
    useCallback(
      async () => {
        const currentToken =
          api.getToken();

        if (!currentToken) {
          logout();

          return null;
        }

        try {
          const response =
            await api.me();

          const freshUser =
            response?.user ||
            response;

          if (
            !freshUser ||
            typeof freshUser !==
              "object"
          ) {
            throw new Error(
              "Invalid user response."
            );
          }

          saveStoredUser(
            freshUser
          );

          setTokenState(
            currentToken
          );

          setUserState(
            freshUser
          );

          return freshUser;
        } catch (error) {
          if (
            error?.status ===
              401 ||
            error?.status ===
              403
          ) {
            logout();
          }

          throw error;
        }
      },
      [
        logout,
      ]
    );

  useEffect(() => {
    let active = true;

    async function initialiseSession() {
      const storedToken =
        api.getToken();

      if (!storedToken) {
        if (active) {
          setTokenState("");
          setUserState(null);
          setInitializing(false);
        }

        return;
      }

      try {
        const response =
          await getSessionInitialization();

        const freshUser =
          response?.user ||
          response;

        if (
          !freshUser ||
          typeof freshUser !==
            "object"
        ) {
          throw new Error(
            "Invalid user response."
          );
        }

        if (!active) {
          return;
        }

        saveStoredUser(
          freshUser
        );

        setTokenState(
          storedToken
        );

        setUserState(
          freshUser
        );
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          error?.status ===
            401 ||
          error?.status ===
            403
        ) {
          clearStoredSession();

          setTokenState("");
          setUserState(null);
        } else {
          setTokenState(
            storedToken
          );

          setUserState(
            readStoredUser()
          );
        }
      } finally {
        if (active) {
          setInitializing(
            false
          );
        }
      }
    }

    void initialiseSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized =
      () => {
        logout();
      };

    window.addEventListener(
      "reachfly:unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "reachfly:unauthorized",
        handleUnauthorized
      );
    };
  }, [
    logout,
  ]);

  useEffect(() => {
    const handleStorage =
      (event) => {
        const relevantKeys = [
          "reachflyToken",
          "token",
          USER_KEY,
        ];

        if (
          !relevantKeys.includes(
            event.key
          )
        ) {
          return;
        }

        const nextToken =
          api.getToken();

        const nextUser =
          readStoredUser();

        setTokenState(
          nextToken
        );

        setUserState(
          nextUser
        );
      };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  const value = useMemo(
    () => {
      const role =
        normalizeRole(
          user?.workspaceRole ||
            user?.role ||
            "caller"
        );

      const accountType =
        user?.accountType ||
        user?.workspaceType ||
        user?.workspace
          ?.accountType ||
        (
          user?.workspaceId ||
          user?.companyId
            ? "company"
            : "individual"
        );

      return {
        token,
        user,

        initializing,
        isLoading:
          initializing,

        isAuthenticated:
          Boolean(
            token &&
            user
          ),

        workspaceId:
          user?.workspaceId ||
          user?.workspace?.id ||
          "",

        accountType,

        companyName:
          user?.companyName ||
          user?.workspaceName ||
          user?.workspace
            ?.companyName ||
          "",

        workspaceName:
          user?.workspaceName ||
          user?.companyName ||
          user?.workspace?.name ||
          "",

        workspaceRole:
          role,

        role,

        isOwner:
          role === "owner",

        isAdmin:
          role === "admin",

        isManager:
          role === "manager",

        isCaller:
          role === "caller",

        login,
        signup,
        googleAuth,
        acceptInvite,
        logout,
        refreshUser,
        updateUser,
        saveSession,
      };
    },
    [
      token,
      user,
      initializing,
      login,
      signup,
      googleAuth,
      acceptInvite,
      logout,
      refreshUser,
      updateUser,
      saveSession,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value =
    useContext(
      AuthContext
    );

  if (!value) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return value;
}

export function getAuthToken() {
  return api.getToken();
}
