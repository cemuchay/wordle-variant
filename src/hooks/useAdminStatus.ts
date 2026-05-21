import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useAdminStatus = (userId: string | undefined) => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const checkAdmin = async () => {
            try {
                const { data, error } = await supabase
                    .from('admin_profile')
                    .select('id')
                    .eq('id', userId)
                    .maybeSingle();

                if (isMounted) {
                    if (error) {
                        // If it's a permission error (user not allowed to select or table doesn't exist yet),
                        // fail gracefully and set admin to false.
                        setIsAdmin(false);
                    } else {
                        setIsAdmin(!!data);
                    }
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setIsAdmin(false);
                    setLoading(false);
                }
            }
        };

        checkAdmin();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    return { isAdmin, loading };
};
