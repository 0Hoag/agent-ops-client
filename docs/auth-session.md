# Authentication session

The client stores the API-issued JWT in browser `sessionStorage` for the current tab and sends it as a Bearer token through the shared Axios client. Board, runs, and insights validate the token against `/api/v1/auth/session` before rendering; missing or rejected tokens redirect to login while retaining the intended path. Logout removes the token and protected route denial clears TanStack Query data. The health page remains public.
