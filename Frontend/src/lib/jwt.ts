// reads the exp claim without checking the signature; the server still validates the token
const getTokenExpiry = (token: string): number | null => {
    const payload = token.split('.')[1];

    if (!payload)
    {
        return null;
    }

    try
    {
        const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

        return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
    }
    catch
    {
        return null;
    }
};

export const isTokenExpiring = (token: string, withinMs: number): boolean => {
    const expiry = getTokenExpiry(token);

    return expiry === null || expiry - Date.now() < withinMs;
};
