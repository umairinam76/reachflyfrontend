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

const SESSION_VALIDATION_TTL_MS =
  30_000;

const SESSION_RATE_LIMIT_BACKOFF_MS =
  15_000;

let sessionValidationState = {
  token:
    "",
  promise:
    null,
  response:
    null,
  validatedAt:
    0,
  error:
    null,
  backoffUntil:
    0,
};

let refreshUserState = {
  token:
    "",
  promise:
    null,
};

function getLocalToken() {
  return (
    localStorage.getItem(
      "reachflyToken"
    ) ||
    localStorage.getItem(
      "token"
    ) ||
    ""
  );
}

function getSessionToken() {
  return (
    sessionStorage.getItem(
      "reachflyToken"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}

function isPersistentSession() {
  return Boolean(
    getLocalToken()
  );
}

function readJsonStorage(
  storage
) {
  try {
    const stored =
      storage.getItem(
        USER_KEY
      );

    return stored
      ? JSON.parse(
          stored
        )
      : null;
  } catch {
    storage.removeItem(
      USER_KEY
    );

    return null;
  }
}

function readStoredUser() {
  const localUser =
    readJsonStorage(
      localStorage
    );

  const sessionUser =
    readJsonStorage(
      sessionStorage
    );

  if (
    getLocalToken()
  ) {
    return (
      localUser ||
      sessionUser ||
      null
    );
  }

  if (
    getSessionToken()
  ) {
    return (
      sessionUser ||
      localUser ||
      null
    );
  }

  return (
    localUser ||
    sessionUser ||
    null
  );
}

function saveStoredUser(
  user,
  {
    persistent =
      isPersistentSession(),
  } = {}
) {
  localStorage.removeItem(
    USER_KEY
  );

  sessionStorage.removeItem(
    USER_KEY
  );

  if (!user) {
    return;
  }

  const storage =
    persistent
      ? localStorage
      : sessionStorage;

  storage.setItem(
    USER_KEY,
    JSON.stringify(
      user
    )
  );
}

function resetValidationState() {
  sessionValidationState = {
    token:
      "",
    promise:
      null,
    response:
      null,
    validatedAt:
      0,
    error:
      null,
    backoffUntil:
      0,
  };

  refreshUserState = {
    token:
      "",
    promise:
      null,
  };
}

function clearStoredSession() {
  api.clearToken();

  localStorage.removeItem(
    USER_KEY
  );

  sessionStorage.removeItem(
    USER_KEY
  );

  resetValidationState();
}

function normalizeRole(value) {
  const role =
    String(
      value ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /-/g,
        "_"
      );

  if (
    role.includes(
      "owner"
    )
  ) {
    return "owner";
  }

  if (
    role.includes(
      "admin"
    )
  ) {
    return "admin";
  }

  if (
    role.includes(
      "manager"
    )
  ) {
    return "manager";
  }

  if (
    role ===
      "caller" ||
    role.includes(
      "cold_caller"
    ) ||
    role.includes(
      "sales_representative"
    ) ||
    role.includes(
      "sales_rep"
    ) ||
    role.includes(
      "telemarketer"
    )
  ) {
    return "caller";
  }

  return (
    role ||
    "caller"
  );
}

function getValidationBackoff(
  error
) {
  const status =
    Number(
      error?.status ||
        0
    );

  if (
    status ===
    429
  ) {
    return Math.min(
      30_000,
      Math.max(
        SESSION_RATE_LIMIT_BACKOFF_MS,
        Number(
          error?.retryAfterMs ||
            0
        ) ||
          0
      )
    );
  }

  if (
    status >= 500 ||
    !status
  ) {
    return 3_000;
  }

  return 0;
}

function getSessionValidation(
  token,
  {
    force =
      false,
  } = {}
) {
  const now =
    Date.now();

  if (
    sessionValidationState.token ===
      token &&
    sessionValidationState.promise
  ) {
    return sessionValidationState.promise;
  }

  if (
    !force &&
    sessionValidationState.token ===
      token &&
    sessionValidationState.response &&
    now -
      sessionValidationState.validatedAt <
      SESSION_VALIDATION_TTL_MS
  ) {
    return Promise.resolve(
      sessionValidationState.response
    );
  }

  if (
    sessionValidationState.token ===
      token &&
    sessionValidationState.error &&
    now <
      sessionValidationState.backoffUntil
  ) {
    return Promise.reject(
      sessionValidationState.error
    );
  }

  const promise =
    api.me()
      .then(
        (
          response
        ) => {
          sessionValidationState = {
            token,
            promise:
              null,
            response,
            validatedAt:
              Date.now(),
            error:
              null,
            backoffUntil:
              0,
          };

          return response;
        }
      )
      .catch(
        (
          error
        ) => {
          sessionValidationState = {
            token,
            promise:
              null,
            response:
              null,
            validatedAt:
              0,
            error,
            backoffUntil:
              Date.now() +
              getValidationBackoff(
                error
              ),
          };

          throw error;
        }
      );

  sessionValidationState = {
    token,
    promise,
    response:
      null,
    validatedAt:
      0,
    error:
      null,
    backoffUntil:
      0,
  };

  return promise;
}

function extractUser(
  response
) {
  const freshUser =
    response?.user ||
    response;

  if (
    !freshUser ||
    typeof freshUser !==
      "object" ||
    Array.isArray(
      freshUser
    )
  ) {
    throw new Error(
      "Invalid user response."
    );
  }

  return freshUser;
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
          persistent =
            true,
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
          payload.user,
          {
            persistent,
          }
        );

        sessionValidationState = {
          token:
            payload.token,
          promise:
            null,
          response: {
            user:
              payload.user,
          },
          validatedAt:
            Date.now(),
          error:
            null,
          backoffUntil:
            0,
        };

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
    useCallback(
      () => {
        clearStoredSession();

        setTokenState(
          ""
        );

        setUserState(
          null
        );
      },
      []
    );

  const login =
    useCallback(
      async (
        data,
        {
          rememberMe =
            true,
        } = {}
      ) => {
        const payload =
          await api.login(
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

  const signup =
    useCallback(
      async (
        data,
        {
          rememberMe =
            true,
        } = {}
      ) => {
        const payload =
          await api.signup(
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

  const googleAuth =
    useCallback(
      async (
        data,
        {
          rememberMe =
            true,
        } = {}
      ) => {
        const payload =
          await api.googleAuth(
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

  const acceptInvite =
    useCallback(
      async (
        data,
        {
          rememberMe =
            true,
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
              nextUser,
              {
                persistent:
                  isPersistentSession(),
              }
            );

            if (
              nextUser &&
              api.getToken()
            ) {
              sessionValidationState = {
                token:
                  api.getToken(),
                promise:
                  null,
                response: {
                  user:
                    nextUser,
                },
                validatedAt:
                  Date.now(),
                error:
                  null,
                backoffUntil:
                  0,
              };
            }

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

        if (
          !currentToken
        ) {
          logout();
          return null;
        }

        if (
          refreshUserState.token ===
            currentToken &&
          refreshUserState.promise
        ) {
          return refreshUserState.promise;
        }

        const request =
          getSessionValidation(
            currentToken,
            {
              force:
                true,
            }
          )
            .then(
              (
                response
              ) => {
                const freshUser =
                  extractUser(
                    response
                  );

                saveStoredUser(
                  freshUser,
                  {
                    persistent:
                      isPersistentSession(),
                  }
                );

                setTokenState(
                  currentToken
                );

                setUserState(
                  freshUser
                );

                return freshUser;
              }
            )
            .catch(
              (
                error
              ) => {
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
            )
            .finally(
              () => {
                if (
                  refreshUserState.promise ===
                  request
                ) {
                  refreshUserState = {
                    token:
                      "",
                    promise:
                      null,
                  };
                }
              }
            );

        refreshUserState = {
          token:
            currentToken,
          promise:
            request,
        };

        return request;
      },
      [
        logout,
      ]
    );

  useEffect(
    () => {
      let active =
        true;

      async function initialiseSession() {
        const storedToken =
          api.getToken();

        if (
          !storedToken
        ) {
          if (
            active
          ) {
            setTokenState(
              ""
            );

            setUserState(
              null
            );

            setInitializing(
              false
            );
          }

          return;
        }

        try {
          const response =
            await getSessionValidation(
              storedToken
            );

          const freshUser =
            extractUser(
              response
            );

          if (
            !active
          ) {
            return;
          }

          saveStoredUser(
            freshUser,
            {
              persistent:
                isPersistentSession(),
            }
          );

          setTokenState(
            storedToken
          );

          setUserState(
            freshUser
          );
        } catch (
          error
        ) {
          if (
            !active
          ) {
            return;
          }

          if (
            error?.status ===
              401 ||
            error?.status ===
              403
          ) {
            clearStoredSession();

            setTokenState(
              ""
            );

            setUserState(
              null
            );
          } else {
            const cachedUser =
              readStoredUser();

            setTokenState(
              storedToken
            );

            setUserState(
              cachedUser
            );
          }
        } finally {
          if (
            active
          ) {
            setInitializing(
              false
            );
          }
        }
      }

      void initialiseSession();

      return () => {
        active =
          false;
      };
    },
    []
  );

  useEffect(
    () => {
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
    },
    [
      logout,
    ]
  );

  useEffect(
    () => {
      const handleStorage =
        (
          event
        ) => {
          const relevantKeys = [
            "reachflyToken",
            "token",
            USER_KEY,
          ];

          if (
            event.key &&
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

          if (
            nextToken !==
            token
          ) {
            resetValidationState();
          }

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
    },
    [
      token,
    ]
  );

  const value =
    useMemo(
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
            user?.workspace
              ?.name ||
            "",

          workspaceRole:
            role,

          role,

          isOwner:
            role ===
            "owner",

          isAdmin:
            role ===
            "admin",

          isManager:
            role ===
            "manager",

          isCaller:
            role ===
            "caller",

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

  if (
    !value
  ) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return value;
}

export function getAuthToken() {
  return api.getToken();
}
