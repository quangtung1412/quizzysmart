import { useState, useEffect } from 'react';

interface UserData {
    id: string;
    role: string;
    email?: string;
}

interface UserPermissions {
    canAccessChat: boolean;
    hasUnlimitedQuota: boolean;
    isAdmin: boolean;
}

export const useUserPermissions = () => {
    const [permissions, setPermissions] = useState<UserPermissions>({
        canAccessChat: false,
        hasUnlimitedQuota: false,
        isAdmin: false
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkUserPermissions = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setIsLoading(false);
                    return;
                }

                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData: UserData = await response.json();
                    const isAdmin = userData.role === 'admin';

                    setPermissions({
                        canAccessChat: isAdmin, // Currently only admin users can access chat
                        hasUnlimitedQuota: isAdmin,
                        isAdmin: isAdmin
                    });
                }
            } catch (error) {
                console.error('Error checking user permissions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkUserPermissions();
    }, []);

    return { permissions, isLoading };
};